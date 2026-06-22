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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Brand */}
        <div className="mb-6 flex items-center justify-center gap-3 lg:justify-start">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-sm font-black text-white shadow-lg shadow-indigo-200">
            FJ
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-700">
              FluencyJet
            </p>

            <p className="text-xs font-bold text-slate-500">Sentence Master</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* LEFT SIDE */}
          <section className="rounded-[2rem] border border-indigo-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="inline-flex rounded-full bg-indigo-100 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
              Free Live Class + Free App Practice
            </div>

            <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
              {pageContent.headline}
            </h1>

            <p className="mt-5 text-base font-medium leading-7 text-slate-600 sm:text-lg">
              Join Aravind Pasupathy&apos;s free Tamil live class and unlock the
              FluencyJet Sentence Master app to practise your first 10 English
              sentences before the class.
            </p>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="font-black text-amber-900">
                தமிழில் விளக்கப்படும் இலவச Spoken English Live Class
              </p>
            </div>

            {/* Webinar information */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-indigo-500">
                  Date
                </p>

                <p className="mt-1 font-black text-slate-900">
                  📅 {WEBINAR_DATE}
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-indigo-500">
                  Time
                </p>

                <p className="mt-1 font-black text-slate-900">
                  🕚 {WEBINAR_TIME}
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-indigo-500">
                  Platform
                </p>

                <p className="mt-1 font-black text-slate-900">
                  💻 Live on Zoom
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-indigo-500">
                  Language
                </p>

                <p className="mt-1 font-black text-slate-900">
                  🗣 Explained in Tamil
                </p>
              </div>
            </div>

            {/* Free access */}
            <div className="mt-6 rounded-3xl bg-indigo-950 p-6 text-white">
              <p className="text-sm font-black uppercase tracking-widest text-indigo-200">
                Your Free Access Includes
              </p>

              <div className="mt-5 grid gap-4 text-sm font-semibold">
                <div className="flex gap-3">
                  <span>✅</span>
                  <span>Free English sentence-making live class</span>
                </div>

                <div className="flex gap-3">
                  <span>✅</span>
                  <span>Instant Sentence Master app account</span>
                </div>

                <div className="flex gap-3">
                  <span>✅</span>
                  <span>First 10-sentence practice challenge</span>
                </div>

                <div className="flex gap-3">
                  <span>✅</span>
                  <span>WhatsApp class link and reminders</span>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-black text-amber-900">
                Before the live class, practise your first 10 sentences.
              </p>

              <p className="mt-2 text-sm font-medium leading-6 text-amber-800">
                This small preparation will help you understand the FluencyJet
                method faster during the class.
              </p>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-indigo-600">
                Learn With
              </p>

              <p className="mt-2 text-xl font-black text-slate-950">
                Aravind Pasupathy
              </p>

              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                Guinness World Record Holder
                <br />
                English and Memory Trainer
                <br />
                35,000+ Students Trained
              </p>
            </div>
          </section>

          {/* RIGHT SIDE */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl sm:p-8 lg:p-10">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
              Free Registration
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Reserve Your Free Live Class Seat
            </h2>

            <p className="mt-3 text-sm font-medium leading-6 text-slate-600 sm:text-base">
              Create your free app account and confirm your live-class
              registration in one simple step.
            </p>

            <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-indigo-500">
                Your Goal
              </p>

              <p className="mt-1 font-black text-indigo-900">
                {pageContent.goal}
              </p>
            </div>

            <form className="mt-7" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                {/* Name */}
                <div>
                  <label
                    className="text-sm font-black text-slate-800"
                    htmlFor="free-live-name"
                  >
                    Name
                  </label>

                  <input
                    id="free-live-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-5 py-4 font-semibold outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                {/* Email */}
                <div>
                  <label
                    className="text-sm font-black text-slate-800"
                    htmlFor="free-live-email"
                  >
                    Email
                  </label>

                  <input
                    id="free-live-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-5 py-4 font-semibold outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label
                    className="text-sm font-black text-slate-800"
                    htmlFor="free-live-whatsapp"
                  >
                    WhatsApp Number
                  </label>

                  <div className="mt-2 flex overflow-hidden rounded-2xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
                    <span className="flex items-center border-r border-slate-200 bg-slate-50 px-4 font-black text-slate-600">
                      +91
                    </span>

                    <input
                      id="free-live-whatsapp"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={whatsappNumber}
                      onChange={updateWhatsAppNumber}
                      placeholder="9876543210"
                      maxLength={10}
                      className="min-w-0 flex-1 px-4 py-4 font-semibold outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label
                    className="text-sm font-black text-slate-800"
                    htmlFor="free-live-password"
                  >
                    Create App Password
                  </label>

                  <div className="relative mt-2">
                    <input
                      id="free-live-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-2xl border border-slate-200 px-5 py-4 pr-16 font-semibold outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 px-4 text-xs font-black text-indigo-600"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Commitment */}
              <label className="mt-6 flex cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={commitmentConfirmed}
                  onChange={(event) =>
                    setCommitmentConfirmed(event.target.checked)
                  }
                  className="mt-1 h-5 w-5 shrink-0 accent-indigo-600"
                />

                <span className="text-sm font-semibold leading-6 text-slate-700">
                  Yes, I want to reserve my seat, receive class reminders and
                  practise my first 10 sentences before the live class.
                </span>
              </label>

              {/* Error */}
              {error ? (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold leading-6 text-red-700"
                >
                  {error}
                </div>
              ) : null}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-base font-black text-white shadow-xl shadow-indigo-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
              >
                {loading
                  ? "Reserving Your Seat..."
                  : "Reserve My Free Seat & Start Practice"}
              </button>

              <p className="mt-3 text-center text-sm font-bold text-slate-500">
                No payment required · No credit card · Instant app access
              </p>

              <p className="mt-6 border-t border-slate-200 pt-5 text-center text-sm font-medium leading-6 text-slate-500">
                Already have a FluencyJet account? Enter the same email address
                and password to reserve your seat.
              </p>

              <p className="mt-3 text-center text-xs leading-5 text-slate-400">
                Your details will be used for app access, webinar reminders and
                essential class updates.
              </p>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
