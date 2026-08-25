import {
  afterEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

import {
  runScheduledLesson1Rollout,
  SCHEDULED_ROLLOUT_EXIT_CODES,
} from '../scripts/runLesson1ReminderRollout.js';

const SECRET = 'runner-test-secret';
const ENDPOINT =
  'https://api.fluencyjet.com/api/automation/process-due-reminder-rollout';

function makeEnv(overrides = {}) {
  return {
    WHATSAPP_ROLLOUT_ENDPOINT_URL: ENDPOINT,
    AUTOMATION_SECRET: SECRET,
    WHATSAPP_LIVE_SEND_ENABLED: 'true',
    WHATSAPP_ROLLOUT_WORKER_ENABLED: 'true',
    ...overrides,
  };
}

function makeLogger() {
  const entries = [];
  const logger = {
    error: (...args) => entries.push(['error', ...args]),
    info: (...args) => entries.push(['info', ...args]),
    warn: (...args) => entries.push(['warn', ...args]),
  };

  return {
    logger,
    output: () => entries.flat().join(' '),
  };
}

function makeResponse(
  body,
  status = 200,
) {
  return {
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

function successfulBody(overrides = {}) {
  return {
    ok: true,
    mode: 'live',
    dryRun: false,
    counts: {
      examined: 1,
      skipped: 0,
      sent: 1,
      unconfirmed: 0,
    },
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('scheduled Lesson 1 rollout runner', () => {
  test('fails closed on missing configuration without making a request', async () => {
    const fetchImpl = jest.fn();
    const { logger, output } = makeLogger();

    const result = await runScheduledLesson1Rollout({
      env: makeEnv({
        WHATSAPP_ROLLOUT_ENDPOINT_URL: '',
      }),
      fetchImpl,
      logger,
    });

    expect(result).toMatchObject({
      ok: false,
      exitCode: SCHEDULED_ROLLOUT_EXIT_CODES.FAILURE,
      errorCode: 'ENDPOINT_URL_NOT_CONFIGURED',
      requestCount: 0,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(output()).not.toContain(SECRET);
  });

  test.each([
    'https://attacker.example/api/automation/process-due-reminder-rollout',
    'http://api.fluencyjet.com/api/automation/process-due-reminder-rollout',
  ])(
    'rejects an unapproved or cleartext endpoint before making a request: %s',
    async (endpointUrl) => {
      const fetchImpl = jest.fn();
      const { logger } = makeLogger();

      const result = await runScheduledLesson1Rollout({
        env: makeEnv({
          WHATSAPP_ROLLOUT_ENDPOINT_URL: endpointUrl,
        }),
        fetchImpl,
        logger,
      });

      expect(result).toMatchObject({
        ok: false,
        exitCode: SCHEDULED_ROLLOUT_EXIT_CODES.FAILURE,
        errorCode: 'ENDPOINT_URL_INVALID',
        requestCount: 0,
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  test('permits only explicit loopback HTTP for local development', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(makeResponse(successfulBody()));
    const { logger } = makeLogger();

    const result = await runScheduledLesson1Rollout({
      env: makeEnv({
        WHATSAPP_ROLLOUT_ENDPOINT_URL:
          'http://127.0.0.1:3000/api/automation/process-due-reminder-rollout',
      }),
      fetchImpl,
      logger,
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      'global live-send gate',
      { WHATSAPP_LIVE_SEND_ENABLED: 'false' },
      'WHATSAPP_LIVE_SEND_DISABLED',
    ],
    [
      'rollout worker gate',
      { WHATSAPP_ROLLOUT_WORKER_ENABLED: 'false' },
      'WHATSAPP_ROLLOUT_WORKER_DISABLED',
    ],
  ])(
    'fails closed when the %s is disabled and does not dispatch',
    async (_label, overrides, errorCode) => {
      const fetchImpl = jest.fn();
      const { logger } = makeLogger();

      const result = await runScheduledLesson1Rollout({
        env: makeEnv(overrides),
        fetchImpl,
        logger,
      });

      expect(result).toMatchObject({
        ok: false,
        exitCode: SCHEDULED_ROLLOUT_EXIT_CODES.FAILURE,
        errorCode,
        requestCount: 0,
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  test('makes exactly one serialized live rollout request with a one-send cap', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(makeResponse(successfulBody()));
    const { logger } = makeLogger();

    const result = await runScheduledLesson1Rollout({
      env: makeEnv(),
      fetchImpl,
      logger,
    });

    expect(result).toMatchObject({
      ok: true,
      exitCode: SCHEDULED_ROLLOUT_EXIT_CODES.SUCCESS,
      requestCount: 1,
      counts: {
        sent: 1,
        unconfirmed: 0,
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          liveSend: true,
          limit: 1,
        }),
      }),
    );
  });

  test('fails closed on an uncertain send and never retries', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      makeResponse(
        successfulBody({
          counts: {
            examined: 1,
            skipped: 0,
            sent: 0,
            unconfirmed: 1,
          },
          rows: [{
            automationEventId: 'private-event-id',
            destination: '[masked]',
            providerError: 'private-provider-detail',
          }],
        }),
      ),
    );
    const { logger, output } = makeLogger();

    const result = await runScheduledLesson1Rollout({
      env: makeEnv(),
      fetchImpl,
      logger,
    });

    expect(result).toMatchObject({
      ok: false,
      exitCode: SCHEDULED_ROLLOUT_EXIT_CODES.FAILURE,
      errorCode: 'UNCONFIRMED_SEND',
      requestCount: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(output()).not.toContain('private-event-id');
    expect(output()).not.toContain('private-provider-detail');
  });

  test('fails closed on HTTP failure without retrying or logging response data', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      makeResponse(
        {
          ok: false,
          error: 'WHATSAPP_SEND_UNCONFIRMED',
          providerError: 'private-provider-detail',
          providerMessageId: 'private-provider-id',
        },
        502,
      ),
    );
    const { logger, output } = makeLogger();

    const result = await runScheduledLesson1Rollout({
      env: makeEnv(),
      fetchImpl,
      logger,
    });

    expect(result).toMatchObject({
      ok: false,
      exitCode: SCHEDULED_ROLLOUT_EXIT_CODES.FAILURE,
      errorCode: 'HTTP_REQUEST_FAILED',
      requestCount: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(output()).not.toContain('private-provider-detail');
    expect(output()).not.toContain('private-provider-id');
  });

  test('keeps successful output aggregate-only and rejects a send-cap violation', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      makeResponse(
        successfulBody({
          counts: {
            examined: 2,
            skipped: 0,
            sent: 2,
            unconfirmed: 0,
          },
          rows: [{
            automationEventId: 'private-event-id',
            email: 'private@example.test',
            destination: '[masked]',
          }],
        }),
      ),
    );
    const { logger, output } = makeLogger();

    const result = await runScheduledLesson1Rollout({
      env: makeEnv(),
      fetchImpl,
      logger,
    });

    expect(result).toMatchObject({
      ok: false,
      errorCode: 'ROLLOUT_SEND_CAP_VIOLATED',
      requestCount: 1,
    });
    expect(output()).not.toContain('private-event-id');
    expect(output()).not.toContain('private@example.test');
  });
});