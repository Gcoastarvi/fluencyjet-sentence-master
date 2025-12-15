import express from "express";
import Razorpay from "razorpay";
import authRequired from "../middleware/authMiddleware.js";

// 🔐 Verify Razorpay payment & upgrade plan
router.post("/verify-payment", authRequired, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        ok: false,
        message: "Missing Razorpay payment details",
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        ok: false,
        message: "Payment verification failed",
      });
    }

    // ✅ Payment verified → upgrade user
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        plan: "PRO",
        has_access: true,
      },
    });

    return res.json({
      ok: true,
      message: "Payment verified, PRO unlocked",
    });
  } catch (err) {
    console.error("VERIFY PAYMENT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Payment verification failed",
    });
  }
});

const router = express.Router();

/**
 * Razorpay instance
 * Keys come from Railway environment variables
 */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * POST /api/billing/create-order
 * Step 1: Create Razorpay order
 */
router.post("/create-order", authRequired, async (req, res) => {
  try {
    const user = req.user;

    // Safety check
    if (!user) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    // 🔒 Amount in paise (₹999 = 99900)
    const amount = 99900;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `fj_${user.id}_${Date.now()}`,
      notes: {
        userId: user.id.toString(),
        email: user.email,
        product: "FluencyJet PRO",
      },
    });

    return res.status(200).json({
      ok: true,
      order,
      key: process.env.RAZORPAY_KEY_ID, // frontend needs this
    });
  } catch (err) {
    console.error("RAZORPAY ORDER ERROR:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to create order" });
  }
});

export default router;
