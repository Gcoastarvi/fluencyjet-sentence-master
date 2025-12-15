// client/src/pages/student/Paywall.jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { createOrder } from "../../api/apiClient";

export default function Paywall() {
  const navigate = useNavigate();
  const { plan, setPlan } = useAuth();

  // Already upgraded → bounce user
  if (plan === "PRO" || plan === "LIFETIME") {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 text-center">
        <h2 className="text-2xl font-bold text-green-700 mb-2">
          🎉 You already have access
        </h2>
        <p className="text-gray-600 mb-4">
          Your plan allows unlimited learning.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }
  async function startPayment() {
    try {
      // 1️⃣ Ask backend to create Razorpay order
      const order = await createOrder({
        plan: "PRO",
        amount: 49900, // ₹499 in paise
      });

      if (!order?.id) {
        alert("Failed to create payment order");
        return;
      }

      // 2️⃣ Configure Razorpay checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "FluencyJet Sentence Master",
        description: "PRO Plan Upgrade",
        order_id: order.id,

        handler: function (response) {
          alert("Payment successful 🎉");
          window.location.href = "/dashboard";
        },

        prefill: {
          email: "",
        },

        theme: {
          color: "#7C3AED",
        },
      };

      // 3️⃣ Open Razorpay popup
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Payment error", err);
      alert("Payment failed. Try again.");
    }
  }

  return (
    <div className="max-w-xl mx-auto mt-16 p-6 bg-white rounded-xl shadow text-center">
      <h1 className="text-3xl font-bold text-indigo-700 mb-3">
        🔓 Unlock Full Access
      </h1>

      <p className="text-gray-600 mb-6">
        You’re currently on the <b>FREE</b> plan. Upgrade to PRO to unlock:
      </p>

      <ul className="text-left text-gray-700 mb-6 space-y-2">
        <li>✅ Unlimited daily XP</li>
        <li>✅ All sentence lessons</li>
        <li>✅ Typing & practice quizzes</li>
        <li>✅ Leaderboard & streak tracking</li>
      </ul>

      <button
        onClick={startPayment}
        className="w-full py-3 bg-purple-600 text-white rounded-lg text-lg font-semibold hover:bg-purple-700 mb-3"
      >
        Continue to Checkout
      </button>

      <button
        onClick={() => navigate("/dashboard")}
        className="w-full py-2 border rounded text-gray-600 hover:bg-gray-50"
      >
        Maybe later
      </button>

      <p className="text-xs text-gray-400 mt-4">
        * Payments will be enabled soon. This is a demo upgrade.
      </p>
    </div>
  );
}
