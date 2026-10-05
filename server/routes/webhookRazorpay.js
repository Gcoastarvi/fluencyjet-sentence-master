import express from "express";
import crypto from "crypto";
import prisma from "../db/client.js";
import { sendCapiPurchase } from "../lib/metaCapi.js";
import { normalizeWhatsAppNumber } from "../lib/whatsappNumber.js";
import { acquireWhatsAppDestinationLock } from "../lib/whatsappDestinationLock.js";
import {
  ANY_QUESTIONS_REMINDER,
  CHECKOUT_HELP_REMINDER,
  SENTENCE_MASTER_PRODUCT_KEY,
  cancelPendingAutomationEvents,
} from "../lib/whatsappJourney.js";
import {
  findExactSentenceMasterCheckoutIntent,
  getCapturedPaymentTime,
  productKeyForPaymentAmount,
} from "../lib/purchaseAttribution.js";

const router = express.Router();

const EXPECTED_CURRENCY = "INR";
const EXPECTED_EVENT = "payment.captured";
const VOCABULARY_AMOUNT_PAISE = 79900;

const MEMORY_MASTERCLASS_PRODUCT_KEY = "memory_masterclass_99";
const MEMORY_MASTERCLASS_VALUE = 99;
const MEMORY_MASTERCLASS_CONTENT_NAME =
  "Amaze Memory Live Study Memory Class";
const MEMORY_MASTERCLASS_EVENT_SOURCE_URL =
  "https://www.fluencyjet.com/memory-masterclass/thank-you";

const PRODUCTS_BY_AMOUNT = {
  79900: {
    code: "vocabulary_challenge_799",
    value: 799,
    contentName: "FluencyJet Vocabulary Challenge",
    contentIds: ["vocabulary_challenge_799"],
    eventSourceUrl: "https://www.fluencyjet.com/vocabulary-thank-you",
  },

  119900: {
    code: "sentence_master_1199",
    value: 1199,
    contentName: "FluencyJet Sentence Master",
    contentIds: ["sentence_master_1199"],
    eventSourceUrl: "https://www.fluencyjet.com/spoken-english-thank-you",
  },
};

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
    const signature = req.headers["x-razorpay-signature"] || "";
    const eventId = req.headers["x-razorpay-event-id"] || "";
    const rawBody = req.body;

    if (!signature || !rawBody || rawBody.length === 0) {
      console.warn("[webhook/rzp] Missing signature or empty body");
      return res.status(400).json({ ok: false, error: "Missing signature" });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[webhook/rzp] RAZORPAY_WEBHOOK_SECRET not set");
      return res
        .status(500)
        .json({ ok: false, error: "Server misconfiguration" });
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
      console.warn(
        "[webhook/rzp] Body is not valid JSON after signature passed",
      );
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
      return res
        .status(400)
        .json({ ok: false, error: "Missing payment entity" });
    }

    const paymentId = paymentEntity.id;
    const razorpayOrderId = paymentEntity.order_id || null;
    const amount = paymentEntity.amount;
    const currency = paymentEntity.currency;
    const paymentStatus = paymentEntity.status;
    const customerEmail = paymentEntity.email || null;
    const customerContact = paymentEntity.contact || null;
    const paymentLinkId = null; // payment.captured carries no page/link entity

    const dedupKey = eventId || `noeid_${paymentId}`;

    // Memory Masterclass is intentionally NOT identified by amount.
    // Match only the exact Razorpay order created by our Memory checkout.
    let memoryIntent = null;

    if (razorpayOrderId) {
      try {
        memoryIntent =
          await prisma.memoryMasterclassCheckoutIntent.findUnique({
            where: {
              razorpayOrderId,
            },
            select: {
              id: true,
              memoryAssessmentSessionId: true,
              razorpayOrderId: true,

              amount: true,
              currency: true,
              productKey: true,

              eventKey: true,
              trackId: true,

              visitorId: true,
              fbclid: true,
              fbc: true,
              fbp: true,

              landingPage: true,
              clientIp: true,
              clientUserAgent: true,
            },
          });
      } catch (err) {
        console.error(
          "[webhook/rzp] Memory checkout intent lookup failed:",
          err.message,
        );

        return res.status(500).json({
          ok: false,
          error: "DB error",
        });
      }
    }

    if (memoryIntent) {
      // The order id identifies the product; the stored checkout intent
      // remains authoritative for amount/currency/product identity.
      if (
        memoryIntent.productKey !==
          MEMORY_MASTERCLASS_PRODUCT_KEY ||
        amount !== memoryIntent.amount ||
        currency !== memoryIntent.currency ||
        memoryIntent.currency !== EXPECTED_CURRENCY
      ) {
        console.warn(
          `[webhook/rzp] Memory checkout mismatch orderId=${razorpayOrderId} ` +
            `paymentAmount=${amount} intentAmount=${memoryIntent.amount} ` +
            `paymentCurrency=${currency} intentCurrency=${memoryIntent.currency}`,
        );

        return res.status(200).json({
          ok: true,
          skipped: true,
          reason: "memory_checkout_mismatch",
        });
      }

      if (paymentStatus !== "captured") {
        console.warn(
          `[webhook/rzp] Unexpected Memory payment status: ${paymentStatus}`,
        );

        return res.status(200).json({
          ok: true,
          skipped: true,
          reason: "status_not_captured",
        });
      }

      try {
        const existingMemoryPurchase =
          await prisma.memoryMasterclassPurchase.findFirst({
            where: {
              OR: [
                { webhookEventId: dedupKey },
                { paymentId },
                { razorpayOrderId },
                { checkoutIntentId: memoryIntent.id },
              ],
            },
            select: {
              id: true,
            },
          });

        if (existingMemoryPurchase) {
          console.log(
            `[webhook/rzp] Duplicate Memory purchase paymentId=${paymentId}`,
          );

          return res.status(200).json({
            ok: true,
            duplicate: true,
          });
        }
      } catch (err) {
        console.error(
          "[webhook/rzp] Memory idempotency check failed:",
          err.message,
        );

        return res.status(500).json({
          ok: false,
          error: "DB error",
        });
      }

      const memoryMetaEventId =
        `${MEMORY_MASTERCLASS_PRODUCT_KEY}_purchase_${paymentId}`;

      let memoryRecord;

      try {
        memoryRecord =
          await prisma.memoryMasterclassPurchase.create({
            data: {
              checkoutIntentId: memoryIntent.id,

              razorpayOrderId,
              paymentId,

              amount,
              currency,
              productKey: MEMORY_MASTERCLASS_PRODUCT_KEY,
              status: paymentStatus,

              customerEmail,
              customerContact,

              webhookEventId: dedupKey,

              metaEventId: memoryMetaEventId,
              metaDelivered: false,
            },
          });

        console.log(
          `[webhook/rzp] Memory purchase saved intent=${memoryIntent.id} ` +
            `id=${memoryRecord.id} paymentId=${paymentId}`,
        );
      } catch (err) {
        if (err.code === "P2002") {
          const duplicate =
            await prisma.memoryMasterclassPurchase.findFirst({
              where: {
                OR: [
                  { webhookEventId: dedupKey },
                  { paymentId },
                  { razorpayOrderId },
                  { checkoutIntentId: memoryIntent.id },
                ],
              },
              select: {
                id: true,
              },
            });

          if (duplicate) {
            console.log(
              `[webhook/rzp] Concurrent duplicate Memory insert paymentId=${paymentId}`,
            );

            return res.status(200).json({
              ok: true,
              duplicate: true,
            });
          }
        }

        console.error(
          "[webhook/rzp] Memory purchase create failed:",
          err.message,
        );

        return res.status(500).json({
          ok: false,
          error: "DB error",
        });
      }

      const pixelId = process.env.META_PIXEL_ID;
      const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

      if (!pixelId || !accessToken) {
        console.warn(
          "[webhook/rzp] META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set — Memory CAPI skipped",
        );

        return res.status(200).json({
          ok: true,
          product: MEMORY_MASTERCLASS_PRODUCT_KEY,
          paymentId,
          capiSkipped: true,
        });
      }

      const memoryCapiResult = await sendCapiPurchase({
        pixelId,
        accessToken,

        eventId: memoryMetaEventId,
        eventTime: Date.now(),

        eventSourceUrl:
          MEMORY_MASTERCLASS_EVENT_SOURCE_URL,

        value: MEMORY_MASTERCLASS_VALUE,
        currency: EXPECTED_CURRENCY,

        contentName: MEMORY_MASTERCLASS_CONTENT_NAME,
        contentIds: [MEMORY_MASTERCLASS_PRODUCT_KEY],

        email: customerEmail,
        phone: customerContact,

        externalId: memoryIntent.visitorId || null,
        fbc: memoryIntent.fbc || null,
        fbp: memoryIntent.fbp || null,

        clientIpAddress: memoryIntent.clientIp || null,
        clientUserAgent:
          memoryIntent.clientUserAgent || null,
      });

      try {
        await prisma.memoryMasterclassPurchase.update({
          where: {
            id: memoryRecord.id,
          },
          data: {
            metaDelivered: memoryCapiResult.ok,
          },
        });
      } catch (err) {
        console.error(
          "[webhook/rzp] Failed to update Memory CAPI status:",
          err.message,
        );
      }

      if (memoryCapiResult.ok) {
        console.log(
          `[webhook/rzp] Memory CAPI Purchase delivered eventId=${memoryMetaEventId} status=${memoryCapiResult.status}`,
        );
      } else {
        console.warn(
          `[webhook/rzp] Memory CAPI delivery failed status=${memoryCapiResult.status}`,
        );
      }

      return res.status(200).json({
        ok: true,
        product: MEMORY_MASTERCLASS_PRODUCT_KEY,
        paymentId,
        capiDelivered: memoryCapiResult.ok,
      });
    }

    try {
      const existing = await prisma.spokenEnglishPurchase.findFirst({
        where: {
          OR: [{ webhookEventId: dedupKey }, { paymentId }],
        },
        select: { id: true },
      });
      if (existing) {
        console.log(
          `[webhook/rzp] Duplicate — already processed paymentId=${paymentId}`,
        );

        return res.status(200).json({
          ok: true,
          duplicate: true,
        });
      }
    } catch (err) {
      console.error("[webhook/rzp] Idempotency check failed:", err.message);
      return res.status(500).json({ ok: false, error: "DB error" });
    }

    const product = PRODUCTS_BY_AMOUNT[amount];

    if (!product) {
      console.warn(`[webhook/rzp] Unsupported product amount: ${amount} paise`);

      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "unsupported_product_amount",
      });
    }
    if (currency !== EXPECTED_CURRENCY) {
      console.warn(`[webhook/rzp] Currency mismatch: ${currency}`);
      return res
        .status(200)
        .json({ ok: true, skipped: true, reason: "currency_mismatch" });
    }
    if (paymentStatus !== "captured") {
      console.warn(`[webhook/rzp] Unexpected payment status: ${paymentStatus}`);
      return res
        .status(200)
        .json({ ok: true, skipped: true, reason: "status_not_captured" });
    }

    let vocabularyIntent = null;

    if (amount === VOCABULARY_AMOUNT_PAISE && razorpayOrderId) {
      try {
        vocabularyIntent = await prisma.vocabularyCheckoutIntent.findUnique({
          where: {
            razorpayOrderId,
          },
          select: {
            id: true,
            visitorId: true,
            fbclid: true,
            fbc: true,
            fbp: true,
            utmSource: true,
            utmMedium: true,
            utmCampaign: true,
            utmContent: true,
            utmTerm: true,
            source: true,
            landingPage: true,
            clientIp: true,
            clientUserAgent: true,
          },
        });

        if (vocabularyIntent) {
          console.log(
            `[webhook/rzp] Vocabulary checkout intent matched orderId=${razorpayOrderId} intent=${vocabularyIntent.id}`,
          );
        } else {
          console.log(
            `[webhook/rzp] No Vocabulary checkout intent for orderId=${razorpayOrderId}`,
          );
        }
      } catch (err) {
        console.error(
          "[webhook/rzp] Vocabulary checkout intent lookup failed:",
          err.message,
        );

        return res.status(500).json({
          ok: false,
          error: "DB error",
        });
      }
    }

    const metaEventId = `${product.code}_purchase_${paymentId}`;
    const capturedAt = getCapturedPaymentTime(paymentEntity);

    let record;

    try {
      const persistPurchase = async (tx, destination = null) => {
        if (destination) {
          await acquireWhatsAppDestinationLock(tx, destination);
        }

        // Re-read after the destination lock. A second authenticated intent
        // may have committed since the pre-lock lookup, which must turn this
        // payment into an unmatched audit record instead of guessing.
        const attribution =
          productKeyForPaymentAmount(amount) === SENTENCE_MASTER_PRODUCT_KEY
            ? await findExactSentenceMasterCheckoutIntent({
                database: tx,
                customerEmail,
                customerContact,
                capturedAt,
              })
            : { intent: null, reason: "NOT_SENTENCE_MASTER" };
        const intent = attribution.intent;
        const productKey = productKeyForPaymentAmount(amount);

        if (intent) {
          await tx.user.update({
            where: { id: intent.userId },
            data: {
              has_access: true,
              plan: "PRO",
              tier_level: "pro",
            },
          });

          await cancelPendingAutomationEvents({
            transaction: tx,
            userId: intent.userId,
            productKey: SENTENCE_MASTER_PRODUCT_KEY,
            eventTypes: [CHECKOUT_HELP_REMINDER, ANY_QUESTIONS_REMINDER],
          });
        }

        return tx.spokenEnglishPurchase.create({
          data: {
            paymentLinkId,
            paymentId,
            razorpayOrderId,
            vocabularyCheckoutIntentId: vocabularyIntent?.id || null,
            amount,
            currency,
            status: paymentStatus,
            customerEmail,
            customerContact,
            userId: intent?.userId || null,
            productKey,
            sourceIntentId: intent?.id || null,
            webhookEventId: dedupKey,
            metaEventId,
            metaDelivered: false,
          },
        });
      };

      // Lock the payment's canonical destination even when the first lookup
      // found no intent. This closes the window where a reminder could pass
      // its first read while purchase attribution is still being resolved.
      const destination =
        productKeyForPaymentAmount(amount) === SENTENCE_MASTER_PRODUCT_KEY
          ? normalizeWhatsAppNumber(customerContact)
          : null;
      record = await prisma.$transaction(
        (tx) => persistPurchase(tx, destination),
        {
          maxWait: 10_000,
          timeout: 30_000,
        },
      );

      console.log(
        `[webhook/rzp] Purchase saved product=${product.code} ` +
          `attributedUserId=${record.userId || "none"} ` +
          `id=${record.id} paymentId=${paymentId}`,
      );
    } catch (err) {
      if (err.code === "P2002") {
        const duplicate = await prisma.spokenEnglishPurchase.findFirst({
          where: {
            OR: [{ webhookEventId: dedupKey }, { paymentId }],
          },
          select: { id: true },
        });

        if (duplicate) {
          console.log(
            `[webhook/rzp] Concurrent duplicate insert for paymentId=${paymentId}`,
          );
          return res.status(200).json({ ok: true, duplicate: true });
        }
      }
      console.error("[webhook/rzp] DB create failed:", err.message);
      return res.status(500).json({ ok: false, error: "DB error" });
    }

    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
      console.warn(
        "[webhook/rzp] META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set — CAPI skipped",
      );
      return res.status(200).json({ ok: true, capiSkipped: true });
    }

    const capiResult = await sendCapiPurchase({
      pixelId,
      accessToken,
      eventId: metaEventId,
      eventTime: Date.now(),
      eventSourceUrl: product.eventSourceUrl,
      value: product.value,
      currency: EXPECTED_CURRENCY,
      contentName: product.contentName,
      contentIds: product.contentIds,
      email: customerEmail,
      phone: customerContact,

      // Rich browser/ad matching for the new Vocabulary order flow.
      externalId: vocabularyIntent?.visitorId || null,
      fbc: vocabularyIntent?.fbc || null,
      fbp: vocabularyIntent?.fbp || null,
      clientIpAddress: vocabularyIntent?.clientIp || null,
      clientUserAgent: vocabularyIntent?.clientUserAgent || null,
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
      console.log(
        `[webhook/rzp] CAPI Purchase delivered eventId=${metaEventId} status=${capiResult.status}`,
      );
    } else {
      console.warn(
        `[webhook/rzp] CAPI delivery failed status=${capiResult.status} error=${errorSnippet}`,
      );
    }

    return res.status(200).json({
      ok: true,
      product: product.code,
      paymentId,
      capiDelivered: capiResult.ok,
    });
  },
);

/**
 * GET /api/webhooks/spoken-english/status
 * Returns the 20 most recent spoken-English purchases + CAPI delivery status.
 * Protected by Authorization: Bearer <ADMIN_SECRET>.
 */
router.get("/spoken-english/status", async (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const authHeader = req.headers.authorization || "";

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
