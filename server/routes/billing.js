// server/routes/billing.js

import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import prisma from "../db/client.js";
import { authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Simple plan config (edit prices anytime)
 * Razorpay amount must be in paise.
 */
const PLANS = {
  PRO: { amount: 9900, currency: "INR", label: "PRO" }, // ₹99.00 example
  // Add more later: PREMIUM, YEARLY, etc.
};

function getPlanConfig(plan) {
  const key = (plan || "PRO").toUpperCase();
  return PLANS[key] || PLANS.PRO;
}

function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error(
      "Missing Razorpay env vars: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET",
    );
  }

  return new Razorpay({ key_id, key_secret });
}

/**
 * STEP 1: Create Order (Frontend calls this)
 * POST /api/billing/create-order
 * body: { plan?: "PRO" }
 */
router.post("/create-order", authRequired, async (req, res) => {
  try {
    const { plan } = req.body || {};
    const cfg = getPlanConfig(plan);

    const razorpay = getRazorpayClient();

    const receipt = `fj_${req.user.id}_${Date.now()}`;

    const order = await razorpay.orders.create({
      amount: cfg.amount,
      currency: cfg.currency,
      receipt,
      notes: {
        userId: String(req.user.id),
        plan: cfg.label,
      },
    });

    return res.json({
      ok: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan: cfg.label,
    });
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to create order" });
  }
});

/**
 * STEP 3: Verify Payment + Upgrade Plan
 * POST /api/billing/verify-payment
 * body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan?: "PRO" }
 */
router.post("/verify-payment", authRequired, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } =
      req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ ok: false, message: "Missing payment verification fields" });
    }

    // 1) Verify signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid payment signature" });
    }

    const cfg = getPlanConfig(plan);

    // 2) Upgrade user in DB (minimum viable upgrade)
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        plan: cfg.label,
        has_access: true,
        tier_level: cfg.label.toLowerCase(), // "pro"
      },
      select: {
        id: true,
        email: true,
        plan: true,
        has_access: true,
        tier_level: true,
      },
    });

    // (Optional later) store a Payment record table for audit/history

    return res.json({ ok: true, user: updated });
  } catch (err) {
    console.error("VERIFY PAYMENT ERROR:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Payment verification failed" });
  }
});

export default router;
