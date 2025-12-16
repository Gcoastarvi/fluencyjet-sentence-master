// client/src/pages/student/Paywall.jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { createOrder } from "../../api/apiClient";

// Load Razorpay checkout script safely
function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Paywall() {
  const navigate = useNavigate();
  const { plan, setPlan, token } = useAuth(); // token must exist in AuthContext (most likely it does)

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
      // 0) Must be logged in (JWT)
      if (!token) {
        alert("Please login again to continue.");
        navigate("/login");
        return;
      }

      // 1) Load Razorpay script
      const loaded = await loadRazorpay();
      if (!loaded) {
        alert("Razorpay failed to load. Disable adblock and try again.");
        return;
      }

      // 2) Create Razorpay order from backend (JWT protected)
      const order = await createOrder({ plan: "PRO" });

      // Your backend returns { ok, orderId, amount, currency, plan, keyId }
      if (!order?.ok || !order?.orderId) {
        alert("Failed to create payment order");
        return;
      }

      // 3) Configure Razorpay checkout
      const options = {
        key: order.keyId, // always from backend (safer than env)
        amount: order.amount,
        currency: order.currency,
        name: "FluencyJet Sentence Master",
        description: "PRO Plan Upgrade",
        order_id: order.orderId,

        handler: async function (response) {
          try {
            const verifyRes = await fetch(
              `${import.meta.env.VITE_API_BASE_URL}/api/billing/verify-payment`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  plan: "PRO",
                }),
              },
            );

            const data = await verifyRes.json();

            if (data?.ok) {
              // Update local plan immediately (UX)
              setPlan?.("PRO");
              alert("Payment verified 🎉 Welcome to PRO!");
              navigate("/dashboard");
            } else {
              alert(data?.message || "Payment verification failed");
            }
          } catch (err) {
            console.error("Verification error", err);
            alert("Payment verification error");
          }
        },

        theme: { color: "#7C3AED" },
      };

      // 4) Open Razorpay popup
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
