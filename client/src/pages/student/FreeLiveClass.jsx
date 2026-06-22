// client/src/pages/student/FreeLiveClass.jsx

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { smartSignup } from "@/api/apiClient";
import { trackSmartSignupCompleted } from "@/lib/tracking";
import { setToken } from "@/utils/tokenStore";

/*
  CHANGE THESE TWO VALUES BEFORE YOUR NEXT WEBINAR.
*/
const WEBINAR_DATE = "Sunday, 28 June 2026";
const WEBINAR_TIME = "11:00 AM";

const SEGMENT_CONTENT = {
  work: {
    headline: "Speak English Confidently at Work",
    goal: "Speak at work",
  },

  business: {
    headline: "Speak Clearly with Customers and Clients",
    goal: "Speak with customers",
  },

  interview: {
    headline: "Answer Interview Questions with Confidence",
    goal: "Clear interview",
  },

  students: {
    headline: "Improve Your English for Studies and Career",
    goal: "Improve confidence",
  },

  daily: {
    headline: "Speak English Confidently in Daily Life",
    goal: "Daily conversation",
  },

  general: {
    headline: "Speak English Without Fear",
    goal: "Build sentences faster",
  },
};

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeSegment(value) {
  const segment = String(value || "")
    .trim()
    .toLowerCase();

  if (SEGMENT_CONTENT[segment]) {
    return segment;
  }

  return "general";
}

function collectTrackingParams(searchParams) {
  const keys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "source",
    "campaign",
    "adset",
    "ad",
    "fbclid",
  ];

  const data = {};

  for (const key of keys) {
    const value =
      searchParams.get(key) ||
      localStorage.getItem(`fj_${key}`) ||
      sessionStorage.getItem(`fj_${key}`);

    if (value) {
      data[key] = value;
    }
  }

  return data;
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function FreeLiveClass() {
  const [searchParams] = useSearchParams();

  const storedUser = useMemo(() => getStoredUser(), []);

  const segment = normalizeSegment(searchParams.get("segment"));
  const pageContent = SEGMENT_CONTENT[segment];

  const [name, setName] = useState(storedUser?.name || "");
  const [email, setEmail] = useState(storedUser?.email || "");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [password, setPassword] = useState("");
  const [commitmentConfirmed, setCommitmentConfirmed] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateWhatsAppNumber(event) {
    const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 10);
    setWhatsappNumber(digitsOnly);
  }

  function validateForm() {
    if (name.trim().length < 2) {
      return "Please enter your name.";
    }

    if (!validateEmail(email.trim())) {
      return "Please enter a valid email address.";
    }

    if (!/^[6-9]\d{9}$/.test(whatsappNumber)) {
      return "Please enter a valid 10-digit WhatsApp number.";
    }

    if (password.length < 6) {
      return "Please create a password with at least 6 characters.";
    }

    if (!commitmentConfirmed) {
      return "Please confirm that you want to reserve your live-class seat.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const trackingParams = collectTrackingParams(searchParams);

      /*
        We reuse the existing Smart Signup backend.

        The learner is placed into the Beginner practice track internally,
        but the landing page does not label the learner as Beginner.
      */
      const payload = {
        name: name.trim(),

        email: email.trim().toLowerCase(),

        whatsapp_number: whatsappNumber.trim(),

        password,

        current_status: "Not specified",

        main_goal: pageContent.goal,

        practice_commitment: "Yes, I can practise 15 minutes daily",

        reserve_seat: true,

        whatsapp_consent: true,

        track: "BEGINNER",

        level_check_result: "Level check not completed",

        level_check_score: null,

        ...trackingParams,

        source: trackingParams.source || "free_live_class",

        segment,
      };

      const res = await smartSignup(payload);

      if (!res?.ok) {
        setError(
          res?.message ||
            "Registration failed. Please check your details and try again.",
        );

        setLoading(false);
        return;
      }

      if (res.token) {
        setToken(res.token);
        localStorage.setItem("token", res.token);
      }

      const userPayload = {
        ...(storedUser || {}),
        ...(res.user || {}),

        email: res.email || payload.email,

        /*
          Direct webinar registrants start with the Beginner practice lessons.
          We do not show this classification on the landing page.
        */
        track: res.track || "BEGINNER",

        current_unit: res.current_unit || 1,

        has_access: res.has_access ?? false,

        webinar_registered: res.webinar_registered ?? true,

        registration_source: "free_live_class",

        segment,
      };

      localStorage.setItem("user", JSON.stringify(userPayload));

      localStorage.setItem("fj_track", "beginner");

      localStorage.setItem("fj_registration_source", "free_live_class");

      localStorage.setItem("fj_segment", segment);

      trackSmartSignupCompleted({
        track: "BEGINNER",
        source: "free_live_class",
        segment,
      });

      if (typeof window.gtag === "function") {
        window.gtag("event", "webinar_signup_completed", {
          registration_source: "free_live_class",
          segment,
          main_goal: pageContent.goal,
        });
      }

      /*
        Use the existing Activation page.
        It already connects the user to WhatsApp and app practice.
      */
      window.location.href = res.redirect || "/activation";
    } catch (err) {
      console.error("Free live class signup error:", err);

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Something went wrong. Please check your details and try again.";

      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {/* =========================================================
          PREMIUM HERO
      ========================================================== */}
      <section className="relative overflow-hidden bg-[#07111f] text-white">
        {/* Premium background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.42),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.22),transparent_34%)]" />

        <div className="absolute -right-28 top-10 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="absolute -left-28 bottom-0 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            {/* =====================================================
                LEFT SIDE — PROMISE AND CREDIBILITY
            ====================================================== */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/30 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-100 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Free Live Zoom Class for Tamil Speakers
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.03] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                {pageContent.headline}
              </h1>

              <p className="mt-5 max-w-3xl text-2xl font-black leading-tight text-emerald-300 sm:text-3xl">
                No Fear. No Confusion. Just Results.
              </p>

              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-200 sm:text-xl">
                Build English sentences faster using the FluencyJet Sentence
                Master App and Aravind&apos;s powerful memory-based learning
                method.
              </p>

              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-300 sm:text-lg">
                Join the free live class, create your app account and practise
                your first English sentences before the class begins.
              </p>

              {/* Tamil message */}
              <div className="mt-6 rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/10 p-5 backdrop-blur">
                <p className="font-tamil text-base font-bold leading-8 text-emerald-50 sm:text-lg">
                  English words தெரிந்தும் sentence உருவாக்கி confident-ஆக பேச
                  முடியவில்லையா? Simple sentence patterns மற்றும் memory method
                  மூலம் எளிதாக பேசுவது எப்படி என்று இந்த இலவச live class-ல்
                  கற்றுக்கொள்ளுங்கள்.
                </p>
              </div>

              {/* Trainer credibility */}
              <div className="mt-6 flex items-center gap-4 rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <img
                  src="/avatar-fallback.png"
                  alt="Aravind, FluencyJet English Coach"
                  width="72"
                  height="72"
                  loading="eager"
                  decoding="async"
                  className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/20 sm:h-[72px] sm:w-[72px]"
                />

                <div>
                  <p className="text-base font-black text-white sm:text-lg">
                    Aravind • English Coach & Memory Trainer
                  </p>

                  <p className="mt-1 text-sm font-bold leading-6 text-slate-300">
                    Guinness World Record holder • Founder of FluencyJet •
                    35,000+ students trained
                  </p>
                </div>
              </div>

              {/* Date and time */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.25rem] border border-yellow-300/20 bg-yellow-300/10 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-200">
                    Live Class Date
                  </p>

                  <p className="mt-2 text-xl font-black text-white">
                    {WEBINAR_DATE}
                  </p>
                </div>

                <div className="rounded-[1.25rem] border border-emerald-300/20 bg-emerald-300/10 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
                    Class Time
                  </p>

                  <p className="mt-2 text-xl font-black text-white">
                    {WEBINAR_TIME} IST
                  </p>
                </div>
              </div>

              {/* Trust badges */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur">
                  <p className="text-lg font-black text-yellow-300">Free</p>

                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">
                    Live Class
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur">
                  <p className="text-lg font-black text-emerald-300">Tamil</p>

                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">
                    Explanation
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur">
                  <p className="text-lg font-black text-violet-200">Free</p>

                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">
                    App Access
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur">
                  <p className="text-lg font-black text-blue-200">Zoom</p>

                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">
                    Link on WhatsApp
                  </p>
                </div>
              </div>

              {/* Mobile / secondary CTA */}
              <a
                href="#register"
                className="mt-7 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-yellow-400 px-7 text-base font-black text-slate-950 shadow-xl shadow-yellow-500/20 transition hover:-translate-y-0.5 hover:bg-yellow-300 sm:w-auto"
              >
                Reserve My Free Seat →
              </a>
            </div>

            {/* =====================================================
                RIGHT SIDE — SIGNUP FORM
            ====================================================== */}
            <div
              id="register"
              className="scroll-mt-6 rounded-[2rem] border border-white/10 bg-white p-5 text-slate-950 shadow-2xl shadow-violet-950/30 sm:p-6 lg:sticky lg:top-6 lg:p-7"
            >
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
                  Free Registration
                </p>

                <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
                  Reserve Your Live-Class Seat + Unlock Free English Practice
                </h2>

                {/* Webinar strip */}
                <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
                    Upcoming Live Webinar
                  </p>

                  <p className="mt-2 text-base font-black text-slate-950">
                    {WEBINAR_DATE} • {WEBINAR_TIME} IST
                  </p>
                </div>

                {/* Quick credibility */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-violet-50 p-3">
                    <p className="text-lg font-black text-violet-700">35K+</p>

                    <p className="text-[11px] font-bold text-slate-600">
                      Students
                    </p>
                  </div>

                  <div className="rounded-2xl bg-emerald-50 p-3">
                    <p className="text-lg font-black text-emerald-700">Live</p>

                    <p className="text-[11px] font-bold text-slate-600">Zoom</p>
                  </div>

                  <div className="rounded-2xl bg-yellow-50 p-3">
                    <p className="text-lg font-black text-yellow-700">Free</p>

                    <p className="text-[11px] font-bold text-slate-600">
                      App + Seat
                    </p>
                  </div>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit}>
                  {/* Name */}
                  <div>
                    <label
                      htmlFor="free-live-name"
                      className="mb-1 block text-sm font-bold text-slate-800"
                    >
                      Name
                    </label>

                    <input
                      id="free-live-name"
                      type="text"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                    />
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <label
                      htmlFor="free-live-whatsapp"
                      className="mb-1 block text-sm font-bold text-slate-800"
                    >
                      WhatsApp Number
                    </label>

                    <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-100">
                      <span className="flex items-center border-r border-slate-200 px-4 text-sm font-black text-slate-600">
                        +91
                      </span>

                      <input
                        id="free-live-whatsapp"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        required
                        value={whatsappNumber}
                        onChange={updateWhatsAppNumber}
                        placeholder="9876543210"
                        maxLength={10}
                        className="min-w-0 flex-1 bg-transparent px-4 py-3.5 font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="free-live-email"
                      className="mb-1 block text-sm font-bold text-slate-800"
                    >
                      Email
                    </label>

                    <input
                      id="free-live-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="free-live-password"
                      className="mb-1 block text-sm font-bold text-slate-800"
                    >
                      Create Your Practice Password
                    </label>

                    <div className="relative">
                      <input
                        id="free-live-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 pr-16 font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((currentValue) => !currentValue)
                        }
                        className="absolute inset-y-0 right-0 px-4 text-xs font-black text-violet-700"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  {error ? (
                    <div
                      role="alert"
                      className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold leading-6 text-red-700"
                    >
                      {error}
                    </div>
                  ) : null}

                  {/* CTA */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-2xl bg-violet-700 px-8 py-4 text-base font-black text-white shadow-xl shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
                  >
                    {loading
                      ? "Creating Your Account..."
                      : "Reserve My Free Seat & Start Practice"}
                  </button>

                  <p className="text-center text-sm font-bold text-violet-700">
                    Reserve Your Free Live-Class Seat + Unlock English Practice
                  </p>

                  <p className="text-center text-xs font-semibold leading-relaxed text-slate-600">
                    No payment required. The Zoom link and class reminders will
                    be shared through WhatsApp.
                  </p>

                  <p className="border-t border-slate-200 pt-4 text-center text-xs font-semibold leading-5 text-slate-500">
                    Already have a FluencyJet account? Enter the same email and
                    password to reserve your seat.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          WHAT THEY GET
      ========================================================== */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-violet-700">
            What You&apos;ll Get
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Learn the method and practise it immediately
          </h2>

          <p className="mt-5 text-base font-semibold leading-8 text-slate-600 sm:text-lg">
            This is not just another lecture. You will understand the
            sentence-making method and get the opportunity to practise it inside
            the FluencyJet app.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              number: "1",
              title: "Build sentences with simple patterns",
              text: "Learn how to make many useful English sentences from one easy structure.",
              tamil:
                "ஒரு simple pattern மூலம் பல English sentences உருவாக்குவது எப்படி என்று கற்றுக்கொள்ளுங்கள்.",
            },

            {
              number: "2",
              title: "Speak without freezing",
              text: "Train your mind to recall useful sentence structures faster while speaking.",
              tamil:
                "பேசும்போது sentence உடனே நினைவுக்கு வரும்படி practice செய்வது எப்படி என்று தெரிந்துகொள்ளுங்கள்.",
            },

            {
              number: "3",
              title: "Practise with the FluencyJet app",
              text: "Create your free account and experience guided sentence-making practice.",
              tamil:
                "Free FluencyJet account உருவாக்கி sentence practice-ஐ உடனே தொடங்குங்கள்.",
            },
          ].map((item) => (
            <div
              key={item.number}
              className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-100 transition hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-lg font-black text-violet-700">
                {item.number}
              </div>

              <h3 className="text-xl font-black leading-snug text-slate-950">
                {item.title}
              </h3>

              <p className="mt-3 text-base font-semibold leading-7 text-slate-600">
                {item.text}
              </p>

              <p className="font-tamil mt-4 text-base font-bold leading-7 text-slate-700">
                {item.tamil}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a
            href="#register"
            className="inline-flex h-14 items-center justify-center rounded-2xl bg-violet-700 px-8 text-base font-black text-white shadow-xl shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-800"
          >
            Reserve My Free Seat
          </a>
        </div>
      </section>

      {/* =========================================================
          WHO IT IS FOR + FREE ACCESS
      ========================================================== */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-7 shadow-lg shadow-slate-100 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">
              Who Is This For?
            </p>

            <ul className="mt-5 space-y-4 text-base font-bold leading-7 text-slate-700">
              <li className="flex gap-3">
                <span className="text-emerald-600">✓</span>

                <span>
                  Tamil speakers who understand English but struggle to speak
                  confidently
                </span>
              </li>

              <li className="flex gap-3">
                <span className="text-emerald-600">✓</span>

                <span>
                  Students, job seekers, working professionals and business
                  owners
                </span>
              </li>

              <li className="flex gap-3">
                <span className="text-emerald-600">✓</span>

                <span>
                  Anyone who wants to build simple English sentences faster
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-50 to-emerald-50 p-7 shadow-lg shadow-slate-100 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">
              Your Free Access
            </p>

            <h3 className="mt-4 text-2xl font-black text-slate-950">
              Live class + Sentence Master app practice
            </h3>

            <ul className="mt-5 space-y-4 text-base font-bold leading-7 text-slate-700">
              <li className="flex gap-3">
                <span>✅</span>

                <span>Free live English sentence-making class</span>
              </li>

              <li className="flex gap-3">
                <span>✅</span>

                <span>Instant FluencyJet Sentence Master account</span>
              </li>

              <li className="flex gap-3">
                <span>✅</span>

                <span>Guided English sentence practice before the class</span>
              </li>

              <li className="flex gap-3">
                <span>✅</span>

                <span>Zoom link and class reminders through WhatsApp</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* =========================================================
          FINAL CTA
      ========================================================== */}
      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-gradient-to-br from-violet-800 to-slate-950 px-6 py-10 text-center text-white shadow-2xl shadow-violet-200 sm:px-10 sm:py-12">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-yellow-300">
            Free Live Zoom Class
          </p>

          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
            Ready to build English sentences without fear or confusion?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-300">
            Register for {WEBINAR_DATE} at {WEBINAR_TIME} IST, unlock your free
            app account and begin your sentence-making practice.
          </p>

          <a
            href="#register"
            className="mt-7 inline-flex h-14 items-center justify-center rounded-2xl bg-yellow-400 px-8 text-base font-black text-slate-950 shadow-xl shadow-yellow-500/20 transition hover:-translate-y-0.5 hover:bg-yellow-300"
          >
            Reserve My Free Seat & Start Practice →
          </a>
        </div>
      </section>

      {/* =========================================================
          FAQ
      ========================================================== */}
      <section className="mx-auto max-w-4xl px-5 pb-20 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-3xl font-black text-slate-950">FAQ</h2>

        <div className="space-y-4">
          {[
            [
              "Is the live class free?",
              "Yes. The live Zoom class and your initial FluencyJet app access are free.",
            ],

            [
              "Will the class be in Tamil or English?",
              "The class will use simple English with clear Tamil explanation.",
            ],

            [
              "How will I receive the Zoom link?",
              "The Zoom link and class reminders will be shared through the webinar WhatsApp group.",
            ],

            [
              "Why do I need to create an app password?",
              "Your password creates your free FluencyJet account so you can practise English sentences before and after the class.",
            ],

            [
              "Do I need to complete an English level test?",
              "No. You can register directly, create your account and begin with the first sentence practice.",
            ],
          ].map(([question, answer]) => (
            <div
              key={question}
              className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
            >
              <h3 className="font-black text-slate-950">{question}</h3>

              <p className="mt-2 font-semibold leading-7 text-slate-600">
                {answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================
          FOOTER
      ========================================================== */}
      <footer className="border-t border-slate-200 bg-white px-5 py-8 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold leading-6 text-slate-500">
            This site is not a part of the Facebook website or Meta Platforms,
            Inc. Additionally, this site is not endorsed by Facebook or Meta in
            any way. Facebook is a trademark of Meta Platforms, Inc.
          </p>

          <p className="mt-4 text-xs font-semibold leading-6 text-slate-500">
            Results may vary from person to person. English improvement depends
            on your current level, consistency and regular practice.
          </p>

          <p className="mt-4 text-xs font-bold text-slate-600">
            © {new Date().getFullYear()} FluencyJet. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
// 