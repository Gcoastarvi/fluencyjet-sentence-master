// client/src/pages/student/Paywall.jsx
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { getMe } from "../../api/apiClient";
import { normalizeTrack } from "../../lib/trackRoutes";
import { trackPaywallView } from "../../lib/tracking";
import WebinarInviteCard from "../../components/student/WebinarInviteCard";

export default function Paywall() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null); // FREE | PRO | null
  const [error, setError] = useState(null);

  const [searchParams] = useSearchParams();
  const selectedPlan = (searchParams.get("plan") || "BEGINNER").toUpperCase();
  const from = searchParams.get("from") || "unknown";

  function inferTrack() {
    if (location.pathname.startsWith("/i/")) return "intermediate";
    if (location.pathname.startsWith("/b/")) return "beginner";

    const params = new URLSearchParams(location.search);

    const difficulty = params.get("difficulty");
    if (difficulty) return normalizeTrack(difficulty);

    const track = params.get("track");
    if (track) return normalizeTrack(track);

    const plan = params.get("plan");
    if (String(plan || "").toUpperCase() === "INTERMEDIATE")
      return "intermediate";
    if (String(plan || "").toUpperCase() === "BEGINNER") return "beginner";

    try {
      const storedTrack = localStorage.getItem("fj_track");
      if (storedTrack) return normalizeTrack(storedTrack);

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user?.track) return normalizeTrack(user.track);
    } catch {}

    return "beginner";
  }

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

  const paywallTrack = inferTrack();
  const lessonMatch = String(from || "").match(/lesson_(\d+)/);
  const paywallLessonNumber = lessonMatch ? Number(lessonMatch[1]) : 4;

  // FREE USER WEBINAR-FIRST GATE
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="bg-white shadow-2xl shadow-slate-200/70 rounded-[2rem] p-6 sm:p-8 max-w-md w-full border border-slate-100">
        <div className="text-center">
          <div className="inline-flex rounded-full bg-violet-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-violet-700">
            Free Live Class
          </div>

          <h1 className="mt-5 text-2xl sm:text-3xl font-black text-slate-950 leading-tight">
            Continue Your English Journey with Live Guidance
          </h1>

          <p className="mt-4 text-sm sm:text-base font-semibold leading-relaxed text-slate-600">
            You’ve completed the free starter lessons. Before unlocking more
            lessons, join my free live class and understand the full FluencyJet
            roadmap.
          </p>

          <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
            <p className="font-tamil text-base sm:text-lg font-bold leading-relaxed text-slate-800">
              மேலும் lessons தொடர்வதற்கு முன், என் free live class-ல் சேர்ந்து
              முழு English fluency roadmap-ஐ புரிந்துகொள்ளுங்கள்.
            </p>
          </div>
        </div>

        <WebinarInviteCard
          variant="paywall"
          lessonNumber={paywallLessonNumber}
          track={paywallTrack}
          source={`paywall_lesson_${paywallLessonNumber}`}
        />
      </div>
    </div>
  );
}
