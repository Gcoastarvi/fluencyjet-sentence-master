import express from "express";
import Razorpay from "razorpay";
import prisma from "../db/client.js";

const router = express.Router();

const VOCABULARY_AMOUNT = 79900;
const VOCABULARY_CURRENCY = "INR";
const VOCABULARY_PRODUCT_KEY = "vocabulary_challenge_799";

function getRazorpayClient() {
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
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 100);
  }

  return cleanString(req.ip, 100);
}

router.post("/create-order", async (req, res) => {
  try {
    const {
      visitorId,
      fbclid,
      fbc,
      fbp,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      source,
      landingPage,
    } = req.body || {};

    const razorpay = getRazorpayClient();

    const receipt = `vocab_${Date.now().toString(36)}`;

    const order = await razorpay.orders.create({
      amount: VOCABULARY_AMOUNT,
      currency: VOCABULARY_CURRENCY,
      receipt,
      notes: {
        productKey: VOCABULARY_PRODUCT_KEY,
      },
    });

    const checkoutIntent = await prisma.vocabularyCheckoutIntent.create({
      data: {
        razorpayOrderId: order.id,
        amount: VOCABULARY_AMOUNT,
        currency: VOCABULARY_CURRENCY,
        productKey: VOCABULARY_PRODUCT_KEY,

        visitorId: cleanString(visitorId, 191),

        fbclid: cleanString(fbclid, 2000),
        fbc: cleanString(fbc, 2000),
        fbp: cleanString(fbp, 2000),

        utmSource: cleanString(utmSource, 150),
        utmMedium: cleanString(utmMedium, 150),
        utmCampaign: cleanString(utmCampaign, 200),
        utmContent: cleanString(utmContent, 200),
        utmTerm: cleanString(utmTerm, 200),
        source: cleanString(source, 150),

        landingPage: cleanString(landingPage, 2000),

        clientIp: getClientIp(req),
        clientUserAgent: cleanString(
          req.headers["user-agent"],
          2000,
        ),
      },
    });

    console.log(
      `[vocabulary/checkout] Created Razorpay order=${order.id} intent=${checkoutIntent.id}`,
    );

    return res.json({
      ok: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: VOCABULARY_AMOUNT,
      currency: VOCABULARY_CURRENCY,
      checkoutIntentId: checkoutIntent.id,
    });
  } catch (err) {
    console.error(
      "[vocabulary/checkout] CREATE ORDER ERROR:",
      err?.message || err,
    );

    return res.status(500).json({
      ok: false,
      message: "Unable to start secure checkout",
    });
  }
});

export default router;
