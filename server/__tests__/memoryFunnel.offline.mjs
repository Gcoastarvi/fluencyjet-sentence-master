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
async function fixture({ granted = true, adult = true, revoked = false, responseStatus = 200 } = {}) {
  const calls = [], rows = [], handlers = [], claims = [], logs = [];
  let clock = Date.now();
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const env = { RAZORPAY_WEBHOOK_SECRET: "offline-webhook-fixture", MEMORY_META_CAPI_ACCESS_TOKEN: "offline-not-a-real-token" };
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
  const consentService = cache.get(resolve(root, "services/memoryMetaConsent.js")).namespace;
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
  return { calls, rows, claims, intent, consent, db, env, delivery, config, capture, logs, consentService, setClock: value => { clock = +new Date(value); } };
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


// Ten independent new buyers: each genuine capture is recorded once, no permission
// is inferred from their details, the Parents route, payment or abandoned flags.
test("ten first-time captures without authorization: ten accounting rows, zero CAPI events", async()=>{
  let recorded=0, delivered=0;
  for(let i=0;i<10;i++) {
    const f=await fixture({granted:false}); f.intent.metaConsentId=null; f.intent.metaConsentVersion=null;
    f.env.MEMORY_META_ADULT_PURCHASE_ENABLED="true"; // abandoned flags have no effect
    await f.capture(); await f.capture();
    recorded+=f.rows.length; delivered+=f.calls.length;
    assert.equal(f.rows[0].metaDeliveryStatus,"SKIPPED_CONSENT"); assert.equal(f.rows[0].metaAttempts,0);
  }
  assert.equal(recorded,10); assert.equal(delivered,0);
});
test("explicit checkout refusal and GPC cannot reuse an existing grant",async()=>{
  for(const options of [{measurementRefused:true},{adultParentOwnContactIndia:false},{gpc:true}]){
    const f=await fixture();
    const snapshot=await f.consentService.memoryPurchaseConsentSnapshot({memoryMetaConsentReceipt:"a".repeat(64),...options},f.intent,
      {db:f.db,env:f.env,gpc:options.gpc});
    Object.assign(f.intent,snapshot); await f.capture(); assert.equal(f.rows.length,1); assert.equal(f.calls.length,0);
  }
});
test("buyer-linked declined receipt blocks sharing without rewriting history",async()=>{
  const f=await fixture();
  f.db.memoryMasterclassCheckoutIntent.findMany=async()=>[{metaConsentId:"old-decline"}];
  f.db.memoryMetaConsent.findFirst=async()=>({id:"old-decline"});
  await f.capture(); assert.equal(f.rows.length,1); assert.equal(f.calls.length,0);
});
test("withdrawal after an order is rechecked before delivery",async()=>{
  const f=await fixture(); f.consent.revokedAt=new Date(); f.consent.granted=false;
  await f.capture(); assert.equal(f.rows.length,1); assert.equal(f.calls.length,0);
});
test("emergency sharing block withholds even valid consent, payment still recorded",async()=>{
  const f=await fixture(); f.env.MEMORY_META_PURCHASE_SHARING_BLOCKED="true";
  await f.capture(); assert.equal(f.rows.length,1); assert.equal(f.calls.length,0);
});
test("May 13 deadline cannot enable an alternative; existing adult consent still works",async()=>{
  for(const granted of [true,false]) {
    const f=await fixture({granted}); f.consent.expiresAt=new Date("2027-06-01");
    f.setClock("2027-05-13T00:00:00+05:30");
    f.env.MEMORY_META_ADULT_PURCHASE_ENABLED="true";
    await f.capture(); assert.equal(f.calls.length,granted?1:0);
  }
});
