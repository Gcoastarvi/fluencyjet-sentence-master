/**
 * Real PostgreSQL integration coverage for STOP/send serialization.
 *
 * This suite connects only to TEST_DATABASE_URL. DATABASE_URL is read solely
 * to prove the target identity differs before any database write; it is never
 * used to create a client or as a fallback connection string.
 */
import crypto from 'crypto';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { acquireWhatsAppDestinationLock } from '../lib/whatsappDestinationLock.js';

jest.setTimeout(30_000);

function requiredTestDatabaseUrl() {
  const value = String(process.env.TEST_DATABASE_URL || '').trim();

  if (!value) {
    throw new Error(
      'TEST_DATABASE_URL is required for WhatsApp PostgreSQL concurrency tests.',
    );
  }

  return value;
}

function targetFingerprint(connectionString) {
  let parsed;

  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('Database target verification requires valid PostgreSQL URLs.');
  }

  const targetIdentity = JSON.stringify({
    protocol: parsed.protocol,
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || '5432',
    database: decodeURIComponent(parsed.pathname).replace(/^\/+/, ''),
  });

  return crypto
    .createHash('sha256')
    .update(targetIdentity)
    .digest('hex')
    .slice(0, 16);
}

function verifyIsolatedTarget(testDatabaseUrl) {
  const productionDatabaseUrl = String(process.env.DATABASE_URL || '').trim();

  if (!productionDatabaseUrl) {
    throw new Error(
      'DATABASE_URL is required only to verify TEST_DATABASE_URL is isolated.',
    );
  }

  const testFingerprint = targetFingerprint(testDatabaseUrl);
  const productionFingerprint = targetFingerprint(productionDatabaseUrl);
  const sameTarget = testFingerprint === productionFingerprint;

  if (sameTarget) {
    throw new Error(
      'TEST_DATABASE_URL must target a different host/database than DATABASE_URL.',
    );
  }

  return {
    sameTarget: false,
    testFingerprint,
    productionFingerprint,
  };
}

function deferred() {
  let resolve;
  let reject;

  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function pause(milliseconds = 150) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function expectPending(promise, timeoutMilliseconds = 500) {
  let timer;

  try {
    const settled = await Promise.race([
      promise.then(
        () => true,
        () => true,
      ),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMilliseconds);
      }),
    ]);

    expect(settled).toBe(false);
  } finally {
    clearTimeout(timer);
  }
}

async function expectCompletesBefore(promise, timeoutMilliseconds, message) {
  let timer;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMilliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const testDatabaseUrl = requiredTestDatabaseUrl();
const targetProof = verifyIsolatedTarget(testDatabaseUrl);

// Each client has its own pool, ensuring the advisory-lock tests exercise
// separate PostgreSQL connections rather than a single mocked transaction.
const stopClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const sendClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});

const originalLiveSendEnabled = process.env.WHATSAPP_LIVE_SEND_ENABLED;
const runPrefix = `+1998${crypto.randomBytes(5).toString('hex').slice(0, 10)}`;
const testNumbers = new Set();

function numberFor(testIndex) {
  const number = `${runPrefix}${testIndex}`;
  testNumbers.add(number);
  return number;
}

async function backendPid(transaction) {
  const rows = await transaction.$queryRaw`
    SELECT pg_backend_pid() AS pid
  `;

  return Number(rows[0].pid);
}

async function writeSuppression(transaction, number) {
  await transaction.whatsAppPhoneSuppression.upsert({
    where: {
      phoneNumberNormalized: number,
    },
    create: {
      phoneNumberNormalized: number,
      isOptedOut: true,
      optedOutAt: new Date(),
      optOutCommand: 'STOP',
    },
    update: {
      isOptedOut: true,
      optedOutAt: new Date(),
      optOutCommand: 'STOP',
      clearedAt: null,
      clearanceSource: null,
      clearanceReason: null,
      clearedByUserId: null,
    },
  });
}

async function runStop(client, number, { entered, release } = {}) {
  return client.$transaction(async (transaction) => {
    await acquireWhatsAppDestinationLock(transaction, number);
    const pid = await backendPid(transaction);
    entered?.resolve(pid);
    await release?.promise;
    await writeSuppression(transaction, number);
    return { pid };
  });
}

async function runSend(
  client,
  number,
  provider,
  { entered, release } = {},
) {
  return client.$transaction(async (transaction) => {
    await acquireWhatsAppDestinationLock(transaction, number);
    const pid = await backendPid(transaction);
    entered?.resolve(pid);
    await release?.promise;

    const suppression =
      await transaction.whatsAppPhoneSuppression.findUnique({
        where: {
          phoneNumberNormalized: number,
        },
        select: {
          isOptedOut: true,
        },
      });

    if (suppression?.isOptedOut) {
      return { pid, skipped: 'PHONE_SUPPRESSED' };
    }

    await provider({ to: number });
    return { pid, skipped: null };
  });
}

async function cleanupTestRows() {
  const numbers = [...testNumbers];

  if (numbers.length === 0) return;

  await stopClient.whatsAppPhoneSuppression.deleteMany({
    where: {
      phoneNumberNormalized: {
        in: numbers,
      },
    },
  });
}

describe('WhatsApp STOP/send PostgreSQL advisory-lock integration', () => {
  beforeAll(async () => {
    // This suite never enables the live-send switch and never imports the
    // provider implementation. Provider behavior is represented by jest.fn().
    process.env.WHATSAPP_LIVE_SEND_ENABLED = 'false';
    await Promise.all([stopClient.$connect(), sendClient.$connect()]);
  });

  afterEach(async () => {
    await cleanupTestRows();
  });

  afterAll(async () => {
    await cleanupTestRows();
    await Promise.all([stopClient.$disconnect(), sendClient.$disconnect()]);

    if (originalLiveSendEnabled === undefined) {
      delete process.env.WHATSAPP_LIVE_SEND_ENABLED;
    } else {
      process.env.WHATSAPP_LIVE_SEND_ENABLED = originalLiveSendEnabled;
    }
  });

  test('preflight proves the test client is isolated and live sends stay disabled', () => {
    expect(targetProof.sameTarget).toBe(false);
    expect(process.env.WHATSAPP_LIVE_SEND_ENABLED).toBe('false');

    console.info(
      `[whatsapp-concurrency] sameTarget=false ` +
      `testFingerprint=${targetProof.testFingerprint} ` +
      `productionFingerprint=${targetProof.productionFingerprint}`,
    );
  });

  test('STOP gets the lock first, then send sees suppression without a provider call', async () => {
    const number = numberFor(1);
    const stopEntered = deferred();
    const releaseStop = deferred();
    const sendEntered = deferred();
    const provider = jest.fn();

    const stopPromise = runStop(stopClient, number, {
      entered: stopEntered,
      release: releaseStop,
    });

    const stopPid = await stopEntered.promise;
    const sendPromise = runSend(sendClient, number, provider, {
      entered: sendEntered,
    });

    await expectPending(sendEntered.promise);
    expect(provider).not.toHaveBeenCalled();

    releaseStop.resolve();
    const [stopResult, sendResult] = await Promise.all([
      stopPromise,
      sendPromise,
    ]);

    expect(stopResult.pid).toBe(stopPid);
    expect(sendResult.pid).not.toBe(stopPid);
    expect(sendResult.skipped).toBe('PHONE_SUPPRESSED');
    expect(provider).not.toHaveBeenCalled();
  });

  test('send gets the lock first and STOP waits for the send critical section', async () => {
    const number = numberFor(2);
    const sendEntered = deferred();
    const releaseSend = deferred();
    const stopEntered = deferred();
    const provider = jest.fn().mockResolvedValue({ messageId: 'mocked' });

    const sendPromise = runSend(sendClient, number, provider, {
      entered: sendEntered,
      release: releaseSend,
    });

    const sendPid = await sendEntered.promise;
    const stopPromise = runStop(stopClient, number, {
      entered: stopEntered,
    });

    await expectPending(stopEntered.promise);
    releaseSend.resolve();

    const [sendResult, stopResult] = await Promise.all([
      sendPromise,
      stopPromise,
    ]);

    expect(sendResult.pid).toBe(sendPid);
    expect(stopResult.pid).not.toBe(sendPid);
    expect(sendResult.skipped).toBeNull();
    expect(provider).toHaveBeenCalledTimes(1);

    const suppression =
      await stopClient.whatsAppPhoneSuppression.findUnique({
        where: { phoneNumberNormalized: number },
      });
    expect(suppression?.isOptedOut).toBe(true);
  });

  test('different destinations do not block each other', async () => {
    const blockedNumber = numberFor(3);
    const independentNumber = numberFor(4);
    const stopEntered = deferred();
    const releaseStop = deferred();
    const independentEntered = deferred();
    const provider = jest.fn().mockResolvedValue({ messageId: 'mocked' });

    const blockedStop = runStop(stopClient, blockedNumber, {
      entered: stopEntered,
      release: releaseStop,
    });
    await stopEntered.promise;

    const independentSend = runSend(
      sendClient,
      independentNumber,
      provider,
      {
        entered: independentEntered,
      },
    );

    try {
      // This permits connection warm-up while still proving the independent
      // transaction obtained its own destination lock before we release the
      // intentionally held STOP transaction.
      await expectCompletesBefore(
        independentEntered.promise,
        6_000,
        'A different WhatsApp destination was blocked.',
      );

      const independentResult = await expectCompletesBefore(
        independentSend,
        6_000,
        'A different WhatsApp destination did not complete.',
      );

      expect(independentResult.skipped).toBeNull();
      expect(provider).toHaveBeenCalledTimes(1);
    } finally {
      releaseStop.resolve();
      await blockedStop;
    }
  });

  test('transaction-scoped locks release after rollback/error', async () => {
    const number = numberFor(5);
    const erroredLockEntered = deferred();

    const failedTransaction = stopClient.$transaction(async (transaction) => {
      await acquireWhatsAppDestinationLock(transaction, number);
      erroredLockEntered.resolve(await backendPid(transaction));
      throw new Error('intentional advisory-lock rollback');
    });

    await erroredLockEntered.promise;
    await expect(failedTransaction).rejects.toThrow(
      'intentional advisory-lock rollback',
    );

    const provider = jest.fn().mockResolvedValue({ messageId: 'mocked' });
    const recoveredSend = await expectCompletesBefore(
      runSend(sendClient, number, provider),
      6_000,
      'Advisory lock was not released after rollback.',
    );

    expect(recoveredSend.skipped).toBeNull();
    expect(provider).toHaveBeenCalledTimes(1);
  });
});