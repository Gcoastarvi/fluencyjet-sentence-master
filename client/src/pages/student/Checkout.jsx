import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { plan, setPlan } = useAuth();

  // We’ll pass these from Paywall
  const selectedPlan = location.state?.selectedPlan || "PRO";
  const priceLabel = location.state?.priceLabel || "₹499 (launch offer)";

  // If already upgraded, bounce
  if (plan === "PRO" || plan === "LIFETIME") {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 text-center">
        <h2 className="text-2xl font-bold text-green-700 mb-2">
          🎉 You already have access
        </h2>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  function simulateSuccess() {
    // MOCK success: upgrade client-side (we’ll replace later with real payment webhook)
    setPlan(selectedPlan);
    localStorage.setItem("fj_plan", selectedPlan);
    alert(`✅ Payment Success (mock) — Upgraded to ${selectedPlan}`);
    navigate("/dashboard");
  }

  return (
    <div className="max-w-xl mx-auto mt-16 p-6 bg-white rounded-xl shadow text-center">
      <h1 className="text-3xl font-bold text-indigo-700 mb-3">🧾 Checkout</h1>

      <div className="text-left bg-gray-50 border rounded p-4 mb-6">
        <p className="text-gray-700">
          Selected plan: <b>{selectedPlan}</b>
        </p>
        <p className="text-gray-700">
          Price: <b>{priceLabel}</b>
        </p>
        <p className="text-xs text-gray-500 mt-2">
          This is a mock checkout. Real payments will be enabled next.
        </p>
      </div>

      <button
        onClick={simulateSuccess}
        className="w-full py-3 bg-purple-600 text-white rounded-lg text-lg font-semibold hover:bg-purple-700 mb-3"
      >
        Simulate Payment Success
      </button>

      <button
        onClick={() => navigate("/paywall")}
        className="w-full py-2 border rounded text-gray-600 hover:bg-gray-50"
      >
        Back to Paywall
      </button>
    </div>
  );
}
