import crypto from "node:crypto";
import prisma from "../db/client.js";
import { sendCapiPurchase } from "../lib/metaCapi.js";
import { getCapiDestination } from "../config/metaTracking.js";
import { memoryPurchaseEligibility } from "./memoryMetaConsent.js";
const MEMORY_MASTERCLASS_EVENT_SOURCE_URL = "https://www.fluencyjet.com/memory-masterclass/thank-you";
const MEMORY_MASTERCLASS_CONTENT_NAME = "Amaze Memory Live Study Memory Class";

const PRODUCT = "memory_masterclass_99";
export const RETRY_DELAYS = [60000, 300000, 900000, 3600000, 14400000];
export const DELIVERY_WINDOW_MS = 24 * 3600000;
const due = now => ({ OR: [
  { metaDeliveryStatus: { in: ["PENDING", "RETRY"] }, metaNextAttemptAt: { lte: now } },
  { metaDeliveryStatus: "SENDING", metaLeaseExpiresAt: { lte: now } },
] });

export async function deliverMemoryPurchase(id, {
  db = prisma, send = sendCapiPurchase, now = () => new Date(), env = process.env,
} = {}) {
  const destination = getCapiDestination(PRODUCT, env);
  if (!destination.enabled) return { skipped: true, reason: destination.reason };
  const time = now(), lease = crypto.randomBytes(16).toString("hex");
  const claim = await db.memoryMasterclassPurchase.updateMany({
    where: { id, productKey: PRODUCT, status: "captured", amount: 9900, currency: "INR",
      metaDelivered: false, metaAttempts: { lt: 6 }, ...due(time) },
    data: { metaDeliveryStatus: "SENDING", metaLeaseToken: lease,
      metaLeaseExpiresAt: new Date(time.getTime() + 60000), metaAttempts: { increment: 1 } },
  });
  if (claim.count !== 1) return { skipped: true, reason: "not_claimed" };
  const finish = data => db.memoryMasterclassPurchase.updateMany({
    where: { id, metaLeaseToken: lease, metaDeliveryStatus: "SENDING" },
    data: { ...data, metaLeaseToken: null, metaLeaseExpiresAt: null },
  });
  try {
    const row = await db.memoryMasterclassPurchase.findUnique({
      where: { id }, include: { checkoutIntent: true },
    });
    if (!row?.metaEventId || !row.metaEventTime ||
        now().getTime() - new Date(row.metaEventTime).getTime() >= DELIVERY_WINDOW_MS) {
      await finish({ metaDeliveryStatus: "EXPIRED", metaLastErrorCode: "EVENT_WINDOW" });
      return { skipped: true, reason: "expired" };
    }
    const eligibility = await memoryPurchaseEligibility(row, { db, env, now: now() });
    if (!eligibility.authorized) {
      await finish({ metaDeliveryStatus: "SKIPPED_CONSENT", metaLastErrorCode: eligibility.reason });
      return { skipped: true, reason: "consent_inactive" };
    }
    // Only the currently authorized adult purchaser, never a student or
    // another payer's provider identity. Checkout snapshots are server-validated.
    const result = await send({
      ...destination, eventId: row.metaEventId, eventTime: new Date(row.metaEventTime).getTime(),
      eventSourceUrl: MEMORY_MASTERCLASS_EVENT_SOURCE_URL, value: 99, currency: "INR",
      contentName: MEMORY_MASTERCLASS_CONTENT_NAME, contentIds: [PRODUCT],
      email: row.purchaserEmail, phone: row.purchaserPhone,
      // Browser identifiers may originate from a child's assessment session.
      // Only approved adult purchaser contacts are used for matching.
      externalId: null, fbc: null, fbp: null,
      clientIpAddress: null, clientUserAgent: null,
    });
    if (result.ok) {
      await finish({ metaDelivered: true, metaDeliveryStatus: "DELIVERED",
        metaDeliveredAt: now(), metaLastErrorCode: null });
      console.log(`[memory-meta] DELIVERED event=${row.metaEventId} dataset=1998316064175555 value=99 currency=INR source=${eligibility.source}`);
      return { delivered: true };
    }
    const retryable = result.transient === true || result.status === 0 ||
      result.status === 429 || result.status >= 500;
    const delay = RETRY_DELAYS[row.metaAttempts - 1];
    const status = retryable && delay ? "RETRY" : "FAILED";
    await finish({ metaDeliveryStatus: status,
      metaNextAttemptAt: status === "RETRY" ? new Date(now().getTime() + delay + crypto.randomInt(1000)) : null,
      metaLastErrorCode: `HTTP_${result.status || 0}` });
    console.warn(`[memory-meta] delivery ${status} event=${row.metaEventId} code=HTTP_${result.status || 0}`);
    return { delivered: false, status };
  } catch {
    // DB/transport crashes never erase the pending record. A lease can be
    // reclaimed; preserve the event ID/time even if the response was lost.
    await finish({ metaDeliveryStatus: "RETRY", metaNextAttemptAt: new Date(now().getTime() + 60000),
      metaLastErrorCode: "PROCESSING_ERROR" });
    return { delivered: false, status: "RETRY" };
  }
}

export async function runMemoryMetaDelivery(options = {}) {
  const db = options.db || prisma, now = options.now?.() || new Date();
  if (!getCapiDestination(PRODUCT, options.env || process.env).enabled) return 0;
  await db.memoryMasterclassPurchase.updateMany({
    where: { productKey: PRODUCT, metaDelivered: false, metaAttempts: { gte: 6 },
      OR: [{ metaDeliveryStatus: "SENDING", metaLeaseExpiresAt: { lte: now } },
        { metaDeliveryStatus: { in: ["PENDING", "RETRY"] }, metaNextAttemptAt: { lte: now } }] },
    data: { metaDeliveryStatus: "FAILED", metaLastErrorCode: "ATTEMPTS_EXHAUSTED",
      metaLeaseToken: null, metaLeaseExpiresAt: null },
  });
  const rows = await db.memoryMasterclassPurchase.findMany({
    where: { productKey: PRODUCT, metaDelivered: false, metaAttempts: { lt: 6 }, ...due(now) },
    select: { id: true }, take: 5, orderBy: { createdAt: "asc" },
  });
  for (const row of rows) await deliverMemoryPurchase(row.id, options);
  return rows.length;
}

export function startMemoryMetaDelivery() {
  if (process.env.MEMORY_META_DELIVERY_ENABLED !== "true") return () => {};
  let stopped = false, timer;
  const tick = async () => {
    try { await runMemoryMetaDelivery(); } catch { console.warn("[memory-meta] worker unavailable; pending records retained"); }
    if (!stopped) { timer = setTimeout(tick, 30000); timer.unref(); }
  };
  timer = setTimeout(tick, 1000); timer.unref();
  return () => { stopped = true; clearTimeout(timer); };
}

