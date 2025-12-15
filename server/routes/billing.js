import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import prisma from "../prisma/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Razorpay instance
 */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * STEP 1 — Create Razorpay Order
 * POST /api/billing/create-order
 */
router.post("/create-order", authRequired, async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    const amount = 99900; // ₹999 in paise

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `fj_${user.id}_${Date.now()}`,
      notes: {
        userId: String(user.id),
        email: user.email,
        product: "FluencyJet PRO",
      },
    });

    return res.json({
      ok: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to create order",
    });
  }
});

/**
 * STEP 3 — Verify payment & upgrade plan
 * POST /api/billing/verify-payment
 */
router.post("/verify-payment", authRequired, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        ok: false,
        message: "Missing payment details",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        ok: false,
        message: "Invalid payment signature",
      });
    }

    // ✅ Upgrade user
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        plan: "PRO",
        has_access: true,
      },
    });

    return res.json({
      ok: true,
      message: "Payment verified. PRO unlocked.",
    });
  } catch (err) {
    console.error("VERIFY PAYMENT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Payment verification failed",
    });
  }
});

export default router;
