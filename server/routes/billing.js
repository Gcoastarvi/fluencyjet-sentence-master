import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { authRequired } from "../middleware/authMiddleware.js";
import prisma from "../prisma/client.js";

const router = express.Router();

/* ----------------------------------------
   Razorpay Client
----------------------------------------- */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ----------------------------------------
   CREATE ORDER
----------------------------------------- */
router.post("/create-order", authRequired, async (req, res) => {
  try {
    const amount = 499 * 100; // ₹499 in paise

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });

    res.json({
      ok: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ ok: false, message: "Order creation failed" });
  }
});

/* ----------------------------------------
   VERIFY PAYMENT & UPGRADE PLAN
----------------------------------------- */
router.post("/verify-payment", authRequired, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ ok: false, message: "Invalid signature" });
    }

    // Upgrade user plan
    await prisma.user.update({
      where: { id: req.user.id },
      data: { plan: "PRO" },
    });

    res.json({ ok: true, plan: "PRO" });
  } catch (err) {
    console.error("VERIFY PAYMENT ERROR:", err);
    res.status(500).json({ ok: false, message: "Payment verification failed" });
  }
});

export default router;
