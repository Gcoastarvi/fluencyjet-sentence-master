import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { smartSignup } from "@/api/apiClient";
import { setToken } from "@/utils/tokenStore";
import { trackSmartSignupView, trackSmartSignupCompleted } from "@/lib/tracking";
import { sendToFunnelSheet } from "@/lib/funnelSheet";
import { useAuth } from "@/context/AuthContext";

const SOURCE = "whatsapp_vsl_help";
const AFTER_SIGNUP_URL = "/b/lesson/1?difficulty=beginner";

const BENEFITS = [
  "Daily sentence practice — just 10 minutes a day",
  "Build real speaking confidence step by step",
  "Track your streaks, XP, and daily progress",
  "WhatsApp reminders to keep your practice going",
  "Free live class seat with a real English teacher",
];

export default function TrySpokenEnglishGym() {
  const { isAuthenticated } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = AFTER_SIGNUP_URL;
      return;
    }
    trackSmartSignupView({
      source: SOURCE,
      track: "BEGINNER",
      segment: "general",
      main_goal: "Build sentences faster",
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp_number: whatsapp.trim(),
        password,
        source: SOURCE,
        track: "BEGINNER",
        segment: "general",
        main_goal: "Build sentences faster",
        current_status: "Not specified",
        practice_commitment: "Yes, I can practise 15 minutes daily",
        reserve_seat: true,
        whatsapp_consent: true,
        level_check_result: "Beginner",
        level_check_score: null,
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
        ...(res.user || {}),
        email: res.email || payload.email,
        track: res.track || "BEGINNER",
        current_unit: res.current_unit || 1,
        has_access: res.has_access ?? false,
        webinar_registered: res.webinar_registered ?? true,
      };
      localStorage.setItem("user", JSON.stringify(userPayload));
      localStorage.setItem("fj_track", "beginner");

      trackSmartSignupCompleted({
        source: SOURCE,
        track: "BEGINNER",
        segment: "general",
        main_goal: payload.main_goal,
      });

      try {
        await Promise.race([
          sendToFunnelSheet({
            type: "whatsapp_trial_signup",
            name: payload.name,
            email: payload.email,
            whatsapp_number: payload.whatsapp_number,
            source: SOURCE,
            track: "BEGINNER",
            page_url: window.location.href,
          }),
          new Promise((r) => setTimeout(r, 1200)),
        ]);
      } catch {
        /* non-critical */
      }

      window.location.href = AFTER_SIGNUP_URL;
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Something went wrong. Please try again.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-indigo-950 px-5 pt-10 pb-9 text-center">
        <span className="inline-flex items-center rounded-full bg-indigo-800/50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-indigo-300">
          WhatsApp Community
        </span>

        <h1
          className="mt-4 text-[1.85rem] font-black leading-tight tracking-tight text-white sm:text-4xl"
          data-testid="text-headline"
        >
          Join the Free{" "}
          <span className="text-amber-400">Spoken English Gym</span>
        </h1>

        <p className="mt-3 text-base font-medium leading-relaxed text-indigo-200">
          Practice real English sentences every day — like a gym workout for
          your speaking confidence.
        </p>

        <div
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-5 py-2 text-sm font-bold text-emerald-300"
          data-testid="text-no-payment"
        >
          No payment required — free to start
        </div>
      </header>

      <section className="bg-slate-50 px-5 py-7">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
          What you get free
        </p>
        <ul className="space-y-3">
          {BENEFITS.map((b) => (
            <li
              key={b}
              className="flex items-start gap-3 text-sm font-semibold text-slate-700"
            >
              <span className="mt-0.5 flex-shrink-0 font-black text-emerald-600">
                ✓
              </span>
              {b}
            </li>
          ))}
        </ul>
      </section>

      <section className="px-5 py-8">
        <h2 className="text-xl font-black text-slate-900">
          Start your free practice
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Create your account in 30 seconds — no payment, no card needed.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
          data-testid="form-signup"
        >
          <Field label="Your name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your full name"
              className="fj-input"
              data-testid="input-name"
              autoComplete="name"
            />
          </Field>

          <Field label="Email address">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="fj-input"
              data-testid="input-email"
              autoComplete="email"
            />
          </Field>

          <Field label="WhatsApp number">
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
              placeholder="9876543210"
              className="fj-input"
              data-testid="input-whatsapp"
              autoComplete="tel"
            />
          </Field>

          <Field label="Create a password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
              className="fj-input"
              data-testid="input-password"
              autoComplete="new-password"
            />
          </Field>

          {error && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              data-testid="error-message"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="button-start-practice"
            className="w-full rounded-2xl bg-indigo-600 px-6 py-4 text-base font-black text-white shadow-lg shadow-indigo-200 transition disabled:opacity-60"
          >
            {loading
              ? "Creating your access…"
              : "Start My Free English Practice"}
          </button>

          <p className="text-center text-xs font-medium text-slate-400">
            No credit card. No payment. Free to start.
          </p>
        </form>

        <div className="mt-7 border-t border-slate-100 pt-6 text-center">
          <p className="text-sm font-medium text-slate-500">
            Already have an account?{" "}
            <Link
              to={`/login?next=${encodeURIComponent(AFTER_SIGNUP_URL)}`}
              className="font-bold text-indigo-600 underline-offset-2 hover:underline"
              data-testid="link-login"
            >
              Log in here
            </Link>
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-slate-50 px-5 py-6 text-center">
        <p className="text-xs font-medium text-slate-400">
          FluencyJet Spoken English Gym &middot; Practice daily &middot; Speak
          with confidence
        </p>
      </footer>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
