// client/src/pages/student/Activation.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  trackActivationView,
  trackAppTrialStarted,
  trackWhatsAppJoinClicked,
} from "@/lib/tracking";

import { sendToFunnelSheet, getStoredFunnelContext } from "@/lib/funnelSheet";

const WHATSAPP_GROUP_URL = "/join-webinar";

function getUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function Activation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const activationViewSent = useRef(false);

  const [whatsappOpened, setWhatsappOpened] = useState(false);

  const user = useMemo(() => getUser(), []);

  /*
    Detect whether this visitor came from the new direct webinar funnel.

    Example:
    /activation?source=free_live_class&segment=work
  */
  const querySource = String(searchParams.get("source") || "")
    .trim()
    .toLowerCase();

  const isFreeLiveClass = querySource === "free_live_class";

  /*
    Preserve the old Activation source for the existing Smart Signup flow.

    Direct webinar registrations will be recorded as:
    source: free_live_class
  */
  const actionSource = isFreeLiveClass ? "free_live_class" : "activation";

  const track = String(
    user?.track || localStorage.getItem("fj_track") || "BEGINNER",
  ).toUpperCase();

  /*
    Read the segment from:

    1. Activation URL
    2. Stored user
    3. New free-live-class storage key
    4. Existing Level Check storage key
  */
  const segment = String(
    searchParams.get("segment") ||
      user?.segment ||
      localStorage.getItem("fj_segment") ||
      localStorage.getItem("fj_level_segment") ||
      "general",
  )
    .trim()
    .toLowerCase();

  /*
    Keep the existing safe practice destination.

    BEGINNER:
    /b/lessons

    INTERMEDIATE:
    /i/lessons
  */
  const practicePath = track === "INTERMEDIATE" ? "/i/lessons" : "/b/lessons";

  useEffect(() => {
    /*
      Prevent duplicate Activation Viewed events in case React runs
      the effect more than once during development.
    */
    if (activationViewSent.current) {
      return;
    }

    activationViewSent.current = true;

    trackActivationView({
      track,
      segment,
      source: actionSource,
    });

    sendActivationAction("Activation Viewed");
  }, [track, segment, actionSource]);

  function sendActivationAction(action) {
    const context = getStoredFunnelContext();

    const contextUser = context.user || {};

    sendToFunnelSheet({
      type: "activation_action",

      name: contextUser.name || user?.name || "",

      email: contextUser.email || user?.email || "",

      whatsapp_number:
        contextUser.whatsapp_number ||
        contextUser.whatsapp ||
        user?.whatsapp_number ||
        user?.whatsapp ||
        "",

      segment: context.segment || segment,

      main_goal: context.main_goal || user?.main_goal || "",

      track: context.track || track,

      action,

      /*
        This is the important change.

        Free-live-class users:
        source = free_live_class

        Existing Smart Signup users:
        source = activation
      */
      source: actionSource,

      page_url: window.location.href,
    });
  }

  function joinWhatsApp() {
    trackWhatsAppJoinClicked({
      source: actionSource,
      track,
      segment,
    });

    sendActivationAction("WhatsApp Clicked");

    localStorage.setItem("fj_whatsapp_clicked", "true");

    setWhatsappOpened(true);

    /*
      Open in a new tab.

      The Activation page stays open so the learner can return and
      start practice.
    */
    window.open(WHATSAPP_GROUP_URL, "_blank", "noopener,noreferrer");
  }

  function startPractice() {
    trackAppTrialStarted({
      source: actionSource,
      track,
      segment,
    });

    sendActivationAction("Start Practice Clicked");

    localStorage.setItem("fj_practice_started", "true");

    localStorage.setItem("fj_practice_source", actionSource);

    navigate(practicePath);
  }

  const heading = isFreeLiveClass
    ? "Your Free Live-Class Seat Is Reserved!"
    : "Your Free FluencyJet Access Is Ready";

  const supportingText = isFreeLiveClass
    ? "Your English practice access is also ready. Complete these 2 quick steps before the live class."
    : "Complete these 2 steps before the live class.";

  const practiceHeading = isFreeLiveClass
    ? "Start Your 3-Minute English Practice"
    : "Start Your Free English Practice";

  const practiceDescription = isFreeLiveClass
    ? "Practise your first English sentences now so you can understand the live class faster."
    : "Practise your first 10 sentences before the live class.";

  const practiceButtonText = isFreeLiveClass
    ? "Start My 3-Minute Practice"
    : "Start Free Practice";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111f] px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      {/* Premium background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.38),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.22),transparent_35%)]" />

      <div className="absolute -right-28 top-10 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="absolute -left-28 bottom-0 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative mx-auto max-w-5xl">
        {/* Confirmation header */}
        <section className="rounded-[2rem] border border-white/10 bg-white p-7 text-center shadow-2xl shadow-violet-950/30 sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
            ✅
          </div>

          <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-violet-700">
            Registration Successful
          </p>

          <h1 className="mx-auto mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
            {heading}
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-600 sm:text-lg">
            {supportingText}
          </p>

          {isFreeLiveClass ? (
            <div className="mx-auto mt-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-800">
              Free live class + English practice access confirmed
            </div>
          ) : null}
        </section>

        {/* Two-step activation */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Step 1 */}
          <section className="relative overflow-hidden rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-xl shadow-emerald-950/10 sm:p-8">
            <div className="absolute right-5 top-5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-800">
              Step 1
            </div>

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-3xl">
              💬
            </div>

            <h2 className="mt-5 text-2xl font-black leading-tight text-slate-950">
              Join the Webinar WhatsApp Group
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 sm:text-base">
              The Zoom link, class reminders and important updates will be
              shared inside the group.
            </p>

            <button
              type="button"
              onClick={joinWhatsApp}
              className="mt-7 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-emerald-100 transition hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              {whatsappOpened
                ? "Open WhatsApp Group Again"
                : "Join Webinar WhatsApp Group"}
            </button>

            {whatsappOpened ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                <p className="text-sm font-black text-emerald-800">
                  WhatsApp group opened ✓
                </p>

                <p className="mt-1 text-xs font-semibold leading-5 text-emerald-700">
                  Return to this page and complete Step 2.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-center text-xs font-semibold leading-5 text-slate-500">
                The group will open in a new browser tab.
              </p>
            )}
          </section>

          {/* Step 2 */}
          <section className="relative overflow-hidden rounded-[2rem] border border-violet-200 bg-white p-6 shadow-xl shadow-violet-950/10 sm:p-8">
            <div className="absolute right-5 top-5 rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-violet-800">
              Step 2
            </div>

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-3xl">
              🚀
            </div>

            <h2 className="mt-5 text-2xl font-black leading-tight text-slate-950">
              {practiceHeading}
            </h2>

            <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 sm:text-base">
              {practiceDescription}
            </p>

            <button
              type="button"
              onClick={startPractice}
              className="mt-7 w-full rounded-2xl bg-violet-700 px-5 py-4 text-base font-black text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-800"
            >
              {practiceButtonText}
            </button>

            <p className="mt-4 text-center text-xs font-semibold leading-5 text-slate-500">
              You will continue inside the FluencyJet English practice area.
            </p>
          </section>
        </div>

        {/* Recommended sequence */}
        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/10 p-6 text-center text-white backdrop-blur sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-300">
            Recommended Order
          </p>

          <p className="mt-3 text-base font-bold leading-7 text-slate-200">
            Join the WhatsApp group first
            <span className="mx-2 text-emerald-300">→</span>
            return to this page
            <span className="mx-2 text-violet-300">→</span>
            start your English practice
          </p>
        </section>
      </div>
    </div>
  );
}
