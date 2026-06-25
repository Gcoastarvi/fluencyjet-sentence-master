import { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { sendToFunnelSheet } from "@/lib/funnelSheet";
import { trackEvent } from "@/lib/tracking";

const SOURCE = "whatsapp_group";
const LESSON_DESTINATION = "/b/lesson/1?difficulty=beginner";
const VALID_SEGMENTS = new Set([
  "work",
  "business",
  "interview",
  "students",
  "daily",
  "general",
]);

function normalizeSegment(value) {
  const segment = String(value || "")
    .trim()
    .toLowerCase();

  return VALID_SEGMENTS.has(segment) ? segment : "general";
}

function getPageUrl() {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

function buildLoginDestination() {
  const params = new URLSearchParams({
    next: LESSON_DESTINATION,
  });

  return `/login?${params.toString()}`;
}

function buildLevelCheckDestination(segment) {
  const params = new URLSearchParams({
    source: SOURCE,
    utm_source: "whatsapp",
    utm_medium: "group",
    utm_campaign: "live_class",
    segment,
  });

  return `/level-check?${params.toString()}`;
}

function trackStartPracticeAction(action, segment, destinationUrl = "") {
  const pageUrl = getPageUrl();
  const params = {
    source: SOURCE,
    segment,
    page_url: pageUrl,
    destination_url: destinationUrl,
  };

  try {
    trackEvent(action, params);
  } catch {}

  try {
    void sendToFunnelSheet({
      type: "start_practice_action",
      action,
      source: SOURCE,
      segment,
      name: "",
      email: "",
      whatsapp_number: "",
      main_goal: "",
      track: "",
      page_url: pageUrl,
      destination_url: destinationUrl,
    });
  } catch {}
}

function LoadingState({ message = "Preparing your practice..." }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07111f] px-5 text-white">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/10 p-7 text-center shadow-2xl shadow-violet-950/30 backdrop-blur">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-emerald-300" />
        <p className="mt-5 text-base font-black">{message}</p>
      </div>
    </div>
  );
}

export default function StartPractice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading, isAuthenticated } = useAuth();
  const viewedRef = useRef(false);

  const segment = useMemo(
    () => normalizeSegment(searchParams.get("segment")),
    [searchParams],
  );

  const loginDestination = useMemo(() => buildLoginDestination(), []);
  const levelCheckDestination = useMemo(
    () => buildLevelCheckDestination(segment),
    [segment],
  );

  useEffect(() => {
    if (loading || viewedRef.current) return;

    viewedRef.current = true;
    trackStartPracticeAction("Start Practice Page Viewed", segment);
  }, [loading, segment]);

  useEffect(() => {
    if (loading || !isAuthenticated) return;

    navigate(LESSON_DESTINATION, { replace: true });
  }, [loading, isAuthenticated, navigate]);

  function handleExistingAccountClick() {
    trackStartPracticeAction(
      "Existing Account Selected",
      segment,
      loginDestination,
    );
  }

  function handleNewAccountClick() {
    trackStartPracticeAction(
      "New Account Selected",
      segment,
      levelCheckDestination,
    );
  }

  if (loading) {
    return <LoadingState />;
  }

  if (isAuthenticated) {
    return <LoadingState message="Opening Lesson 1..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <section className="relative min-h-screen overflow-hidden bg-[#07111f] px-5 py-8 text-white sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.42),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.22),transparent_34%)]" />
        <div className="absolute -right-28 top-10 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -left-28 bottom-0 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />

        <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              FluencyJet Practice
            </div>

            <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
              Start Your Free English Practice
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-200 sm:text-lg">
              Choose the option that matches you and begin your first FluencyJet
              lesson.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="flex flex-col rounded-[2rem] border border-violet-200 bg-white p-6 text-slate-950 shadow-2xl shadow-violet-950/20 sm:p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-2xl">
                1
              </div>

              <h2 className="mt-5 text-2xl font-black leading-tight">
                I Already Have a FluencyJet Account
              </h2>

              <p className="mt-3 flex-1 text-sm font-semibold leading-7 text-slate-600 sm:text-base">
                Choose this if you already created your email and password
                through the Free Live Class registration page.
              </p>

              <Link
                to={loginDestination}
                onClick={handleExistingAccountClick}
                className="mt-6 inline-flex min-h-14 items-center justify-center rounded-2xl bg-violet-700 px-5 py-4 text-center text-base font-black text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-800 focus:outline-none focus:ring-4 focus:ring-violet-200"
              >
                Log In and Start Lesson 1
              </Link>
            </article>

            <article className="flex flex-col rounded-[2rem] border border-emerald-200 bg-white p-6 text-slate-950 shadow-2xl shadow-emerald-950/20 sm:p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
                2
              </div>

              <h2 className="mt-5 text-2xl font-black leading-tight">
                I Have Not Created My Free App Account
              </h2>

              <p className="mt-3 flex-1 text-sm font-semibold leading-7 text-slate-600 sm:text-base">
                Choose this if you registered only for the webinar and have not
                yet created your FluencyJet password.
              </p>

              <Link
                to={levelCheckDestination}
                onClick={handleNewAccountClick}
                className="mt-6 inline-flex min-h-14 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-4 text-center text-base font-black text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-200"
              >
                Take the Free Level Check
              </Link>
            </article>
          </div>

          <div className="mx-auto mt-5 max-w-3xl rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-5 py-4 text-center backdrop-blur">
            <p className="text-sm font-bold leading-6 text-yellow-50">
              Not sure? If you do not remember creating a password, choose
              &ldquo;Take the Free Level Check.&rdquo;
            </p>
          </div>
        </main>
      </section>
    </div>
  );
}
