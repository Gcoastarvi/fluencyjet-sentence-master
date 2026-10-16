import express from "express";
import rateLimit from "express-rate-limit";
import prisma from "../db/client.js";
import { memoryConsentSnapshot } from "../services/memoryMetaConsent.js";
import { getRazorpayClient, validatePurchaserDetails } from "./memoryMasterclassCheckout.js";
import { MEMORY_MASTERCLASS_EVENT } from "../config/memoryMasterclassEvent.js";

const router = express.Router();
// Limit public order creation without affecting the assessment checkout.
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, message: "Too many checkout attempts. Please try again later." },
});
const clean = (value, limit) =>
  typeof value === "string" ? value.trim().slice(0, limit) || null : null;

// Public registration authorizes this product only, never assessment ownership.
// Audience/level are selections, not arbitrary track or pricing instructions.
export function deriveStandaloneTrack(body) {
  if (body.audience === "school") {
    if (body.checkoutContext === "parents") {
      if (body.schoolLevel != null) return null;
      return "school_unspecified";
    }
    if (body.schoolLevel === "6-8") return "school_foundation";
    if (body.schoolLevel === "9-12") return "school_advanced";
    return null;
  }
  if (body.audience === "advanced" && body.schoolLevel == null) return "advanced";
  return null;
}

router.post("/create-order", orderLimiter, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const body = req.body || {};
  const trackId = deriveStandaloneTrack(body);
  if (!trackId) {
    return res.status(400).json({
      ok: false, code: "MEMORY_AUDIENCE_INVALID",
      message: "Please choose a valid audience and school class.",
    });
  }
  const purchaser = validatePurchaserDetails(body);
  if (purchaser.error) {
    return res.status(400).json({
      ok: false, code: "MEMORY_PURCHASER_DETAILS_INVALID", message: purchaser.error,
    });
  }
  try {
    const consent = await memoryConsentSnapshot(body.memoryMetaConsentReceipt);
    const order = await getRazorpayClient().orders.create({
      amount: 9900, currency: "INR", receipt: `memory_vsl_${Date.now().toString(36)}`,
      notes: {
        productKey: "memory_masterclass_99",
        eventKey: MEMORY_MASTERCLASS_EVENT.key,
        trackId, checkoutSource: "standalone_vsl", ...purchaser,
      },
    });
    const intent = await prisma.memoryMasterclassCheckoutIntent.create({
      data: {
        ...consent,
        memoryAssessmentSessionId: null,
        checkoutSource: "standalone_vsl",
        source: "whatsapp_vsl",
        razorpayOrderId: order.id,
        ...purchaser,
        amount: 9900, currency: "INR", productKey: "memory_masterclass_99",
        eventKey: MEMORY_MASTERCLASS_EVENT.key,
        eventStartsAt: MEMORY_MASTERCLASS_EVENT.startsAt,
        eventEndsAt: MEMORY_MASTERCLASS_EVENT.endsAt,
        eventTimezone: MEMORY_MASTERCLASS_EVENT.timezone,
        trackId,
        visitorId: consent.metaConsentGranted ? clean(body.visitorId, 191) : null,
        fbclid: consent.metaConsentGranted ? clean(body.fbclid, 2000) : null,
        fbc: consent.metaConsentGranted ? clean(body.fbc, 2000) : null,
        fbp: consent.metaConsentGranted ? clean(body.fbp, 2000) : null,
        utmSource: clean(body.utmSource, 150),
        utmMedium: clean(body.utmMedium, 150),
        utmCampaign: clean(body.utmCampaign, 200),
        utmContent: clean(body.utmContent, 200),
        utmTerm: clean(body.utmTerm, 200),
        landingPage: clean(body.landingPage, 2000),
        clientIp: null,
        clientUserAgent: consent.metaConsentGranted ? clean(req.headers["user-agent"], 2000) : null,
      },
    });
    return res.json({
      ok: true, keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id, amount: 9900, currency: "INR",
      checkoutIntentId: intent.id,
      event: {
        key: MEMORY_MASTERCLASS_EVENT.key,
        startsAt: MEMORY_MASTERCLASS_EVENT.startsAt.toISOString(),
        endsAt: MEMORY_MASTERCLASS_EVENT.endsAt.toISOString(),
        timezone: MEMORY_MASTERCLASS_EVENT.timezone,
      },
    });
  } catch {
    // Do not log purchaser identity or provider error objects containing it.
    console.error("[memory-masterclass/standalone] Order creation failed");
    return res.status(500).json({
      ok: false, code: "MEMORY_MASTERCLASS_CHECKOUT_FAILED",
      message: "Unable to start secure checkout. Please try again.",
    });
  }
});

export default router;
