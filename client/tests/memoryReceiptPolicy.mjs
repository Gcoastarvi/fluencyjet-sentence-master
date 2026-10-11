// Test-only policy. No environment reads, credentials, HTTP client or live mode.
export const MEMORY_RECEIPT_PIXEL = "1998316064175555";
export const MEMORY_GRAPH_ENDPOINT =
  `https://graph.facebook.com/v26.0/${MEMORY_RECEIPT_PIXEL}/events`;
export const MOCK_RECEIPT_CONTEXT = Object.freeze({
  mode: "mock", consentAcknowledged: true,
  privateStore: "offline-placeholder-store",
  accessToken: "offline-placeholder-not-a-credential",
  testEventCode: "OFFLINE_MEMORY_TEST",
  matchingKind: "synthetic",
});

export function requireMockReceipt(context) {
  if (!context || context.mode !== "mock") {
    throw new Error("Real receipt disabled: separate owner approval and authenticated exact-egress broker required");
  }
  if (context.consentAcknowledged !== true ||
      context.privateStore !== "offline-placeholder-store" ||
      context.accessToken !== MOCK_RECEIPT_CONTEXT.accessToken ||
      context.testEventCode !== MOCK_RECEIPT_CONTEXT.testEventCode ||
      context.matchingKind !== "synthetic") {
    throw new Error("Mock receipt requires explicit synthetic consent, placeholder-only store/token and test code");
  }
  return context;
}

export function assertMockLaunch(args) {
  if (args.length !== 2 || !args.includes("--mock") ||
      !args.includes("--acknowledge-synthetic-consent")) {
    throw new Error("Off by default. Only --mock --acknowledge-synthetic-consent is supported; real sends unavailable");
  }
}

const privateKey = /name|email|phone|contact|token|password|score|answer|student|learner/i;
export function assertPrivateParamsAbsent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Event parameters must be a plain object");
  }
  for (const [key, nested] of Object.entries(value)) {
    if (key !== "content_name" && privateKey.test(key)) {
      throw new Error("Sensitive event parameter rejected");
    }
    if (nested && typeof nested === "object") {
      if (Array.isArray(nested)) {
        for (const item of nested) {
          if (item && typeof item === "object") assertPrivateParamsAbsent(item);
        }
      } else assertPrivateParamsAbsent(nested);
    }
  }
}

// Pure candidate request policy, NOT an egress firewall or permission to send.
export function inspectBrowserMetaRequest(rawUrl, method = "GET", body = "") {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash) {
    throw new Error("Noncanonical Meta URL denied");
  }
  if (method === "GET" && url.hostname === "connect.facebook.net" &&
      (url.pathname === "/en_US/fbevents.js" ||
       url.pathname === `/signals/config/${MEMORY_RECEIPT_PIXEL}`)) {
    // SDK plugins/config variations are deliberately NOT broadly allowed.
    return { kind: "sdk", path: url.pathname };
  }
  if (!["facebook.com", "www.facebook.com"].includes(url.hostname) ||
      !["/tr", "/tr/"].includes(url.pathname) || !["GET", "POST"].includes(method)) {
    throw new Error("Non-Memory SDK/tracker request denied");
  }
  const params = new URLSearchParams(url.search);
  if (body) {
    for (const [key, value] of new URLSearchParams(body)) params.append(key, value);
  }
  if (params.getAll("id").length !== 1 || params.get("id") !== MEMORY_RECEIPT_PIXEL) {
    throw new Error("Foreign or ambiguous pixel destination denied");
  }
  const event = params.get("ev");
  if (params.getAll("ev").length !== 1 ||
      !["PageView", "Lead", "InitiateCheckout"].includes(event)) {
    throw new Error("Receipt mode permits only requested standard browser events");
  }
  for (const key of params.keys()) {
    const nested = key.match(/^cd\[([^\]]+)\]/)?.[1];
    if (/^ud(?:\[|$)/.test(key) || /^(email|phone|contact|score|token)$/i.test(key) ||
        (nested && nested !== "content_name" && privateKey.test(nested))) {
      throw new Error("Sensitive SDK wire parameter rejected");
    }
  }
  const source = new URL(params.get("dl"));
  if (source.origin !== "http://127.0.0.1:3000" || source.search || source.hash ||
      !["/memory-challenge/result", "/memory-challenge/video/school",
        "/memory-challenge/video/advanced"].includes(source.pathname)) {
    throw new Error("Foreign funnel, identity-bearing or unapproved source URL denied");
  }
  if (params.has("cd")) assertPrivateParamsAbsent(JSON.parse(params.get("cd")));
  return { kind: "tracker", pixel: params.get("id"), event, path: source.pathname };
}

export function inspectGraphRequest(url, options, context) {
  requireMockReceipt(context);
  if (url !== MEMORY_GRAPH_ENDPOINT || options?.method !== "POST" ||
      options.redirect !== "error" ||
      options.headers?.Authorization !== `Bearer ${context.accessToken}`) {
    throw new Error("Wrong Graph destination, authentication or redirect policy");
  }
  const body = JSON.parse(options.body);
  const event = body.data?.[0];
  if (body.test_event_code !== context.testEventCode || body.data?.length !== 1 ||
      event?.event_name !== "Purchase" || event.action_source !== "website" ||
      event.custom_data?.value !== 99 || event.custom_data.currency !== "INR" ||
      !/^memory_masterclass_99_purchase_/.test(event.event_id) ||
      !Number.isInteger(event.event_time) ||
      Math.abs(Math.floor(Date.now() / 1000) - event.event_time) > 300) {
    throw new Error("Invalid standard Memory Purchase/test-code payload");
  }
  const source = new URL(event.event_source_url);
  if (source.href !== "https://www.fluencyjet.com/memory-masterclass/thank-you") {
    throw new Error("Unexpected Purchase source");
  }
  assertPrivateParamsAbsent(event.custom_data);
  if (!Array.isArray(event.user_data?.em) ||
      !event.user_data.em.every(hash => /^[a-f0-9]{64}$/.test(hash)) ||
      typeof event.user_data.client_user_agent !== "string" ||
      !event.user_data.client_user_agent) {
    throw new Error("Missing hashed consenting fixture email or browser context");
  }
  return { event: event.event_name, pixel: MEMORY_RECEIPT_PIXEL,
    value: 99, currency: "INR", eventId: event.event_id };
}

// The production helper does not specify redirect handling. QA must enforce it
// at its transport boundary, without altering the helper or legacy FJ behavior.
// This returns a descriptor ONLY; it cannot perform HTTP or authorize live mode.
export function prepareMockGraphReceipt(url, options, context) {
  const safeOptions = { ...options, redirect: "error" };
  return { summary: inspectGraphRequest(url, safeOptions, context), options: safeOptions };
}
