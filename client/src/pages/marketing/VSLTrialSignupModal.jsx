import { useEffect, useRef, useState } from "react";
import { smartSignup } from "@/api/apiClient";
import { setToken } from "@/utils/tokenStore";
import {
  trackSmartSignupView,
  trackSmartSignupCompleted,
} from "@/lib/tracking";
import { sendToChallengeSignupSheet } from "@/lib/funnelSheet";

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "campaign",
  "adset",
  "ad",
];

function collectAttributionParams() {
  const searchParams = new URLSearchParams(window.location.search);
  const attribution = {};

  for (const key of ATTRIBUTION_KEYS) {
    const value =
      searchParams.get(key) ||
      localStorage.getItem(`fj_${key}`) ||
      sessionStorage.getItem(`fj_${key}`);

    if (value) attribution[key] = value;
  }

  return attribution;
}

export default function VSLTrialSignupModal({
  open,
  onClose,
  source,
  nextPath,
  fallbackUrl,
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const trackedView = useRef(false);

  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = "hidden";

    if (!trackedView.current) {
      trackSmartSignupView({
        source,
        track: "BEGINNER",
        segment: "general",
        main_goal: "Build sentences faster",
      });

      trackedView.current = true;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, loading, onClose, source]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const attribution = collectAttributionParams();

      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp_number: whatsapp.trim(),
        password,
        source,
        track: "BEGINNER",
        segment: "general",
        main_goal: "Build sentences faster",
        current_status: "Not specified",
        practice_commitment: "Yes, I can practice 10 minutes daily",
        reserve_seat: false,
        whatsapp_consent: whatsappConsent,
        level_check_result: "Beginner",
        level_check_score: null,
      };

      const res = await smartSignup(payload);

      if (!res?.ok) {
        setError(res?.message || "Signup failed. Please try again.");
        return;
      }

      if (res.token) {
        setToken(res.token);
        localStorage.setItem("token", res.token);
      }

      const userPayload = {
        ...(res.user || {}),
        email: res.email || payload.email,
        track: res.track || "BEGINNER",
        current_unit: res.current_unit || 1,
        has_access: res.has_access ?? false,
        webinar_registered: res.webinar_registered ?? false,
      };

      localStorage.setItem("user", JSON.stringify(userPayload));
      localStorage.setItem("fj_track", "beginner");

      trackSmartSignupCompleted({
        source,
        track: "BEGINNER",
        segment: "general",
        main_goal: payload.main_goal,
      });

      try {
        await Promise.race([
          sendToChallengeSignupSheet({
            type: "challenge_signup",
            timestamp: new Date().toISOString(),
            user_id: res.user?.id ?? null,
            name: payload.name,
            email: payload.email,
            whatsapp_number: payload.whatsapp_number,
            whatsapp_consent: payload.whatsapp_consent,
            source,
            ...attribution,
            page_url: window.location.href,
            level_check_result: payload.level_check_result,
            level_check_score: payload.level_check_score,
            track: userPayload.track || payload.track,
            segment: payload.segment,
            main_goal: payload.main_goal,
            current_status: payload.current_status,
            practice_commitment: payload.practice_commitment,
            reserve_seat: payload.reserve_seat,
          }),
          new Promise((resolve) => setTimeout(resolve, 1200)),
        ]);
      } catch {
        // Tracking must never prevent signup.
      }

      window.location.href = nextPath;
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vsl-signup-title"
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pb-7 pt-5 text-left text-slate-900 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:px-8 sm:pb-8 sm:pt-7"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2
              id="vsl-signup-title"
              className="text-2xl font-black leading-tight text-slate-950 sm:text-3xl"
            >
              Register பண்ணி முதல் Lesson-ஐ FREE-யா Start பண்ணுங்க.
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close signup"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-600 hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold" htmlFor="vsl-name">
              Your name
            </label>
            <input
              id="vsl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              autoComplete="name"
              placeholder="Enter your full name"
              className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold" htmlFor="vsl-email">
              Email address
            </label>
            <input
              id="vsl-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
              placeholder="Enter your email address"
              className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <div>
            <label
              className="mb-1 block text-sm font-bold"
              htmlFor="vsl-whatsapp"
            >
              WhatsApp number
            </label>
            <input
              id="vsl-whatsapp"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="Enter your WhatsApp number"
              className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <div>
            <label
              className="mb-1 block text-sm font-bold"
              htmlFor="vsl-password"
            >
              Create a password
            </label>
            <input
              id="vsl-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <input
              type="checkbox"
              checked={whatsappConsent}
              onChange={(e) => setWhatsappConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0"
            />

            <span>
              <strong className="block text-sm text-slate-900">
                Get FluencyJet practice reminders on WhatsApp
              </strong>
              <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                Practice reminders + useful FluencyJet updates. You can opt out
                anytime.
              </span>
            </span>
          </label>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
            >
              {error}

              {fallbackUrl && (
                <div className="mt-2">
                  <a href={fallbackUrl} className="underline">
                    Open the full signup page
                  </a>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-violet-700 to-indigo-600 px-5 py-4 text-base font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
          >
            {loading
              ? "Starting..."
              : "Start Practice →"}
          </button>

          <p className="text-center text-xs font-semibold text-slate-500 sm:text-sm">
            No payment required. Start practising immediately.
          </p>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <a
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            className="font-bold text-violet-700 underline"
          >
            Log in here
          </a>
        </p>
      </div>
    </div>
  );
}
