import express from "express";
import { memoryConsentSnapshot, memoryPurchaseConsentSnapshot } from "../services/memoryMetaConsent.js";
import Razorpay from "razorpay";
import prisma from "../db/client.js";
import { normalizeWhatsAppNumber } from "../lib/whatsappNumber.js";
import {
  MEMORY_MASTERCLASS_EVENT,
  memoryMasterclassBookingOpen,
  getPublicMemoryMasterclassEvent,
} from "../config/memoryMasterclassEvent.js";

const router = express.Router();

const MEMORY_MASTERCLASS_AMOUNT = 9900;
const MEMORY_MASTERCLASS_CURRENCY = "INR";
const MEMORY_MASTERCLASS_PRODUCT_KEY = "memory_masterclass_99";

router.get("/event", (_req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({ ok: true, event: getPublicMemoryMasterclassEvent() });
});

export function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error("Missing Razorpay env vars");
  }

  return new Razorpay({ key_id, key_secret });
}

function cleanString(value, maxLength = 500) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();
  if (!cleaned) return null;

  return cleaned.slice(0, maxLength);
}

function getClientIp(req) {
  // Omit until the production proxy chain is verified.
  return null;
}

export function validatePurchaserDetails(body) {
  const fields = ["purchaserName", "purchaserEmail", "purchaserPhone"];
  if (fields.some((field) =>
    typeof body[field] !== "string" || !body[field].trim()
  )) {
    return { error: "Name, Email, and Phone are required." };
  }

  // Reject oversized/control-character input rather than silently truncating
  // the identity snapshot. These limits also fit Razorpay's 256-char notes.
  const rawName = body.purchaserName.trim();
  const purchaserName = rawName.normalize("NFC").replace(/\s+/g, " ");
  const purchaserEmail = body.purchaserEmail.trim().toLowerCase();
  const rawPhone = body.purchaserPhone.trim();
  if (
    purchaserName.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(rawName)
  ) {
    return { error: "Please enter a valid Name of up to 100 characters." };
  }
  if (
    purchaserEmail.length > 191 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(purchaserEmail) ||
    /[\u0000-\u001f\u007f]/.test(purchaserEmail)
  ) {
    return { error: "Please enter a valid Email address." };
  }
  if (rawPhone.length > 30 || !/^\+?[0-9 ()-]+$/.test(rawPhone)) {
    return { error: "Please enter a valid Phone number." };
  }
  const purchaserPhone = normalizeWhatsAppNumber(rawPhone);
  if (!purchaserPhone || !/^\+[1-9]\d{7,14}$/.test(purchaserPhone)) {
    return { error: "Please enter a valid Phone number with a country code." };
  }
  return { purchaserName, purchaserEmail, purchaserPhone };
}

// Return only checkout prefill details to the private session owner.
// Never look up personal details using the shareable publicToken.
router.post("/checkout-details", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const ownerToken = cleanString(req.body?.ownerToken, 100);
  if (!ownerToken) {
    return res.status(400).json({
      ok: false,
      code: "MEMORY_OWNER_TOKEN_REQUIRED",
      message: "Assessment ownership token is required.",
    });
  }
  try {
    const session = await prisma.memoryAssessmentSession.findUnique({
      where: { ownerToken },
      select: {
        status: true,
        leadCapturedAt: true,
        whatsappConsent: true,
        learnerName: true,
        parentGuardianName: true,
        email: true,
        whatsappNumber: true,
        whatsappNumberNormalized: true,
      },
    });
    if (!session) {
      return res.status(404).json({
        ok: false,
        code: "MEMORY_SESSION_NOT_FOUND",
        message: "Assessment session was not found.",
      });
    }
    if (
      session.status !== "LEAD_CAPTURED" ||
      !session.leadCapturedAt ||
      session.whatsappConsent !== true
    ) {
      return res.status(409).json({
        ok: false,
        code: "MEMORY_LEAD_CAPTURE_REQUIRED",
        message: "Please save the Study Memory Test report before checkout.",
      });
    }
    return res.json({
      ok: true,
      details: {
        name: session.parentGuardianName || session.learnerName || "",
        email: session.email || "",
        phone: session.whatsappNumber || session.whatsappNumberNormalized || "",
      },
    });
  } catch {
    return res.status(500).json({
      ok: false,
      message: "Unable to load registration details.",
    });
  }
});

// POST /api/memory-masterclass/create-order
//
// Security:
// - Requires the private MemoryAssessmentSession ownerToken.
// - Browser cannot choose the price, track or webinar date.
// - Track and learner/session identity are derived from the stored session.
// - Checkout is only available after lead capture is complete.
router.post("/create-order", async (req, res) => {
  try {
    if (!memoryMasterclassBookingOpen()) {
      return res.status(409).json({ ok: false, code: "MEMORY_EVENT_UNAVAILABLE",
        message: "Booking is paused until the next approved live class schedule is confirmed." });
    }
    const body = req.body || {};

    const ownerToken = cleanString(body.ownerToken, 100);

    if (!ownerToken) {
      return res.status(400).json({
        ok: false,
        code: "MEMORY_OWNER_TOKEN_REQUIRED",
        message: "Assessment ownership token is required.",
      });
    }

    const session = await prisma.memoryAssessmentSession.findUnique({
      where: {
        ownerToken,
      },

      select: {
        id: true,
        publicToken: true,
        trackId: true,
        status: true,
        leadCapturedAt: true,
        whatsappConsent: true,

        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmContent: true,
        utmTerm: true,
        source: true,
      },
    });

    if (!session) {
      return res.status(404).json({
        ok: false,
        code: "MEMORY_SESSION_NOT_FOUND",
        message: "Assessment session was not found.",
      });
    }

    if (
      session.status !== "LEAD_CAPTURED" ||
      !session.leadCapturedAt ||
      session.whatsappConsent !== true
    ) {
      return res.status(409).json({
        ok: false,
        code: "MEMORY_LEAD_CAPTURE_REQUIRED",
        message: "Please save the Study Memory Test report before checkout.",
      });
    }

    const purchaser = validatePurchaserDetails(body);
    if (purchaser.error) {
      return res.status(400).json({
        ok: false,
        code: "MEMORY_PURCHASER_DETAILS_INVALID",
        message: purchaser.error,
      });
    }

    const razorpay = getRazorpayClient();

    const receipt = `memory_${Date.now().toString(36)}`;

    const order = await razorpay.orders.create({
      amount: MEMORY_MASTERCLASS_AMOUNT,
      currency: MEMORY_MASTERCLASS_CURRENCY,
      receipt,

      notes: {
        productKey: MEMORY_MASTERCLASS_PRODUCT_KEY,
        eventKey: MEMORY_MASTERCLASS_EVENT.key,
        trackId: session.trackId,
        purchaserName: purchaser.purchaserName,
        purchaserEmail: purchaser.purchaserEmail,
        purchaserPhone: purchaser.purchaserPhone,
      },
    });

    let consent;
    try { consent = await memoryPurchaseConsentSnapshot(body, purchaser, { gpc: req.headers["sec-gpc"] === "1" }); }
    catch { consent = await memoryConsentSnapshot(null); } // payment works; measurement denied
    const checkoutIntent =
      await prisma.memoryMasterclassCheckoutIntent.create({
        data: {
          ...consent,
          memoryAssessmentSessionId: session.id,

          razorpayOrderId: order.id,
          purchaserName: purchaser.purchaserName,
          purchaserEmail: purchaser.purchaserEmail,
          purchaserPhone: purchaser.purchaserPhone,

          amount: MEMORY_MASTERCLASS_AMOUNT,
          currency: MEMORY_MASTERCLASS_CURRENCY,
          productKey: MEMORY_MASTERCLASS_PRODUCT_KEY,

          eventKey: MEMORY_MASTERCLASS_EVENT.key,
          eventStartsAt: MEMORY_MASTERCLASS_EVENT.startsAt,
          eventEndsAt: MEMORY_MASTERCLASS_EVENT.endsAt,
          eventTimezone: MEMORY_MASTERCLASS_EVENT.timezone,

          trackId: session.trackId,

          visitorId: consent.metaConsentGranted ? cleanString(body.visitorId, 191) : null,

          fbclid: consent.metaConsentGranted ? cleanString(body.fbclid, 2000) : null,
          fbc: consent.metaConsentGranted ? cleanString(body.fbc, 2000) : null,
          fbp: consent.metaConsentGranted ? cleanString(body.fbp, 2000) : null,

          utmSource:
            cleanString(body.utmSource, 150) ||
            session.utmSource,

          utmMedium:
            cleanString(body.utmMedium, 150) ||
            session.utmMedium,

          utmCampaign:
            cleanString(body.utmCampaign, 200) ||
            session.utmCampaign,

          utmContent:
            cleanString(body.utmContent, 200) ||
            session.utmContent,

          utmTerm:
            cleanString(body.utmTerm, 200) ||
            session.utmTerm,

          source:
            cleanString(body.source, 150) ||
            session.source ||
            "memory-challenge-result",

          landingPage: cleanString(body.landingPage, 2000),

          clientIp: getClientIp(req),

          clientUserAgent: consent.metaConsentGranted ? cleanString(
            req.headers["user-agent"],
            2000,
          ) : null,
        },
      });

    console.log(
      `[memory-masterclass/checkout] Created order=${order.id} intent=${checkoutIntent.id} session=${session.id}`,
    );

    return res.json({
      ok: true,

      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,

      amount: MEMORY_MASTERCLASS_AMOUNT,
      currency: MEMORY_MASTERCLASS_CURRENCY,

      checkoutIntentId: checkoutIntent.id,

      event: {
        key: MEMORY_MASTERCLASS_EVENT.key,
        startsAt: MEMORY_MASTERCLASS_EVENT.startsAt.toISOString(),
        endsAt: MEMORY_MASTERCLASS_EVENT.endsAt.toISOString(),
        timezone: MEMORY_MASTERCLASS_EVENT.timezone,
      },
    });
  } catch (error) {
    console.error(
      "[memory-masterclass/checkout] CREATE ORDER ERROR:",
      error?.message || error,
    );

    return res.status(500).json({
      ok: false,
      code: "MEMORY_MASTERCLASS_CHECKOUT_FAILED",
      message: "Unable to start secure checkout.",
    });
  }
});

export default router;

