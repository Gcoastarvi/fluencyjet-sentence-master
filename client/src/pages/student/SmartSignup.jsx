// client/src/pages/student/SmartSignup.jsx
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { smartSignup } from "@/api/apiClient";
import { setToken } from "@/utils/tokenStore";
import { trackSmartSignupCompleted } from "@/lib/tracking";

const STATUS_OPTIONS = [
  "Student",
  "Job seeker",
  "Working professional",
  "Business owner",
  "Homemaker",
  "Other",
];

const GOAL_OPTIONS = [
  "Speak at work",
  "Clear interview",
  "Speak with customers",
  "Daily conversation",
  "Improve confidence",
  "Build sentences faster",
];

const COMMITMENT_OPTIONS = [
  "Yes, I can practise 15 minutes daily",
  "Maybe",
  "Not sure",
];

const SMART_SIGNUP_SEGMENTS = {
  work: {
    title: "Your Workplace Speaking Level",
    diagnosis:
      "Your main challenge may be sentence formation speed in meetings, calls, and office conversations.",
  },
  interview: {
    title: "Your Interview English Level",
    diagnosis:
      "You need to practise self-introduction, answer patterns, and confidence-building sentence structures.",
  },
  business: {
    title: "Your Business English Confidence Level",
    diagnosis:
      "You need simple sentence patterns for customers, clients, and business conversations.",
  },
  students: {
    title: "Your Student/Career English Level",
    diagnosis:
      "You need sentence patterns for presentations, interviews, and classroom confidence.",
  },
  daily: {
    title: "Your Daily English Speaking Level",
    diagnosis:
      "You need simple sentence patterns for daily conversations, shopping, travel, phone calls, and social situations.",
  },
  general: {
    title: "Your English Speaking Level",
    diagnosis:
      "You need simple sentence-making practice to speak English with more confidence.",
  },
};

function getSmartSignupSegmentCopy(segment) {
  return SMART_SIGNUP_SEGMENTS[segment] || SMART_SIGNUP_SEGMENTS.general;
}

function getLevelDisplayName(resultLabel) {
  const value = String(resultLabel || "").toLowerCase();

  if (value.includes("intermediate")) return "Intermediate Flow";
  if (value.includes("advanced")) return "Advanced Fluency";

  return "Beginner Foundation";
}

function getStoredLevel() {
  try {
    const raw = sessionStorage.getItem("fj_level_result");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
  ];

  const data = {};
  for (const key of keys) {
    const value =
      searchParams.get(key) ||
      localStorage.getItem(`fj_${key}`) ||
      sessionStorage.getItem(`fj_${key}`);

    if (value) data[key] = value;
  }

  return data;
}

function normalizeTrack(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("intermediate") || v.includes("advanced"))
    return "INTERMEDIATE";
  return "BEGINNER";
}

function getInitialMainGoal(searchParams, storedLevel) {
  const goalFromUrl = searchParams.get("goal");
  const goalFromStorage =
    storedLevel?.main_goal ||
    storedLevel?.default_goal ||
    storedLevel?.goal ||
    localStorage.getItem("fj_main_goal");

  const goal = goalFromUrl || goalFromStorage || "";

  return GOAL_OPTIONS.includes(goal) ? goal : "";
}

function getInitialSegment(searchParams, storedLevel) {
  return (
    searchParams.get("segment") ||
    storedLevel?.segment ||
    localStorage.getItem("fj_level_segment") ||
    "general"
  );
}

export default function SmartSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const storedLevel = useMemo(() => getStoredLevel(), []);
  const storedUser = useMemo(() => getStoredUser(), []);

  const initialTrack = normalizeTrack(
    searchParams.get("track") ||
      storedLevel?.track ||
      storedLevel?.level ||
      localStorage.getItem("fj_track") ||
      storedUser?.track,
  );

  const resultLabel =
    storedLevel?.level ||
    storedLevel?.level_check_result ||
    searchParams.get("level") ||
    (initialTrack === "INTERMEDIATE" ? "Intermediate" : "Beginner");

  const score =
    storedLevel?.score ??
    storedLevel?.level_check_score ??
    searchParams.get("score") ??
    null;

  const segment = getInitialSegment(searchParams, storedLevel);
  const signupCopy = getSmartSignupSegmentCopy(segment);
  const levelDisplayName = getLevelDisplayName(resultLabel);

  const [name, setName] = useState(
    searchParams.get("name") || storedUser?.name || "",
  );
  const [email, setEmail] = useState(storedUser?.email || "");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [password, setPassword] = useState("");
  const [currentStatus] = useState("Not specified");
  const [mainGoal, setMainGoal] = useState(() =>
    getInitialMainGoal(searchParams, storedLevel),
  );
  const [practiceCommitment] = useState("Yes, I can practise 15 minutes daily");
  const [reserveSeat] = useState(true);
  const [whatsappConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const next = searchParams.get("next") || "/activation";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const trackingParams = collectTrackingParams(searchParams);

      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp_number: whatsappNumber.trim(),
        password,
        current_status: currentStatus,
        main_goal: mainGoal,
          segment,
          practice_commitment: practiceCommitment,
        reserve_seat: reserveSeat,
        whatsapp_consent: whatsappConsent,
        track: initialTrack,
        level_check_result: resultLabel,
        level_check_score: score,
        ...trackingParams,
      };

      const res = await smartSignup(payload);

      if (!res?.ok) {
        setError(res?.message || "Signup failed. Please try again.");
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
        track: res.track || initialTrack,
        current_unit: res.current_unit || 1,
        has_access: res.has_access ?? false,
        webinar_registered: res.webinar_registered ?? true,
      };

      localStorage.setItem("user", JSON.stringify(userPayload));
      localStorage.setItem(
        "fj_track",
        String(userPayload.track || initialTrack).toLowerCase(),
      );

      trackSmartSignupCompleted({
        track: userPayload.track || initialTrack,
        source: "smart_signup",
      });

      window.location.href = res.redirect || next || "/activation";
    } catch (err) {
      console.error("Smart signup error:", err);
      setError(
        err?.response?.data?.message ||
          "Something went wrong. Please check your details and try again.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-4 py-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-indigo-100 bg-white/80 p-6 shadow-sm">
          <div className="inline-flex rounded-full bg-indigo-100 px-4 py-2 text-sm font-black text-indigo-700">
            Level Check Completed
          </div>

          <h1 className="mt-5 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            Your English Speaking Level:
            <span className="block text-indigo-700">{resultLabel}</span>
          </h1>

          <p className="mt-4 text-base font-medium leading-relaxed text-slate-600">
            Create your free FluencyJet account and reserve your free live class
            seat.
          </p>

          <div className="mt-6 space-y-3 rounded-3xl bg-indigo-950 p-5 text-white">
            <p className="text-sm font-bold uppercase tracking-widest text-indigo-200">
              Your free access includes
            </p>
            <div className="grid gap-3 text-sm font-semibold">
              <div>✅ Free Sentence Master app practice</div>
              <div>✅ Live class seat reservation</div>
              <div>✅ WhatsApp class reminders</div>
              <div>✅ XP, streaks, dashboard tracking</div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-black text-amber-900">
              Before the live class, practise your first 10 sentences.
            </p>
            <p className="mt-2 text-sm font-medium text-amber-800">
              This will help you understand the FluencyJet method faster during
              the class.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
          <h2 className="text-2xl font-black text-slate-950">
            Create Free App Account + Free Live Class
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-600">
            One simple step to unlock your app access and live class seat.
          </p>

            <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">
              Recommended goal: {mainGoal || "Build sentences faster"}
            </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  className="fj-input"
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="fj-input"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="WhatsApp number">
                <input
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  required
                  placeholder="9876543210"
                  className="fj-input"
                />
              </Field>

              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Create App password"
                  className="fj-input"
                />
              </Field>
            </div>

            <Field label="Main goal">
              <select
                value={mainGoal}
                onChange={(e) => setMainGoal(e.target.value)}
                required
                className="fj-input"
              >
                <option value="">Select your main goal</option>
                {GOAL_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-indigo-600 px-6 py-4 text-lg font-black text-white shadow-xl shadow-indigo-100 transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading
                ? "Creating your access..."
                : "Create Free App Account + Free Live Class"}
            </button>

            <p className="text-center text-xs font-medium text-slate-500">
              Already have an account? Use the same email and password to
              reserve your seat.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
