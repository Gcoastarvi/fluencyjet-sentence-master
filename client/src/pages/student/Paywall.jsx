// client/src/pages/student/Paywall.jsx
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getMe } from "../../api/apiClient";

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

  const [searchParams] = useSearchParams();
  const selectedPlan = (searchParams.get("plan") || "BEGINNER").toUpperCase();

  useEffect(() => {
    let alive = true;

    async function checkAccess() {
      try {
        const token = localStorage.getItem("token");

        const from = searchParams.get("from") || "";
        const next = `/paywall?plan=${encodeURIComponent(selectedPlan)}&from=${encodeURIComponent(from)}`;

        if (!token) {
          navigate(`/login?next=${encodeURIComponent(next)}`, {
            replace: true,
          });
          return;
        }

        const res = await getMe();
        if (!alive) return;

        if (!res?.ok) throw new Error("Invalid auth state");

        const user = res.user || res;
        const plan = (user.plan || res.plan || "FREE").toUpperCase();

        const tier = String(user.tier_level || "").toLowerCase();

        const hasAccess =
          !!user.has_access ||
          plan === "PRO" ||
          tier === "pro" ||
          tier === "paid";

        setPlan(plan);

        if (hasAccess) {
          navigate("/dashboard", { replace: true });
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error("[Paywall] Access check failed", err);
        localStorage.removeItem("token");
        setError("Session expired. Please login again.");
        setLoading(false);
      }
    }

    checkAccess();
    return () => {
      alive = false;
    };
  }, [navigate, searchParams, selectedPlan]);

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
          onClick={() => {
            const params = new URLSearchParams(window.location.search);
            const from = params.get("from") || "";
            navigate(
              `/checkout?plan=${encodeURIComponent(selectedPlan)}&from=${encodeURIComponent(from)}`,
            );
          }}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold"
        >
          Upgrade Now
        </button>

        <button
          onClick={() => navigate("/lessons")}
          className="w-full mt-3 py-2 text-sm text-gray-500 hover:underline"
        >
          Continue with Free Access
        </button>
      </div>
    </div>
  );
}
