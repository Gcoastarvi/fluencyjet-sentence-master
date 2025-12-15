import express from "express";
import Razorpay from "razorpay";
import authRequired from "../middleware/authMiddleware.js";

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
