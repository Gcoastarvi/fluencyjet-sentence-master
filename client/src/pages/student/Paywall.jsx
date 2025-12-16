// client/src/pages/student/Paywall.jsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "@/api/apiClient";

/**
 * PAYWALL LOGIC (FINAL – CLEAN)
 * ---------------------------------
 * Source of truth: backend response + JWT token
 * No hacks, no URL checks, no role assumptions
 */

export default function Paywall() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null); // FREE | PRO | null
  const [error, setError] = useState(null);

  useEffect(() => {
    async function checkAccess() {
      try {
        const token = localStorage.getItem("fj_token");

        // 1️⃣ Not logged in → go to login
        if (!token) {
          navigate("/login", { replace: true });
          return;
        }

        // 2️⃣ Ask backend who this user is
        const res = await api.request("/auth/me");
        /* Expected backend response
           {
             ok: true,
             email: "user@email.com",
             plan: "FREE" | "PRO"
           }
        */

        if (!res?.ok) {
          throw new Error("Invalid auth state");
        }

        setPlan(res.plan);

        // 3️⃣ Paid user → full access
        if (res.plan === "PRO") {
          navigate("/dashboard", { replace: true });
          return;
        }

        // 4️⃣ FREE user → show paywall
        setLoading(false);
      } catch (err) {
        console.error("[Paywall] Access check failed", err);
        localStorage.removeItem("fj_token");
        setError("Session expired. Please login again.");
        setLoading(false);
      }
    }

    checkAccess();
  }, [navigate]);

  /* ---------------- UI STATES ---------------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">Checking your access…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2 bg-purple-600 text-white rounded"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // FREE USER PAYWALL
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow-lg rounded-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-4">
          Upgrade to Unlock Full Access 🚀
        </h1>

        <p className="text-gray-600 text-center mb-6">
          You’re currently on the <b>FREE</b> plan. Unlock all sentence
          exercises, XP boosts, and progress tracking.
        </p>

        <ul className="space-y-3 mb-6 text-sm text-gray-700">
          <li>✅ Unlimited sentence practice</li>
          <li>✅ XP, streaks & leaderboard</li>
          <li>✅ Advanced lessons</li>
          <li>✅ Lifetime access</li>
        </ul>

        <button
          onClick={() => navigate("/checkout")}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold"
        >
          Upgrade Now
        </button>

        <button
          onClick={() => navigate("/dashboard")}
          className="w-full mt-3 py-2 text-sm text-gray-500 hover:underline"
        >
          Continue with Free Access
        </button>
      </div>
    </div>
  );
}
