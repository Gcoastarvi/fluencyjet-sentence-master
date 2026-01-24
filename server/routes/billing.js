import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import prisma from "../db/client.js";
import { authMiddleware, authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * -----------------------------
 * PLAN CONFIG
 * Amounts in paise
 * -----------------------------
 */
const PLANS = {
  PRO: { amount: 9900, currency: "INR", label: "PRO" },
};

function getPlanConfig(plan) {
  const key = (plan || "PRO").toUpperCase();
  return PLANS[key] || PLANS.PRO;
}

function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error("Missing Razorpay env vars");
  }

  return new Razorpay({ key_id, key_secret });
}

/**
 * =================================================
 * STEP 1 — CREATE ORDER
 * POST /api/billing/create-order
 * =================================================
 */
router.post("/create-order", authMiddleware, async (req, res) => {
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

    /**
     * Persist CREATED payment (audit-safe)
     */
    await prisma.payment.create({
      data: {
        userId: req.user.id,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        status: "CREATED",
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
 * =================================================
 * STEP 3 — VERIFY PAYMENT + UPGRADE PLAN
 * POST /api/billing/verify-payment
 * =================================================
 */
router.post("/verify-payment", authRequired, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } =
      req.body || {};

    const cfg = getPlanConfig(plan); // ✅ ADD HERE

    // ... signature verify ...
    // ... payment update uses cfg.label ...
    // ... user update uses cfg.label ...

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ ok: false, message: "Missing payment fields" });
    }

    /**
     * 1) VERIFY SIGNATURE
     */
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest("hex");

    if (expected !== razorpay_signature) {
      await prisma.payment.update({
        where: { orderId: razorpay_order_id },
        data: {
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
          status: "FAILED",
        },
      });

      return res
        .status(400)
        .json({ ok: false, message: "Invalid payment signature" });
    }

    /**
     * 2) MARK PAYMENT AS PAID (idempotent)
     */
    await prisma.payment.update({
      where: { orderId: razorpay_order_id },
      data: {
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
        status: "PAID",
        plan: cfg.label,
      },
    });

    /**
     * 3) UPGRADE USER PLAN
     */
    // 🔒 require login (verify-payment must be protected)
    if (!req.user?.id) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    /**
     * 3) UNLOCK USER (idempotent)
     * - plan: cfg.label (ex: "BEGINNER" / "PRO")
     * - tier_level: lowercased label
     * - has_access: true
     */
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        plan: cfg.label,
        has_access: true,
        tier_level: String(cfg.label || "").toLowerCase(),
      },
      select: {
        id: true,
        email: true,
        plan: true,
        has_access: true,
        tier_level: true,
      },
    });

    return res.json({
      ok: true,
      message: "Payment verified and access granted",
      plan: user.plan,
      tier_level: user.tier_level,
      has_access: user.has_access,
      user,
    });
  } catch (err) {
    console.error("VERIFY PAYMENT ERROR:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Payment verification failed" });
  }
});

export default router;
