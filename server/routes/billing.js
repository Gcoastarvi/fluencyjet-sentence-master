// server/routes/billing.js
import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { authMiddleware, authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.warn(
    "⚠️ Missing Razorpay env vars: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET",
  );
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

/**
 * POST /api/billing/create-order
 * body: { amount: number, currency?: "INR", plan?: "PRO" }
 * amount must be in paise (e.g., 19900 for ₹199)
 */
router.post("/create-order", authMiddleware, authRequired, async (req, res) => {
  try {
    const { amount, currency = "INR", plan = "PRO" } = req.body || {};

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ ok: false, message: "Invalid amount" });
    }

    const receipt = `fj_${req.user.id}_${Date.now()}`;

    const order = await razorpay.orders.create({
      amount: Math.round(amt),
      currency,
      receipt,
      notes: {
        userId: String(req.user.id),
        plan,
      },
    });

    return res.json({
      ok: true,
      keyId, // safe to send keyId to frontend
      order,
    });
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Order creation failed" });
  }
});

export default router;
