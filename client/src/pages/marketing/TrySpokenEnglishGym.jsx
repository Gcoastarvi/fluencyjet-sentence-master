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
    text: "Practise complete English patterns. Slowly reduce the need to translate every word from Tamil.",
  },
  {
    icon: "⚡",
    title: "Make Sentences Faster",
    text: "Practise useful sentence patterns again and again. Bring the right sentence to mind more easily.",
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
    text: "Listen, repeat, and practise privately. Feel more comfortable before speaking with other people.",
  },
  {
    icon: "🔥",
    title: "Build a Daily Practice Habit",
    text: "Complete short workouts. Earn XP. See your progress. Continue from where you stopped.",
  },
];

const PRACTICE_TYPES = [
  {
    mode: "reorder",
    name: "Quick English",
    action: "Build the Sentence",
    description:
      "Put the words in the correct order. Learn how a complete English sentence is built.",
    video: "/practice-modes/reorder.mp4",
  },
  {
    mode: "typing",
    name: "Grammar Genius",
    action: "Type It Yourself",
    description:
      "Remember the sentence and type it yourself. Improve word order, spelling, and grammar.",
    video: "/practice-modes/typing.mp4",
  },
  {
    mode: "voice",
    name: "Fluent Voice",
    action: "Listen and Repeat",
    description:
      "Hear the sentence clearly. Say it aloud and practise your spoken English.",
    video: "/practice-modes/voice.mp4",
  },
  {
    mode: "dictation",
    name: "Dictation",
    action: "Listen and Write",
    description:
      "Listen carefully and type what you hear. Improve listening and sentence memory together.",
    video: "/practice-modes/dictation.mp4",
  },
];

const PRODUCT_STATS = [
  ["120", "Step-by-step lessons"],
  ["4,800", "Guided exercises"],
  ["4", "Ways to practise"],
  ["2", "Learning paths"],
  ["10 min", "Daily workouts"],
  ["1 year", "Complete access"],
];

const FAQ_ITEMS = [
  {
    question: "Do I need to pay now?",
    answer:
      "No. Create your account and complete your first workout free. No card is needed now.",
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
    question: "How much should I practise?",
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
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "practice-mode-icon-svg",
    "aria-hidden": true,
  };

  if (type === "reorder") {
    return (
      <svg {...commonProps}>
        <path d="M7 7h11" />
        <path d="m15 4 3 3-3 3" />
        <path d="M17 17H6" />
        <path d="m9 14-3 3 3 3" />
      </svg>
    );
  }

  if (type === "typing") {
    return (
      <svg {...commonProps}>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M7 9h.01M11 9h.01M15 9h.01M18 9h.01" />
        <path d="M7 13h.01M11 13h.01M15 13h.01" />
        <path d="M8 16h8" />
      </svg>
    );
  }

  if (type === "voice") {
    return (
      <svg {...commonProps}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
        <path d="M12 17.5V21" />
        <path d="M9 21h6" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M4 13V9a8 8 0 0 1 16 0v4" />
      <path d="M4 12h3v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 1-2Z" />
      <path d="M20 12h-3v7h2a2 2 0 0 0 2-2v-3a2 2 0 0 0-1-2Z" />
      <path d="M12 19h3" />
    </svg>
  );
}

function PracticeWorkoutCard({ mode, number }) {
  return (
    <article
      className={`practice-workout-card practice-workout-card--${mode.mode}`}
    >
      <div className="practice-workout-accent" aria-hidden="true" />

      <div className="practice-workout-header">
        <div className="practice-workout-icon">
          <PracticeModeIcon type={mode.mode} />
        </div>

        <div className="practice-workout-heading">
          <span className="practice-workout-badge">{mode.name}</span>
          <h3>{mode.action}</h3>
        </div>

        <span className="practice-workout-number" aria-hidden="true">
          {String(number).padStart(2, "0")}
        </span>
      </div>

      <p className="practice-workout-description">{mode.description}</p>

      <div className="practice-workout-video">
        <video
          src={mode.video}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-label={`${mode.name}: ${mode.action}`}
        />
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
        practice_commitment: "Yes, I can practise 10 minutes daily",
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
              <p className="eyebrow">WELCOME TO THE SPOKEN ENGLISH GYM</p>

              <h1 data-testid="text-headline">
                Train Your Brain to Build English Sentences Faster.
                <span>Speak With Greater Confidence.</span>
              </h1>

              <p className="hero-support">
                Practise through <strong>120 structured lessons</strong> and{" "}
                <strong>4,800 guided exercises</strong> designed to improve
                sentence formation, grammar, listening, and spoken English—one
                daily workout at a time.
              </p>

              <div className="hero-highlights" aria-label="Product highlights">
                <span>120 step-by-step lessons</span>
                <span>4,800 guided exercises</span>
                <span>4 ways to practise</span>
                <span>10-minute daily workouts</span>
                <span>Beginner &amp; Intermediate paths</span>
              </div>

              <div className="practice-flow" aria-label="Four ways to practise">
                <span>Build the Sentence</span>
                <b aria-hidden="true">→</b>
                <span>Type It Yourself</span>
                <b aria-hidden="true">→</b>
                <span>Listen and Repeat</span>
                <b aria-hidden="true">→</b>
                <span>Listen and Write</span>
              </div>

              <div className="hero-price">
                <p className="price-kicker">
                  TRY YOUR FIRST COMPLETE WORKOUT FREE
                </p>
                <p className="price-main">
                  Complete one-year access: <strong>{FULL_PRICE}</strong>
                </p>
                <p>One-time payment. No monthly subscription.</p>
                <p className="price-note">
                  Create your free account. Try the app first. Decide after you
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
              <h2 id="signup-title">Save Your XP and Continue Your Workout</h2>
              <p className="signup-intro">
                Create your free account to save your progress and unlock your
                first complete workout.
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
                      ? "Save My XP & Continue My Workout"
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
          <div className="section-heading">
            <p className="eyebrow dark">WHAT CAN FLUENCYJET DO FOR YOU?</p>
            <h2>Make English Sentences Faster. Speak With More Confidence.</h2>
            <p>
              You may know English words. You may know some grammar. But the
              right sentence may not come when you try to speak.
            </p>
            <p>
              FluencyJet gives you simple daily practice to help you use the
              English you already know.
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
            <p className="eyebrow">ONE SENTENCE. FOUR WORKOUTS.</p>
            <h2>Learn It. Remember It. Speak It. Understand It.</h2>
            <p>
              You practise the same useful sentence in four different ways. This
              helps your brain understand, remember, and use the sentence.
            </p>
          </div>

          <div className="mode-grid">
            {PRACTICE_TYPES.map((mode, index) => (
              <PracticeWorkoutCard
                key={mode.name}
                mode={mode}
                number={index + 1}
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
            <strong>You practise using English.</strong>
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
              FluencyJet, complete your workout, and continue from where you
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
            <h2>See the App Before You Pay.</h2>
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
          <div className="creator-mark" aria-hidden="true">
            AP
          </div>

          <div>
            <p className="eyebrow dark">CREATED BY A REAL TEACHER</p>
            <h2>Meet Aravind Pasupathy</h2>

            <div className="credential-row">
              <span>Guinness World Record Holder in Memory</span>
              <span>35,000+ Students Trained</span>
            </div>

            <p>
              Aravind is an English trainer and memory coach. He created
              FluencyJet to solve a common problem.
            </p>

            <p>
              Many learners know English words and grammar. But they do not get
              enough sentence-making practice.
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
            <p>Try the first complete workout before you decide.</p>
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
          <h2>Now Start Your First Complete Workout.</h2>
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
