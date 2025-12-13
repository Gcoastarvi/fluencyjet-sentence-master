// client/src/pages/Paywall.jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Paywall() {
  const { setPlan } = useAuth();
  const navigate = useNavigate();

  function mockUpgrade() {
    localStorage.setItem("fj_plan", "PRO");
    setPlan("PRO");
    navigate("/lessons");
  }

  return (
    <div className="max-w-md mx-auto text-center p-6">
      <h2 className="text-2xl font-bold text-indigo-700 mb-3">
        Unlock All Lessons
      </h2>

      <p className="text-gray-600 mb-6">
        Join the full course to access all sentence-building modules and daily
        XP tracking.
      </p>

      {/* REAL PAYMENT CTA (later) */}
      <button
        className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-6 py-3 rounded-full w-full"
        disabled
      >
        Proceed to Payment
      </button>

      {/* DEV MOCK UPGRADE */}
      <button
        onClick={mockUpgrade}
        className="mt-4 text-sm text-gray-500 underline"
      >
        Simulate PRO Upgrade (Dev)
      </button>
    </div>
  );
}
