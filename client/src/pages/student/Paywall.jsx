// client/src/pages/student/Paywall.jsx
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getMe } from "../../api/apiClient";
import { trackPaywallView } from "../../lib/tracking";

export default function Paywall() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null); // FREE | PRO | null
  const [error, setError] = useState(null);

  const [searchParams] = useSearchParams();
  const selectedPlan = (searchParams.get("plan") || "BEGINNER").toUpperCase();
  const from = searchParams.get("from") || "unknown";

  useEffect(() => {
    trackPaywallView({
      plan: selectedPlan,
      from,
    });
  }, [selectedPlan, from]);

  useEffect(() => {
    trackPaywallView({
      plan,
      from,
    });
  }, [plan, from]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-violet-950 to-slate-950 px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl">
        <div className="px-6 py-8 text-center sm:px-8 sm:py-10">
          <div className="mx-auto inline-flex rounded-full bg-lime-100 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-purple-900">
            ✓ Lesson 1 Complete
          </div>

          <h1 className="mt-6 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            Unlock Your
            <span className="block text-purple-700">Spoken English Gym</span>
          </h1>

          <div className="mt-6 rounded-2xl bg-purple-50 px-4 py-4">
            <p className="text-sm font-black tracking-[0.12em] text-purple-800 sm:text-base">
              LEARN <span className="text-lime-500">→</span> PRACTICE{" "}
              <span className="text-lime-500">→</span> SPEAK
            </p>
          </div>

          <p className="mt-6 text-lg font-bold leading-relaxed text-slate-800">
            Learn English.
            <br />
            Practice sentences.
            <br />
            Speak with confidence.
          </p>

          <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
            <p className="font-tamil text-base font-bold leading-relaxed text-slate-800 sm:text-lg">
              தினமும் Practice செய்யுங்கள்.
              <br />
              English பேசும் திறனை வளர்த்துக்கொள்ளுங்கள்.
            </p>
          </div>

          <p className="mt-6 text-sm font-black text-slate-600 sm:text-base">
            120 Lessons <span className="text-purple-400">•</span> Beginner or
            Intermediate
          </p>

          <button
            type="button"
            onClick={() => navigate("/spoken-english-offer")}
            className="mt-7 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-yellow-300 to-lime-400 px-6 py-4 text-base font-black text-slate-950 shadow-xl shadow-lime-300/30 transition hover:-translate-y-0.5 hover:shadow-2xl active:translate-y-0 sm:text-lg"
          >
            See Spoken English Gym →
          </button>
        </div>
      </div>
    </div>
  );
}
