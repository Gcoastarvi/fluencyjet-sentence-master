// client/src/pages/marketing/TrySpokenEnglishGym.jsx
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { smartSignup } from "@/api/apiClient";
import { setToken } from "@/utils/tokenStore";
import {
  trackSmartSignupView,
  trackSmartSignupCompleted,
} from "@/lib/tracking";
import { sendToFunnelSheet } from "@/lib/funnelSheet";
import { useAuth } from "@/context/AuthContext";
import "./TrySpokenEnglishGym.css";

const CHALLENGE_STORAGE_KEY = "fj_guest_challenge_v1";
const FULL_PRICE = "₹1,199";

const BENEFITS = [
  {
    icon: "↔",
    title: "Translate Less in Your Mind",
    text: "Practice complete English patterns. Slowly reduce the need to translate every word from Tamil.",
  },
  {
    icon: "⚡",
    title: "Make Sentences Faster",
    text: "Practice useful sentence patterns again and again. Bring the right sentence to mind more easily.",
  },
  {
    icon: "✓",
    title: "Use Grammar More Accurately",
    text: "Learn correct word order and tense patterns by practising—not only by memorising rules.",
  },
  {
    icon: "🎧",
    title: "Understand Spoken English Better",
    text: "Listen to clear English sentences. Train your ears to catch words and meaning more easily.",
  },
  {
    icon: "🎙",
    title: "Speak With Less Fear",
    text: "Listen, repeat, and practice privately. Feel more comfortable before speaking with other people.",
  },
  {
    icon: "🔥",
    title: "Build a Daily Practice Habit",
    text: "Complete short quizzes. Earn XP. See your progress. Continue from where you stopped.",
  },
];

const PRACTICE_TYPES = [
  {
    mode: "reorder",
    title: "Reorder Practice",
    text: "Arrange the words in the correct order and train your sentence structure.",
    mediaSrc: "/practice-modes/reorder.mp4",
    number: "01",
  },
  {
    mode: "typing",
    title: "Typing Practice",
    text: "See the Tamil meaning and type the correct English sentence yourself.",
    mediaSrc: "/practice-modes/typing.mp4",
    number: "02",
  },
  {
    mode: "voice",
    title: "Speaking Practice",
    text: "Listen to the sentence, repeat it aloud, and build speaking confidence.",
    mediaSrc: "/practice-modes/voice.mp4",
    number: "03",
  },
  {
    mode: "dictation",
    title: "Listening Practice",
    text: "Listen carefully and type what you hear. Improve listening and sentence memory.",
    mediaSrc: "/practice-modes/dictation.mp4",
    number: "04",
  },
];

const PRODUCT_STATS = [
  ["120", "Step-by-step lessons"],
  ["4,800", "Guided exercises"],
  ["4", "Ways to practice"],
  ["2", "Learning paths"],
  ["10 min", "Daily workouts"],
  ["1 year", "Complete access"],
];

const FAQ_ITEMS = [
  {
    question: "Do I need to pay now?",
    answer:
      "No. Create your account and complete your first lesson free. No card is needed now.",
  },
  {
    question: "What does complete access cost?",
    answer:
      "Complete one-year FluencyJet access costs ₹1,199. It is a one-time payment.",
  },
  {
    question: "Is there a monthly subscription?",
    answer:
      "No. There is no monthly subscription and no automatic monthly payment.",
  },
  {
    question: "Is FluencyJet suitable for beginners?",
    answer:
      "Yes. FluencyJet has a clear Beginner path. An Intermediate path is also available.",
  },
  {
    question: "Is this another video course?",
    answer:
      "No. FluencyJet is an active practice app. You build, type, listen to, and speak English sentences.",
  },
  {
    question: "How much should I practice?",
    answer:
      "Start with around 10 minutes a day. Regular practice is more important than long, irregular study.",
  },
  {
    question: "Can I use FluencyJet on my phone?",
    answer:
      "Yes. You can use FluencyJet in a supported web browser on your phone, tablet, or computer.",
  },
];

function getSafeNextPath(value) {
  // This funnel already gives the learner seven Reorder questions.
  // Skip the second Reorder warm-up and take new users to the lesson list.
  if (!value || value === "/quick-start") {
    return "/b/lessons";
  }

  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
  ) {
    return value;
  }

  return "/b/lessons";
}

function readGuestChallenge() {
  try {
    const savedResult = localStorage.getItem(CHALLENGE_STORAGE_KEY);
    if (!savedResult) return null;

    const parsedResult = JSON.parse(savedResult);
    const xp = Number(parsedResult?.xp);

    if (!Number.isFinite(xp)) return null;

    return {
      ...parsedResult,
      xp,
    };
  } catch (error) {
    console.warn("Unable to read the guest challenge result:", error);
    localStorage.removeItem(CHALLENGE_STORAGE_KEY);
    return null;
  }
}

function PracticeModeIcon({ type }) {
  const common = "h-5 w-5 stroke-current";

  if (type === "reorder") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={common}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 7h11" />
        <path d="m15 4 3 3-3 3" />
        <path d="M17 17H6" />
        <path d="m9 14-3 3 3 3" />
      </svg>
    );
  }

  if (type === "typing") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={common}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M7 9h.01M11 9h.01M15 9h.01M18 9h.01" />
        <path d="M7 13h.01M11 13h.01M15 13h.01" />
        <path d="M8 16h8" />
      </svg>
    );
  }

  if (type === "voice") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={common}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
        <path d="M12 17.5V21" />
        <path d="M9 21h6" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={common}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 13V9a8 8 0 0 1 16 0v4" />
      <path d="M4 12h3v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 1-2Z" />
      <path d="M20 12h-3v7h2a2 2 0 0 0 2-2v-3a2 2 0 0 0-1-2Z" />
      <path d="M12 19h3" />
    </svg>
  );
}

function PracticeMock({ title, text, mediaSrc, mode, number }) {
  const styles = {
    reorder: {
      badge: "bg-purple-100 text-purple-800",
      icon: "from-purple-950 to-purple-700 text-lime-300",
      line: "from-purple-500 to-lime-300",
    },
    typing: {
      badge: "bg-orange-100 text-orange-800",
      icon: "from-orange-700 to-purple-900 text-yellow-200",
      line: "from-orange-400 to-purple-500",
    },
    voice: {
      badge: "bg-emerald-100 text-emerald-800",
      icon: "from-emerald-700 to-purple-900 text-lime-200",
      line: "from-emerald-400 to-purple-500",
    },
    dictation: {
      badge: "bg-sky-100 text-sky-800",
      icon: "from-sky-700 to-purple-900 text-cyan-100",
      line: "from-sky-400 to-purple-500",
    },
  }[mode];

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 shadow-2xl shadow-black/25 transition duration-300 hover:-translate-y-1 hover:shadow-purple-900/40">
      <div className={`h-1.5 bg-gradient-to-r ${styles.line}`} />

      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-purple-950 to-slate-950 p-3 sm:p-5">
        <div className="relative mx-auto w-full max-w-[280px]">
          <div className="absolute inset-3 rounded-[2.2rem] bg-purple-500/25 blur-2xl" />

          <div className="relative overflow-hidden rounded-[2rem] border-[9px] border-slate-900 bg-slate-950 shadow-2xl">
            <video
              src={mediaSrc}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="aspect-[9/16] w-full bg-slate-950 object-cover"
              aria-label={`${title} demonstration`}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col rounded-b-[2rem] bg-white p-6 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ${styles.icon}`}
          >
            <PracticeModeIcon type={mode} />
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${styles.badge}`}
          >
            Mode {number}
          </span>
        </div>

        <h3 className="text-2xl font-black text-slate-950">{title}</h3>
        <p className="mt-3 text-base leading-relaxed text-slate-700">{text}</p>
      </div>
    </article>
  );
}

export default function TrySpokenEnglishGym() {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  const source = searchParams.get("source") || "try-spoken-english-gym";
  const nextPath = getSafeNextPath(searchParams.get("next") || "/b/lessons");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [guestChallenge, setGuestChallenge] = useState(null);

  useEffect(() => {
    document.title = "Spoken English Gym | FluencyJet";
    setGuestChallenge(readGuestChallenge());
  }, []);

  useEffect(() => {
    trackSmartSignupView({
      source,
      track: "BEGINNER",
      segment: "general",
      main_goal: "Build sentences faster",
    });
  }, [source]);

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = nextPath;
    }
  }, [isAuthenticated, nextPath]);

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
          sendToFunnelSheet({
            type: "whatsapp_trial_signup",
            name: payload.name,
            email: payload.email,
            whatsapp_number: payload.whatsapp_number,
            source,
            track: "BEGINNER",
            page_url: window.location.href,
          }),
          new Promise((resolve) => setTimeout(resolve, 1200)),
        ]);
      } catch {
        // Funnel-sheet tracking must never stop registration.
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

  function scrollToSignup() {
    document.getElementById("signup")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const xpText = guestChallenge
    ? guestChallenge.xp.toLocaleString("en-IN")
    : null;

  return (
    <main className="gym-page">
      <section className="gym-hero">
        <div className="gym-shell">
          {guestChallenge && (
            <div className="challenge-strip" role="status">
              <span aria-hidden="true">✓</span>
              <span>
                Challenge completed · Your <strong>{xpText} XP</strong> is ready
                to save
              </span>
            </div>
          )}

          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow hero-eyebrow">
                <span className="hero-eyebrow-spark" aria-hidden="true">
                  ✦
                </span>

                <span className="hero-eyebrow-text">
                  WELCOME TO THE SPOKEN ENGLISH GYM
                </span>
              </p>

              <h1 data-testid="text-headline">
                Build English Sentences Faster.
                <span>Speak With Greater Confidence.</span>
              </h1>

              <p className="hero-support">
                Practice through <strong>120 structured lessons</strong> and{" "}
                <strong>4,800 guided exercises</strong> designed to improve
                sentence formation, grammar, listening, and spoken English—one
                daily workout at a time.
              </p>

              <div className="hero-highlights" aria-label="Product highlights">
                <span>120 step-by-step lessons</span>
                <span>4,800 guided exercises</span>
                <span>4 ways to practice</span>
                <span>10-minute daily practice</span>
              </div>

              <div className="practice-flow" aria-label="Four ways to practice">
                <span>Build the Sentence</span>
                <b aria-hidden="true">→</b>
                <span>Type It Yourself</span>
                <b aria-hidden="true">→</b>
                <span>Listen and Repeat</span>
                <b aria-hidden="true">→</b>
                <span>Listen and Write</span>
              </div>

              <div className="hero-price">
                <p className="price-kicker">TRY YOUR FIRST LESSON FOR FREE</p>
                <p className="price-main">
                  Complete one-year access: <strong>{FULL_PRICE}</strong>
                </p>
                <p>One-time payment. No monthly subscription.</p>
                <p className="price-note">
                  Create your free account. Try the quizzes first. Decide after you
                  experience it.
                </p>
              </div>
            </div>

            <aside
              className="signup-card"
              id="signup"
              aria-labelledby="signup-title"
            >
              <p className="signup-mini">YOUR NEXT STEP</p>
              <h2 id="signup-title">Try Spoken English Gym for FREE</h2>
              <p className="signup-intro">
                Create your free account to save your progress and unlock your
                free lessons.
              </p>

              {guestChallenge && (
                <div className="xp-box">
                  <span aria-hidden="true">🎉</span>
                  <div>
                    <strong>Your {xpText} Challenge XP is waiting.</strong>
                    <small>Save it to your FluencyJet account.</small>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} data-testid="form-signup">
                <div className="form-group">
                  <label htmlFor="name">Your name</label>
                  <input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    data-testid="input-name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Enter your email address"
                    autoComplete="email"
                    inputMode="email"
                    data-testid="input-email"
                  />
                  <small className="field-help">
                    Used to create and access your account.
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="whatsapp">WhatsApp number</label>
                  <input
                    id="whatsapp"
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    required
                    placeholder="Enter your WhatsApp number"
                    autoComplete="tel"
                    inputMode="tel"
                    data-testid="input-whatsapp"
                  />
                  <small className="field-help">
                    Used for account support and your practice link.
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="password">Create a password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    data-testid="input-password"
                  />
                </div>

                <label className="consent-row">
                  <input
                    type="checkbox"
                    checked={whatsappConsent}
                    onChange={(e) => setWhatsappConsent(e.target.checked)}
                  />
                  <span>
                    Send my practice reminders and useful FluencyJet updates
                    through WhatsApp.
                  </span>
                </label>

                {error && (
                  <div
                    className="submit-error"
                    role="alert"
                    data-testid="error-message"
                  >
                    {error}
                  </div>
                )}

                <button
                  className="primary-cta"
                  type="submit"
                  disabled={loading}
                  data-testid="button-start-practice"
                >
                  {loading
                    ? "Creating Your Account..."
                    : guestChallenge
                      ? "Save My XP & Continue My Lessons"
                      : "Create My Free Account & Continue"}
                </button>

                <p className="form-microcopy">
                  <strong>No payment now.</strong> Complete one-year access
                  costs {FULL_PRICE} only if you decide to continue.
                </p>
              </form>

              <p className="login-line">
                Already have an account?{" "}
                <Link
                  to={`/login?next=${encodeURIComponent(nextPath)}`}
                  data-testid="link-login"
                >
                  Log in here
                </Link>
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="page-section benefits-section">
        <div className="gym-shell">
          <div className="section-heading benefits-heading">
            <p className="eyebrow dark benefits-eyebrow">
              WHAT CAN FLUENCYJET DO FOR YOU?
            </p>

            <h2>Turn the English You Know Into Sentences You Can Speak.</h2>

            <p className="benefits-lead">
              You may know English words and some grammar. But speaking is hard
              when the right sentence does not come quickly.
            </p>

            <p className="benefits-lead benefits-lead--strong">
              FluencyJet gives you short daily quizzes to help you build
              sentences, understand spoken English, and speak with more
              confidence.
            </p>
          </div>

          <div className="benefit-grid">
            {BENEFITS.map((benefit) => (
              <article className="benefit-card" key={benefit.title}>
                <span className="benefit-icon" aria-hidden="true">
                  {benefit.icon}
                </span>
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </article>
            ))}
          </div>

          <p className="section-closing">
            Don’t Just Learn English. <strong>Train Yourself to Use It.</strong>
          </p>
        </div>
      </section>

      <section className="page-section modes-section">
        <div className="gym-shell">
          <div className="section-heading light">
            <p className="eyebrow">ONE SENTENCE. FOUR EXERCISES.</p>
            <h2>Learn It. Remember It. Speak It. Understand It.</h2>
            <p>
              You practice the same useful sentence in four different ways. This
              helps your brain understand, remember, and use the sentence.
            </p>
          </div>

          <div className="mode-grid">
            {PRACTICE_TYPES.map((mode) => (
              <PracticeMock
                key={mode.mode}
                title={mode.title}
                text={mode.text}
                mediaSrc={mode.mediaSrc}
                mode={mode.mode}
                number={mode.number}
              />
            ))}
          </div>

          <div className="mode-summary">
            <strong>Build It.</strong>
            <strong>Type It.</strong>
            <strong>Speak It.</strong>
            <strong>Remember It.</strong>
          </div>

          <p className="modes-closing">
            You do not only watch English lessons.{" "}
            <strong>You practice using English.</strong>
          </p>
        </div>
      </section>

      <section className="page-section scale-section">
        <div className="gym-shell">
          <div className="section-heading">
            <p className="eyebrow dark">YOUR COMPLETE SPOKEN ENGLISH GYM</p>
            <h2>Everything Is Planned for You.</h2>
            <p>
              You do not need to search for a new English lesson every day. Open
              FluencyJet, complete your quizzes, and continue from where you
              stopped.
            </p>
          </div>

          <div className="stats-grid">
            {PRODUCT_STATS.map(([value, label]) => (
              <article className="stat-card" key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </article>
            ))}
          </div>

          <p className="progress-line">
            Earn XP · Track your progress · Continue from where you stopped
          </p>
        </div>
      </section>

      <section className="page-section steps-section">
        <div className="gym-shell">
          <div className="section-heading">
            <p className="eyebrow dark">START FREE. TRY IT. THEN DECIDE.</p>
            <h2>See the Lessons Before You Pay.</h2>
          </div>

          <div className="steps-grid">
            <article className="step-card">
              <span>1</span>
              <h3>Create Your Free Account</h3>
              <p>Save your challenge XP and your learning progress.</p>
            </article>

            <article className="step-card">
              <span>2</span>
              <h3>Complete Your First Workout</h3>
              <p>
                Try Quick English, Grammar Genius, Fluent Voice, and Dictation.
              </p>
            </article>

            <article className="step-card">
              <span>3</span>
              <h3>Decide After Trying</h3>
              <p>
                Continue with the one-year Gym Pass for {FULL_PRICE} only when
                you are ready.
              </p>
            </article>
          </div>

          <div className="reassurance-bar">
            No card needed now · No automatic payment · No monthly subscription
          </div>
        </div>
      </section>

      <section className="page-section creator-section">
        <div className="gym-shell creator-grid">
          <div className="creator-photo-wrap">
            <img
              src="/coach.jpg"
              alt="Aravind Pasupathy, creator of FluencyJet"
              className="creator-photo"
              loading="lazy"
            />

            <span className="creator-photo-badge">FluencyJet Creator</span>
          </div>

          <div>
            <p className="eyebrow dark">CREATED BY A REAL TEACHER</p>
            <h2>Meet Aravind Pasupathy</h2>

            <div className="credential-row">
              <span>Guinness World Record Holder in Memory</span>
              <span>35,000+ Students Trained</span>
            </div>

            <p className="creator-intro">
              Aravind is an English trainer and memory coach. He created
              FluencyJet for learners who know English words and grammar but
              need a clear daily system to build sentences and speak with
              confidence.
            </p>

            <blockquote>
              “My goal is simple. I want to help you stop only learning English
              and start using it with confidence.”
            </blockquote>
          </div>
        </div>
      </section>

      <section className="page-section pricing-section">
        <div className="gym-shell">
          <div className="section-heading">
            <p className="eyebrow dark">SIMPLE ONE-YEAR ACCESS</p>
            <h2>Start Free. Continue for {FULL_PRICE}.</h2>
            <p>Try the first lesson before you decide.</p>
          </div>

          <div className="pricing-grid">
            <article className="pricing-card free-card">
              <p className="plan-label">FIRST COMPLETE WORKOUT</p>
              <h3>Free</h3>
              <ul>
                <li>Create your FluencyJet account</li>
                <li>Save your challenge XP</li>
                <li>Experience the four practice types</li>
                <li>See how the app works</li>
              </ul>
            </article>

            <article className="pricing-card paid-card">
              <p className="plan-label">COMPLETE FLUENCYJET GYM PASS</p>
              <h3>
                {FULL_PRICE} <small>for one year</small>
              </h3>
              <ul>
                <li>120 structured lessons</li>
                <li>4,800 guided exercises</li>
                <li>Quick English practice</li>
                <li>Grammar Genius practice</li>
                <li>Fluent Voice practice</li>
                <li>Dictation practice</li>
                <li>Beginner and Intermediate paths</li>
                <li>XP and progress tracking</li>
              </ul>
              <p className="one-time">One-time payment. No subscription.</p>
            </article>
          </div>

          <button
            className="secondary-cta"
            type="button"
            onClick={scrollToSignup}
          >
            Create My Free Account &amp; Continue
          </button>

          <p className="center-microcopy">
            No payment now. Save your XP and experience FluencyJet first.
          </p>
        </div>
      </section>

      <section className="page-section faq-section">
        <div className="gym-shell narrow-shell">
          <div className="section-heading">
            <p className="eyebrow dark">COMMON QUESTIONS</p>
            <h2>Know Before You Start.</h2>
          </div>

          <div className="faq-list">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta-section">
        <div className="gym-shell">
          <p className="eyebrow">YOUR CHALLENGE WAS THE WARM-UP</p>
          <h2>Now Start Your First Lesson.</h2>
          <p>
            {guestChallenge ? `Save your ${xpText} XP. ` : ""}
            Create your free account. Experience the FluencyJet practice system.
          </p>

          <button className="final-cta" type="button" onClick={scrollToSignup}>
            {guestChallenge
              ? "Save My XP & Continue My Workout"
              : "Create My Free Account & Continue"}
          </button>

          <small>
            No payment now. Complete one-year access costs {FULL_PRICE} only if
            you decide to continue.
          </small>
        </div>
      </section>
    </main>
  );
}
