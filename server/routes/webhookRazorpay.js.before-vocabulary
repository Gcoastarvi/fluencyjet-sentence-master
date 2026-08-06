import express from "express";
import crypto from "crypto";
import prisma from "../db/client.js";
import { sendCapiPurchase } from "../lib/metaCapi.js";

const router = express.Router();

const EXPECTED_AMOUNT_PAISE = 119900;
const EXPECTED_CURRENCY = "INR";
const EXPECTED_EVENT = "payment.captured";
const CAPI_EVENT_SOURCE_URL =
  "https://www.fluencyjet.com/spoken-english-thank-you";
const CAPI_CONTENT_NAME = "FluencyJet Sentence Master";
const CAPI_CONTENT_IDS = ["sentence_master_1199"];

/**
 * POST /api/webhooks/razorpay
 *
 * Receives payment.captured from Razorpay.
 * express.raw() is applied per-route so this handler receives the raw
 * Buffer needed for HMAC verification.
 * This route MUST be mounted in index.js BEFORE global express.json().
 */
router.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature  = req.headers["x-razorpay-signature"] || "";
    const eventId    = req.headers["x-razorpay-event-id"]  || "";
    const rawBody    = req.body;

    if (!signature || !rawBody || rawBody.length === 0) {
      console.warn("[webhook/rzp] Missing signature or empty body");
      return res.status(400).json({ ok: false, error: "Missing signature" });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[webhook/rzp] RAZORPAY_WEBHOOK_SECRET not set");
      return res.status(500).json({ ok: false, error: "Server misconfiguration" });
    }

    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expected !== signature) {
      console.warn("[webhook/rzp] Signature mismatch — rejected");
      return res.status(400).json({ ok: false, error: "Invalid signature" });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      console.warn("[webhook/rzp] Body is not valid JSON after signature passed");
      return res.status(400).json({ ok: false, error: "Invalid JSON" });
    }

    const event = payload.event;

    if (event !== EXPECTED_EVENT) {
      console.log(`[webhook/rzp] Ignored event type: ${event}`);
      return res.status(200).json({ ok: true, skipped: true });
    }

    const paymentEntity = payload?.payload?.payment?.entity;

    if (!paymentEntity?.id) {
      console.warn("[webhook/rzp] Missing payment entity in payload");
      return res.status(400).json({ ok: false, error: "Missing payment entity" });
    }

    const paymentId       = paymentEntity.id;
    const amount          = paymentEntity.amount;
    const currency        = paymentEntity.currency;
    const paymentStatus   = paymentEntity.status;
    const customerEmail   = paymentEntity.email   || null;
    const customerContact = paymentEntity.contact  || null;
    const paymentLinkId   = null; // payment.captured carries no page/link entity

    const dedupKey = eventId || `noeid_${paymentId}`;

    try {
      const existing = await prisma.spokenEnglishPurchase.findFirst({
        where: {
          OR: [
            { webhookEventId: dedupKey },
            { paymentId },
          ],
        },
        select: { id: true },
      });
      if (existing) {
        console.log(`[webhook/rzp] Duplicate — already processed paymentId=${paymentId}`);
        return res.status(200).json({ ok: true, duplicate: true });
      }
    } catch (err) {
      console.error("[webhook/rzp] Idempotency check failed:", err.message);
      return res.status(500).json({ ok: false, error: "DB error" });
    }

    if (amount !== EXPECTED_AMOUNT_PAISE) {
      console.warn(`[webhook/rzp] Amount mismatch: ${amount} paise (expected ${EXPECTED_AMOUNT_PAISE})`);
      return res.status(200).json({ ok: true, skipped: true, reason: "amount_mismatch" });
    }
    if (currency !== EXPECTED_CURRENCY) {
      console.warn(`[webhook/rzp] Currency mismatch: ${currency}`);
      return res.status(200).json({ ok: true, skipped: true, reason: "currency_mismatch" });
    }
    if (paymentStatus !== "captured" && paymentStatus !== "authorized") {
      console.warn(`[webhook/rzp] Unexpected payment status: ${paymentStatus}`);
      return res.status(200).json({ ok: true, skipped: true, reason: "status_not_captured" });
    }

    const metaEventId = `se_purchase_${paymentId}`;

    let record;
    try {
      record = await prisma.spokenEnglishPurchase.create({
        data: {
          paymentLinkId,
          paymentId,
          amount,
          currency,
          status: paymentStatus,
          customerEmail,
          customerContact,
          webhookEventId: dedupKey,
          metaEventId,
          metaDelivered: false,
        },
      });
      console.log(`[webhook/rzp] Purchase saved id=${record.id} paymentId=${paymentId}`);
    } catch (err) {
      if (err.code === "P2002") {
        console.log(`[webhook/rzp] Concurrent duplicate insert for paymentId=${paymentId}`);
        return res.status(200).json({ ok: true, duplicate: true });
      }
      console.error("[webhook/rzp] DB create failed:", err.message);
      return res.status(500).json({ ok: false, error: "DB error" });
    }

    const pixelId     = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
      console.warn("[webhook/rzp] META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set — CAPI skipped");
      return res.status(200).json({ ok: true, capiSkipped: true });
    }

    const capiResult = await sendCapiPurchase({
      pixelId,
      accessToken,
      eventId: metaEventId,
      eventTime: Date.now(),
      eventSourceUrl: CAPI_EVENT_SOURCE_URL,
      value: 1199,
      currency: "INR",
      contentName: CAPI_CONTENT_NAME,
      contentIds: CAPI_CONTENT_IDS,
      email: customerEmail,
      phone: customerContact,
    });

    const errorSnippet = capiResult.ok
      ? null
      : (capiResult.body || "").slice(0, 500);

    try {
      await prisma.spokenEnglishPurchase.update({
        where: { id: record.id },
        data: {
          metaDelivered: capiResult.ok,
          metaError: errorSnippet,
          metaResponseCode: capiResult.status || null,
        },
      });
    } catch (err) {
      console.error("[webhook/rzp] Failed to update CAPI status:", err.message);
    }

    if (capiResult.ok) {
      console.log(`[webhook/rzp] CAPI Purchase delivered eventId=${metaEventId} status=${capiResult.status}`);
    } else {
      console.warn(`[webhook/rzp] CAPI delivery failed status=${capiResult.status} error=${errorSnippet}`);
    }

    return res.status(200).json({ ok: true, capiDelivered: capiResult.ok });
  }
);

/**
 * GET /api/webhooks/spoken-english/status
 * Returns the 20 most recent spoken-English purchases + CAPI delivery status.
 * Protected by Authorization: Bearer <ADMIN_SECRET>.
 */
router.get("/spoken-english/status", async (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const authHeader  = req.headers.authorization || "";

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const purchases = await prisma.spokenEnglishPurchase.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        paymentId: true,
        paymentLinkId: true,
        amount: true,
        currency: true,
        status: true,
        metaEventId: true,
        metaDelivered: true,
        metaResponseCode: true,
        metaError: true,
        createdAt: true,
      },
    });

    return res.json({ ok: true, count: purchases.length, purchases });
  } catch (err) {
    console.error("[webhook/status] DB error:", err.message);
    return res.status(500).json({ ok: false, error: "DB error" });
  }
});

export default router;
