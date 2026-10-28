// Dependency-free execution of the actual production webhook, delivery worker,
// consent checks and CAPI serializer. No Prisma client, HTTP server or provider.
// Run: node --experimental-vm-modules --test server/__tests__/memoryFunnel.offline.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
async function fixture({ granted = true, adult = true, revoked = false, responseStatus = 200, alternative = false } = {}) {
  const calls = [], rows = [], handlers = [], claims = [], logs = [], authorizations = [];
  let clock = Date.now(), policy;
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const env = { RAZORPAY_WEBHOOK_SECRET: "offline-webhook-fixture", MEMORY_META_CAPI_ACCESS_TOKEN: "offline-not-a-real-token" };
  if (alternative) { env.MEMORY_META_ADULT_PURCHASE_ENABLED = "true"; env.MEMORY_META_ADULT_PURCHASE_POLICY_ID = "offline-reviewed-v1"; }
  const intent = { id: "intent_fixture", razorpayOrderId: "order_fixture", productKey: "memory_masterclass_99",
    amount: 9900, currency: "INR", trackId: "school_foundation", checkoutSource: "standalone_parents",
    purchaserName: "Adult Fixture", purchaserEmail: "adult@example.test", purchaserPhone: "+919111111111",
    metaConsentGranted: granted, metaConsentId: "receipt_fixture", metaConsentVersion: "memory_meta_v1", metaConsentRevision: 1,
    // Deliberate hostile assessment fields must never leave the serializer.
    visitorId: "PRIVATE_CHILD_BROWSER", fbc: "PRIVATE_CHILD_CLICK", fbp: "PRIVATE_CHILD_COOKIE", clientUserAgent: "PRIVATE_CHILD_UA",
    learnerName: "PRIVATE_CHILD", answers: ["PRIVATE_ANSWER"], score: 72,
  };
  const consent = { granted, adultConfirmed: adult, version: "memory_meta_v1", revision: 1,
    expiresAt: new Date(Date.now() + 86400000), revokedAt: revoked ? new Date() : null };
  const db = {
    memoryAdultPurchasePolicy: { findUnique: async ({where}) => policy?.id === where.id ? policy : null },
    memoryAdultPurchaseAuthorization: {
      findFirst: async ({where}) => authorizations.find(a => a.blockedAt && where.OR.some(part => Object.entries(part).every(([k,v]) => a[k] === v))) || null,
      findUnique: async ({where}) => authorizations.find(a => Object.entries(where).every(([k,v]) => a[k] === v)) || null,
      create: async ({data}) => { const a = { id: `auth_${authorizations.length}`, createdAt: new Date(clock), ...data }; authorizations.push(a); return a; },
      update: async ({where, data}) => { const a = authorizations.find(a => a.id === where.id); Object.assign(a, data); return a; },
    },
    memoryMetaConsent: { findUnique: async () => consent },
    memoryMasterclassCheckoutIntent: { findMany: async () => [], findUnique: async ({where}) => where.razorpayOrderId === intent.razorpayOrderId ? intent : null },
    memoryMasterclassPurchase: {
      findFirst: async () => rows[0] || null,
      create: async ({data}) => { const row = { id: "purchase_fixture", metaAttempts: 0, ...data }; rows.push(row); return row; },
      findUnique: async () => rows[0] ? { ...rows[0], checkoutIntent: intent } : null,
      findMany: async () => rows.filter(r => ["PENDING", "RETRY"].includes(r.metaDeliveryStatus) && r.metaAttempts < 6).map(r => ({ id: r.id })),
      updateMany: async ({where, data}) => {
        claims.push(where);
        const r = rows[0];
        if (!r || !where.id) return { count: 0 };
        if (where.metaLeaseToken && r.metaLeaseToken !== where.metaLeaseToken) return { count: 0 };
        if (data.metaAttempts) {
          if (r.metaDelivered || !["PENDING", "RETRY"].includes(r.metaDeliveryStatus) || r.metaAttempts >= 6) return { count: 0 };
          if (r.amount !== 9900 || r.currency !== "INR" || r.status !== "captured") return { count: 0 };
          r.metaAttempts += data.metaAttempts.increment;
        }
        const { metaAttempts, ...rest } = data; Object.assign(r, rest);
        return { count: 1 };
      },
    },
  };
  const express = { Router: () => ({ get() {}, post: (...args) => handlers.push(args.at(-1)) }), raw: () => () => {} };
  const forbidden = () => { throw new Error("Unexpected non-Memory side effect"); };
  const context = vm.createContext({ Buffer, Date: ClockDate, URL, AbortSignal, setTimeout, clearTimeout,
    console: { warn() {}, log(...args) { logs.push(args.join(" ")); }, error() {} }, process: { env },
    fetch: async (url, options) => {
      calls.push({ url, options, body: JSON.parse(options.body) });
      return { status: responseStatus, ok: responseStatus === 200,
        text: async () => JSON.stringify(responseStatus === 200 ? { events_received: 1 } : { error: { is_transient: true } }) };
    },
  });
  const cache = new Map();
  function synthetic(key, exports) {
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context, identifier: key });
  }
  async function load(key) {
    if (cache.has(key)) return cache.get(key);
    let m;
    if (["crypto", "node:crypto"].includes(key)) m = synthetic(key, { default: crypto });
    else if (key === "express") m = synthetic(key, { default: express });
    else if (key.endsWith("/db/client.js")) m = synthetic(key, { default: db });
    else if (key.endsWith("/lib/whatsappDestinationLock.js")) m = synthetic(key, { acquireWhatsAppDestinationLock: forbidden });
    else if (key.endsWith("/lib/whatsappJourney.js")) m = synthetic(key, {
      ANY_QUESTIONS_REMINDER: "ANY_QUESTIONS_REMINDER", CHECKOUT_HELP_REMINDER: "CHECKOUT_HELP_REMINDER",
      SENTENCE_MASTER_PRODUCT_KEY: "sentence_master", cancelPendingAutomationEvents: forbidden });
    else if (key.endsWith("/lib/purchaseAttribution.js")) m = synthetic(key, {
      findExactSentenceMasterCheckoutIntent: forbidden, getCapturedPaymentTime: forbidden, productKeyForPaymentAmount: forbidden });
    else m = new vm.SourceTextModule(readFileSync(key, "utf8"), { context, identifier: key });
    cache.set(key, m);
    return m;
  }
  const webhook = await load(resolve(root, "routes/webhookRazorpay.js"));
  await webhook.link((specifier, parent) => load(specifier.startsWith(".") ? resolve(dirname(parent.identifier), specifier) : specifier));
  await webhook.evaluate();
  const delivery = cache.get(resolve(root, "services/memoryMetaDelivery.js")).namespace;
  const config = cache.get(resolve(root, "config/metaTracking.js")).namespace;
  const purchasePolicy = cache.get(resolve(root, "services/memoryAdultPurchasePolicy.js")).namespace;
  policy = { id: "offline-reviewed-v1", enabled: true, scope: "IN_ADULT_PARENT_SELF_ATTESTED",
    effectiveAt: new Date(clock - 60000), expiresAt: new Date("2027-05-12T18:30:00Z"),
    reviewDueAt: new Date("2027-05-12T18:29:59Z"), restrictionsCleared: true,
    legalApprovalRef: "OFFLINE-LEGAL-FIXTURE", metaApprovalRef: "OFFLINE-META-TERMS-REVIEW",
    adultEvidenceApprovalRef: "OFFLINE-IDENTITY-REVIEW", authorizationSource: "OFFLINE-REVIEWED-BASIS",
    noticeVersion: purchasePolicy.ADULT_PURCHASE_NOTICE_VERSION, noticeHash: purchasePolicy.ADULT_PURCHASE_NOTICE_HASH };
  async function authorize(extra = {}) {
    intent.metaConsentGranted = false; intent.metaConsentId = null;
    intent.memoryAssessmentSessionId = null; intent.trackId = "school_unspecified";
    const body = { adultParentOwnContactIndia: true, policyId: policy.id, noticeVersion: policy.noticeVersion,
      noticeHash: policy.noticeHash, ...extra };
    const response = await purchasePolicy.createAdultPurchaseAuthorization(body, intent, { db, env, now: new Date(clock) });
    intent.purchaseMeasurement = await purchasePolicy.checkoutPurchaseMeasurement({ ...body, purchaseAuthorizationToken: response.token, measurementRefused: extra.refused },
      intent, { db, env, parents: true, now: new Date(clock) });
    return response;
  }
  async function capture({ event = "payment.captured", status = "captured", amount = 9900, signature = true } = {}) {
    const body = Buffer.from(JSON.stringify({ event, created_at: Math.floor(clock/1000), payload: { payment: { entity: {
      id: "pay_fixture", order_id: "order_fixture", amount, currency: "INR", status,
      email: "PRIVATE_PROVIDER_IDENTITY", contact: "PRIVATE_PROVIDER_CONTACT",
    } } } }));
    const req = { body, headers: { "x-razorpay-event-id": "webhook_fixture",
      "x-razorpay-signature": signature ? crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex") : "bad" } };
    const res = { code: 200, status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; } };
    await handlers[0](req, res); return res;
  }
  return { calls, rows, claims, intent, consent, db, env, delivery, config, capture, logs, policy, purchasePolicy, authorizations, authorize, setClock: value => { clock = +new Date(value); } };
}

test("signed capture records once; webhook repeats send one stable adult Purchase to BrainoDad", async () => {
  const f = await fixture(); await f.capture(); await f.capture();
  assert.equal(f.rows.length, 1); assert.equal(f.calls.length, 1);
  assert.match(f.calls[0].url, /\/v26\.0\/1998316064175555\/events$/);
  const e = f.calls[0].body.data[0];
  assert.equal(e.event_name, "Purchase"); assert.equal(e.event_id, "memory_masterclass_99_purchase_pay_fixture");
  assert.equal(e.custom_data.value, 99); assert.equal(e.custom_data.currency, "INR");
  assert.deepEqual([...e.custom_data.content_ids], ["memory_masterclass_99"]);
  assert.equal(f.rows[0].metaDeliveryStatus, "DELIVERED");
  assert.ok(!JSON.stringify(f.calls).includes("PRIVATE_"));
  assert.match(e.user_data.em[0], /^[a-f0-9]{64}$/);
});
for (const options of [{ signature: false }, { event: "payment.failed" }, { status: "failed" }, { amount: 100 }]) {
  test(`invalid/unsuccessful payment cannot become Purchase: ${JSON.stringify(options)}`, async () => {
    const f = await fixture(); await f.capture(options);
    assert.equal(f.rows.length, 0); assert.equal(f.calls.length, 0);
  });
}
for (const options of [{ granted: false }, { adult: false }, { revoked: true }]) {
  test(`ineligible captured purchase is accounted for without sharing: ${JSON.stringify(options)}`, async () => {
    const f = await fixture(options); await f.capture();
    assert.equal(f.rows.length, 1); assert.equal(f.calls.length, 0);
    assert.equal(f.rows[0].metaDeliveryStatus, "SKIPPED_CONSENT");
  });
}
test("transient failure retries with unchanged event identity and time", async () => {
  const f = await fixture({ responseStatus: 503 }); await f.capture();
  assert.equal(f.rows[0].metaDeliveryStatus, "RETRY");
  const first = f.calls[0].body.data[0]; let retry;
  await f.delivery.deliverMemoryPurchase("purchase_fixture", { db: f.db, env: f.env,
    now: () => new Date(Date.now() + 120000), send: async input => { retry = input; return { ok: true }; } });
  assert.equal(retry.eventId, first.event_id); assert.equal(Math.floor(retry.eventTime/1000), first.event_time);
  assert.equal(f.rows[0].metaDeliveryStatus, "DELIVERED");
});
test("concurrent delivery claims are fenced", async () => {
  const f = await fixture({ responseStatus: 503 }); await f.capture(); let sent = 0;
  const options = { db: f.db, env: f.env, send: async () => { sent++; return { ok: true }; } };
  await Promise.all([f.delivery.deliverMemoryPurchase("purchase_fixture", options), f.delivery.deliverMemoryPurchase("purchase_fixture", options)]);
  assert.equal(sent, 1);
});
test("historical skipped purchases are never backfilled after later permission", async () => {
  const f = await fixture({ granted: false }); await f.capture();
  f.consent.granted = true; f.consent.adultConfirmed = true;
  await f.delivery.runMemoryMetaDelivery({ db: f.db, env: f.env });
  assert.equal(f.calls.length, 0); assert.equal(f.rows[0].metaAttempts, 0);
});
test("BrainoDad never falls back to the FluencyJet dataset or token", async () => {
  const f = await fixture();
  assert.equal(f.config.getCapiDestination("memory_masterclass_99", { META_PIXEL_ID: "1246171816816642", META_CAPI_ACCESS_TOKEN: "offline" }).enabled, false);
  assert.equal(f.config.getCapiDestination("memory_masterclass_99", { ...f.env, MEMORY_META_PIXEL_ID: "1246171816816642" }).enabled, false);
});

test("approved alternative: no legacy receipt, captured once, accepted CAPI log and audit evidence", async () => {
  const f = await fixture({ alternative: true });
  const a = await f.authorize(); assert.equal(a.eligible, true);
  await f.capture(); await f.capture();
  assert.equal(f.rows.length, 1); assert.equal(f.rows[0].metaConsentGranted, false);
  assert.equal(f.calls.length, 1); assert.equal(f.rows[0].metaDeliveryStatus, "DELIVERED");
  const e = f.calls[0].body.data[0];
  assert.equal(e.event_id, "memory_masterclass_99_purchase_pay_fixture");
  assert.equal(e.custom_data.value, 99); assert.equal(e.custom_data.currency, "INR");
  assert.match(f.calls[0].url, /1998316064175555\/events$/);
  assert.ok(f.logs.some(l => l.includes("DELIVERED") && l.includes("value=99 currency=INR")));
  assert.equal(f.authorizations[0].evidence.policyVersion, f.policy.id);
  assert.equal(f.authorizations[0].evidence.refusalState, "NO_KNOWN_REFUSAL");
  assert.ok(!JSON.stringify(f.calls).includes("PRIVATE_"));
  assert.ok(!JSON.stringify(f.calls).includes(a.token));
});

for (const adultParentOwnContactIndia of [false, undefined, "true"]) test(`child or unknown adult declaration blocked: ${adultParentOwnContactIndia}`, async () => {
  const f = await fixture({ alternative: true });
  assert.equal((await f.authorize({ adultParentOwnContactIndia })).eligible, false);
  await f.capture(); assert.equal(f.rows.length, 1); assert.equal(f.calls.length, 0);
});

test("explicit refusal persists and blocks alternative AND later valid browser consent", async () => {
  const f = await fixture({ alternative: true }); await f.authorize({ refused: true });
  f.intent.metaConsentGranted = true; f.intent.metaConsentId = "receipt_fixture";
  await f.capture(); assert.equal(f.calls.length, 0);
  assert.ok(f.authorizations[0].blockedAt);
});

test("withdrawal between checkout and capture blocks without stopping payment accounting", async () => {
  const f = await fixture({ alternative: true }); const a = await f.authorize();
  await f.purchasePolicy.withdrawAdultPurchaseAuthorization(a.token, { db: f.db });
  await f.capture(); assert.equal(f.rows.length, 1); assert.equal(f.calls.length, 0);
});

test("alternative retry rechecks live policy and retains stable ID/time", async () => {
  const f = await fixture({ alternative: true, responseStatus: 503 }); await f.authorize(); await f.capture();
  assert.equal(f.rows[0].metaDeliveryStatus, "RETRY");
  const first = f.calls[0].body.data[0]; let accepted;
  await f.delivery.deliverMemoryPurchase("purchase_fixture", { db: f.db, env: f.env,
    now: () => new Date(Date.now() + 120000), send: async input => { accepted = input; return { ok: true }; } });
  assert.equal(accepted.eventId, first.event_id); assert.equal(Math.floor(accepted.eventTime/1000), first.event_time);
});

for (const disable of ["environment", "database", "global", "deadline"]) test(`live disable/expiry blocks pending alternative: ${disable}`, async () => {
  const f = await fixture({ alternative: true, responseStatus: 503 }); await f.authorize(); await f.capture();
  if (disable === "environment") f.env.MEMORY_META_ADULT_PURCHASE_ENABLED = "false";
  if (disable === "database") f.policy.enabled = false;
  if (disable === "global") f.env.MEMORY_META_PURCHASE_SHARING_BLOCKED = "true";
  const now = disable === "deadline" ? new Date("2027-05-13T00:00:00+05:30") : new Date(Date.now() + 120000);
  if (disable === "deadline") f.rows[0].metaEventTime = new Date(now.getTime() - 120000);
  let sent = 0;
  await f.delivery.deliverMemoryPurchase("purchase_fixture", { db: f.db, env: f.env, now: () => now,
    send: async () => { sent++; return { ok: true }; } });
  assert.equal(sent, 0); assert.equal(f.rows[0].metaDeliveryStatus, "SKIPPED_CONSENT");
});

test("May 13 deadline falls back to still-valid existing adult consent", async () => {
  const f = await fixture({ alternative: true });
  f.consent.expiresAt = new Date("2027-06-01");
  f.setClock("2027-05-13T00:00:00+05:30");
  await f.capture(); assert.equal(f.calls.length, 1);
});

test("alternative disabled without consent does not queue; cannot manufacture approval", async () => {
  const f = await fixture(); assert.equal((await f.authorize({ approved: true })).eligible, false);
  await f.capture(); assert.equal(f.calls.length, 0); assert.equal(f.rows[0].metaAttempts, 0);
});

test("missing legal/Meta/adult-evidence approval, altered notice or review expiry fails closed", async () => {
  for (const field of ["legalApprovalRef", "metaApprovalRef", "adultEvidenceApprovalRef", "noticeHash", "restrictionsCleared"]) {
    const f = await fixture({ alternative: true }); f.policy[field] = field === "restrictionsCleared" ? false : "";
    assert.equal((await f.authorize()).eligible, false, field);
  }
  const f = await fixture({ alternative: true }); f.policy.reviewDueAt = new Date(0);
  assert.equal((await f.authorize()).eligible, false);
});

test("wrong contact, stale token and assessment-linked checkout cannot use alternative authorization", async () => {
  const f = await fixture({ alternative: true }); const a = await f.authorize();
  f.intent.purchaserEmail = "someone-else@example.test";
  await f.capture(); assert.equal(f.calls.length, 0);
  const g = await fixture({ alternative: true }); await g.authorize(); g.intent.memoryAssessmentSessionId = "child-session";
  await g.capture(); assert.equal(g.calls.length, 0);
  const h = await fixture({ alternative: true }); const token = (await h.authorize()).token;
  assert.equal((await h.purchasePolicy.checkoutPurchaseMeasurement({ purchaseAuthorizationToken: token }, h.intent,
    { db: h.db, env: h.env, parents: true, now: new Date(Date.now()+3600000) })).alternativeId, null);
});

test("alternative eligibility never turns failed payment into Purchase", async () => {
  const f = await fixture({ alternative: true }); await f.authorize(); await f.capture({ event: "payment.failed" });
  assert.equal(f.rows.length, 0); assert.equal(f.calls.length, 0);
});

test("enabling an alternative policy never revives historical skipped captures", async () => {
  const f = await fixture({ granted: false }); await f.capture();
  f.env.MEMORY_META_ADULT_PURCHASE_ENABLED = "true"; f.env.MEMORY_META_ADULT_PURCHASE_POLICY_ID = f.policy.id;
  await f.authorize(); await f.delivery.runMemoryMetaDelivery({ db: f.db, env: f.env });
  assert.equal(f.calls.length, 0); assert.equal(f.rows[0].metaAttempts, 0);
});


test("buyer-linked historical declines block a new alternative without changing old records", async () => {
  const f = await fixture({ alternative: true });
  f.db.memoryMasterclassCheckoutIntent.findMany = async () => [{ metaConsentId: "old-decline" }];
  f.db.memoryMetaConsent.findFirst = async () => ({ id: "old-decline" });
  assert.equal((await f.authorize()).eligible, false);
  await f.capture(); assert.equal(f.calls.length, 0); assert.equal(f.rows.length, 1);
});

test("unknown or declined supplied receipt cannot authorize an alternative", async () => {
  for (const choice of [null, { granted: false }, { granted: true, revokedAt: new Date() }]) {
    const f = await fixture({ alternative: true });
    f.db.memoryMetaConsent.findUnique = async () => choice;
    assert.equal((await f.authorize({ memoryMetaChoiceReceipt: "a".repeat(64) })).eligible, false);
    await f.capture(); assert.equal(f.calls.length, 0);
  }
});

test("GPC blocks both paths and approved policy evidence cannot be changed after checkout", async () => {
  const f = await fixture({ alternative: true }); await f.authorize();
  const audit = await f.purchasePolicy.checkoutPurchaseMeasurement({}, f.intent, {db:f.db, env:f.env, gpc:true});
  assert.equal(audit.blocked, true);
  f.intent.purchaseMeasurement = audit; await f.capture(); assert.equal(f.calls.length, 0);
  const g = await fixture({ alternative: true }); await g.authorize();
  g.policy.authorizationSource = "different-basis";
  await g.capture(); assert.equal(g.calls.length, 0);
});
