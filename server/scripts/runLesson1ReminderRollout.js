import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROLLOUT_PATH = '/api/automation/process-due-reminder-rollout';
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const MIN_REQUEST_TIMEOUT_MS = 1_000;
const MAX_REQUEST_TIMEOUT_MS = 120_000;
const APPROVED_ENDPOINT_ORIGINS = new Set([
  'https://api.fluencyjet.com',
  'https://fluencyjet.com',
  'https://www.fluencyjet.com',
  'https://fluencyjet-sentence-master-production.up.railway.app',
  'https://fluencyjet-sentence-master-production-de09.up.railway.app',
]);
const POISON_VALUES = new Set([
  '',
  'undefined',
  'null',
  'false',
  '0',
  'none',
  'secret',
  'changeme',
  'change-me',
]);

export const SCHEDULED_ROLLOUT_EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  FAILURE: 1,
});

function getTrimmedEnv(env, name) {
  return String(env?.[name] || '').trim();
}

function isPoisonValue(value) {
  return POISON_VALUES.has(value.toLowerCase());
}

function isEnabled(value) {
  return value.toLowerCase() === 'true';
}

function isApprovedEndpointOrigin(endpoint) {
  if (APPROVED_ENDPOINT_ORIGINS.has(endpoint.origin)) return true;

  return (
    endpoint.protocol === 'http:' &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)
  );
}

function readEndpointUrl(env) {
  const configured = getTrimmedEnv(env, 'WHATSAPP_ROLLOUT_ENDPOINT_URL');

  if (!configured || isPoisonValue(configured)) {
    return { errorCode: 'ENDPOINT_URL_NOT_CONFIGURED' };
  }

  let endpoint;

  try {
    endpoint = new URL(configured);
  } catch {
    return { errorCode: 'ENDPOINT_URL_INVALID' };
  }

  if (
    !isApprovedEndpointOrigin(endpoint) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname.replace(/\/+$/, '') !== ROLLOUT_PATH
  ) {
    return { errorCode: 'ENDPOINT_URL_INVALID' };
  }

  return { value: endpoint.toString() };
}

function readRequestTimeout(env) {
  const configured = getTrimmedEnv(
    env,
    'WHATSAPP_ROLLOUT_REQUEST_TIMEOUT_MS',
  );

  if (!configured) return { value: DEFAULT_REQUEST_TIMEOUT_MS };

  const parsed = Number(configured);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < MIN_REQUEST_TIMEOUT_MS ||
    parsed > MAX_REQUEST_TIMEOUT_MS
  ) {
    return { errorCode: 'REQUEST_TIMEOUT_INVALID' };
  }

  return { value: parsed };
}

export function readScheduledRolloutConfig(env = process.env) {
  const endpoint = readEndpointUrl(env);

  if (endpoint.errorCode) return endpoint;

  const automationSecret = getTrimmedEnv(env, 'AUTOMATION_SECRET');

  if (!automationSecret || isPoisonValue(automationSecret)) {
    return { errorCode: 'AUTOMATION_SECRET_NOT_CONFIGURED' };
  }

  if (!isEnabled(getTrimmedEnv(env, 'WHATSAPP_LIVE_SEND_ENABLED'))) {
    return { errorCode: 'WHATSAPP_LIVE_SEND_DISABLED' };
  }

  if (!isEnabled(getTrimmedEnv(env, 'WHATSAPP_ROLLOUT_WORKER_ENABLED'))) {
    return { errorCode: 'WHATSAPP_ROLLOUT_WORKER_DISABLED' };
  }

  const timeout = readRequestTimeout(env);

  if (timeout.errorCode) return timeout;

  return {
    endpointUrl: endpoint.value,
    automationSecret,
    timeoutMilliseconds: timeout.value,
  };
}

function getLoggerMethod(logger, method) {
  return typeof logger?.[method] === 'function'
    ? logger[method].bind(logger)
    : () => {};
}

function logConfigurationFailure(logger, errorCode) {
  getLoggerMethod(logger, 'error')(
    `[AUTOMATION-ROLLOUT-SCHEDULED] configuration_failed code=${errorCode}`,
  );
}

function logBlockedRun(logger, errorCode) {
  getLoggerMethod(logger, 'warn')(
    `[AUTOMATION-ROLLOUT-SCHEDULED] blocked code=${errorCode}`,
  );
}

function logRequestFailure(logger, status) {
  getLoggerMethod(logger, 'error')(
    `[AUTOMATION-ROLLOUT-SCHEDULED] request_failed status=${status}`,
  );
}

function logResponseRejected(logger, status, code) {
  getLoggerMethod(logger, 'error')(
    `[AUTOMATION-ROLLOUT-SCHEDULED] response_rejected status=${status} code=${code}`,
  );
}

function logCompletedRun(logger, counts) {
  getLoggerMethod(logger, 'info')(
    `[AUTOMATION-ROLLOUT-SCHEDULED] completed ` +
      `examined=${counts.examined} ` +
      `skipped=${counts.skipped} ` +
      `sent=${counts.sent} ` +
      `unconfirmed=${counts.unconfirmed}`,
  );
}

function validateRolloutResponse(status, body) {
  if (!Number.isInteger(status) || status < 200 || status >= 300) {
    return { errorCode: 'HTTP_REQUEST_FAILED' };
  }

  if (
    !body ||
    body.ok !== true ||
    body.mode !== 'live' ||
    body.dryRun !== false
  ) {
    return { errorCode: 'INVALID_ROLLOUT_RESPONSE' };
  }

  const counts = body.counts;
  const countNames = ['examined', 'skipped', 'sent', 'unconfirmed'];

  if (
    !counts ||
    countNames.some(
      (name) =>
        !Number.isSafeInteger(counts[name]) ||
        counts[name] < 0,
    )
  ) {
    return { errorCode: 'INVALID_ROLLOUT_COUNTS' };
  }

  if (counts.sent > 1) {
    return { errorCode: 'ROLLOUT_SEND_CAP_VIOLATED' };
  }

  if (counts.unconfirmed > 0) {
    return { errorCode: 'UNCONFIRMED_SEND' };
  }

  return { counts };
}

export async function runScheduledLesson1Rollout({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const config = readScheduledRolloutConfig(env);

  if (config.errorCode) {
    const intentionalPause =
      config.errorCode === 'WHATSAPP_LIVE_SEND_DISABLED' ||
      config.errorCode === 'WHATSAPP_ROLLOUT_WORKER_DISABLED';

    if (intentionalPause) {
      logBlockedRun(logger, config.errorCode);
    } else {
      logConfigurationFailure(logger, config.errorCode);
    }

    return {
      ok: false,
      exitCode: intentionalPause
        ? SCHEDULED_ROLLOUT_EXIT_CODES.SUCCESS
        : SCHEDULED_ROLLOUT_EXIT_CODES.FAILURE,
      errorCode: config.errorCode,
      requestCount: 0,
    };
  }

  if (typeof fetchImpl !== 'function') {
    logConfigurationFailure(logger, 'FETCH_UNAVAILABLE');
    return {
      ok: false,
      exitCode: SCHEDULED_ROLLOUT_EXIT_CODES.FAILURE,
      errorCode: 'FETCH_UNAVAILABLE',
      requestCount: 0,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.timeoutMilliseconds,
  );

  let response;

  try {
    response = await fetchImpl(config.endpointUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.automationSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        liveSend: true,
        limit: 1,
      }),
      redirect: 'error',
      signal: controller.signal,
    });
  } catch {
    logRequestFailure(logger, 'NETWORK_OR_TIMEOUT');
    return {
      ok: false,
      exitCode: SCHEDULED_ROLLOUT_EXIT_CODES.FAILURE,
      errorCode: 'REQUEST_FAILED',
      requestCount: 1,
    };
  } finally {
    clearTimeout(timeout);
  }

  let body;

  try {
    body = await response.json();
  } catch {
    logResponseRejected(logger, response.status, 'INVALID_JSON');
    return {
      ok: false,
      exitCode: SCHEDULED_ROLLOUT_EXIT_CODES.FAILURE,
      errorCode: 'INVALID_JSON',
      requestCount: 1,
    };
  }

  const validated = validateRolloutResponse(response.status, body);

  if (validated.errorCode) {
    logResponseRejected(logger, response.status, validated.errorCode);
    return {
      ok: false,
      exitCode: SCHEDULED_ROLLOUT_EXIT_CODES.FAILURE,
      errorCode: validated.errorCode,
      requestCount: 1,
    };
  }

  logCompletedRun(logger, validated.counts);

  return {
    ok: true,
    exitCode: SCHEDULED_ROLLOUT_EXIT_CODES.SUCCESS,
    counts: validated.counts,
    requestCount: 1,
  };
}

function isMainModule() {
  const invokedPath = process.argv[1];

  return (
    typeof invokedPath === 'string' &&
    fileURLToPath(import.meta.url) === path.resolve(invokedPath)
  );
}

if (isMainModule()) {
  const result = await runScheduledLesson1Rollout();
  process.exitCode = result.exitCode;
}