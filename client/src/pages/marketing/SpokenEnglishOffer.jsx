// client/src/pages/marketing/SpokenEnglishOffer.jsx
import ProblemSolutionSection from "../../components/marketing/ProblemSolutionSection";
import { useEffect, useState } from "react";
import WhoThisHelpsSection from "../../components/marketing/WhoThisHelpsSection";
import AccessPackageSection from "../../components/marketing/AccessPackageSection";

const VIMEO_VIDEO_ID = "1206728761";

const PAYMENT_URL =
  import.meta.env.VITE_SPOKEN_ENGLISH_PAYMENT_URL ||
  "https://rzp.io/rzp/U2adLCc";

const WHATSAPP_URL =
  "https://wa.me/919047122250?text=Hi%20FluencyJet%2C%20I%20want%20to%20join%20the%20Spoken%20English%20Gym.%20I%20need%20help.";

function MarketingNavHider() {
  return (
    <style>{`
      body.marketing-no-nav header,
      body.marketing-no-nav nav,
      body.marketing-no-nav [data-testid="navbar"],
      body.marketing-no-nav .navbar,
      body.marketing-no-nav .site-header {
        display: none !important;
      }

      body.marketing-no-nav {
        overflow-x: hidden;
      }
    `}</style>
  );
}

function trackEvent(eventName) {
  try {
    if (window.gtag) {
      window.gtag("event", eventName);
    }

    if (window.fbq) {
      window.fbq("trackCustom", eventName);
    }
  } catch (error) {
    console.warn("Tracking error:", error);
  }
}

function Section({ children, className = "" }) {
  return (
    <section
      className={`mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeader({ eyebrow, title, subtitle, dark = false }) {
  return (
    <div className="mx-auto mb-10 max-w-4xl text-center">
      {eyebrow && (
        <p
          className={`mb-3 text-sm font-black uppercase tracking-[0.22em] ${
            dark ? "text-lime-300" : "text-purple-700"
          }`}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={`text-3xl font-black leading-tight sm:text-4xl lg:text-5xl ${
          dark ? "text-white" : "text-slate-950"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mx-auto mt-4 max-w-3xl text-lg leading-relaxed sm:text-xl ${
            dark ? "text-white/75" : "text-slate-700"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function CtaButton({
  className = "",
  children = "Get 1-Year Access for ₹1,199",
}) {
  const handleClick = () => {
    trackEvent("spoken_english_offer_payment_cta_click");

    if (!PAYMENT_URL || PAYMENT_URL.includes("PASTE_RAZORPAY")) {
      window.alert(
        "Payment link is not configured yet. Please contact WhatsApp Support: 9047122250",
      );
      return;
    }

    window.location.href = PAYMENT_URL;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`rounded-2xl bg-gradient-to-r from-yellow-300 to-lime-400 px-7 py-4 text-center text-lg font-black text-slate-950 shadow-xl shadow-lime-500/20 transition hover:scale-[1.02] hover:shadow-lime-500/30 active:scale-[0.99] sm:text-xl ${className}`}
    >
      {children}
    </button>
  );
}

function WhatsAppSupport({ dark = false }) {
  const handleClick = () => {
    trackEvent("spoken_english_offer_whatsapp_click");
  };

  return (
    <a
      href={WHATSAPP_URL}
      onClick={handleClick}
      className={`font-bold underline decoration-lime-400 underline-offset-4 transition ${
        dark
          ? "text-white hover:text-lime-300"
          : "text-purple-900 hover:text-purple-700"
      }`}
    >
      Need help? WhatsApp Support: 9047122250
    </a>
  );
}

function FeatureIcon({ type }) {
  const iconClass = "h-8 w-8";

  switch (type) {
    case "lessons":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={iconClass}
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="4" y="3.5" width="13" height="16" rx="2.5" />
          <path d="M8 8h5" />
          <path d="M8 12h5" />
          <path d="M8 16h3" />
          <path d="M17 7h2.5a1.5 1.5 0 0 1 1.5 1.5v10a2 2 0 0 1-2 2H8" />
          <path d="m14.5 16.5 1.5 1.5 3-3.5" />
        </svg>
      );

    case "grammar":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={iconClass}
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v14H7a3 3 0 0 0-3 3V5.5Z" />
          <path d="M14 6h3.5A2.5 2.5 0 0 1 20 8.5V20h-6" />
          <path d="M7.5 8.5h3" />
          <path d="M7.5 12h3" />
          <path d="m15.5 14.5 1.6 1.6 3.1-3.6" />
        </svg>
      );

    case "speaking":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={iconClass}
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2h6A3.5 3.5 0 0 1 17 5.5v4A3.5 3.5 0 0 1 13.5 13H10l-4.5 4v-4.5A3.5 3.5 0 0 1 4 9.5v-4Z" />
          <path d="M14.5 14.5H17A3 3 0 0 1 20 17.5V19a3 3 0 0 1-3 3h-1v2l-3-2h-1" />
          <path d="M8 7h5" />
          <path d="M8 9.5h3" />
        </svg>
      );

    case "gym":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={iconClass}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 9v6" />
          <path d="M6 7v10" />
          <path d="M9 10v4" />
          <path d="M15 10v4" />
          <path d="M18 7v10" />
          <path d="M21 9v6" />
          <path d="M9 12h6" />
          <path d="M8.5 5.5C9.5 4.5 10.7 4 12 4s2.5.5 3.5 1.5" />
        </svg>
      );

    default:
      return null;
  }
}

function InfoCard({ title, text, iconType, number }) {
  const iconShell = {
    lessons:
      "from-purple-950 via-purple-800 to-indigo-700 text-lime-300 shadow-purple-200",
    grammar:
      "from-indigo-950 via-blue-800 to-purple-700 text-cyan-200 shadow-blue-200",
    speaking:
      "from-fuchsia-950 via-purple-800 to-violet-700 text-lime-200 shadow-fuchsia-200",
    gym: "from-emerald-950 via-purple-900 to-lime-700 text-lime-200 shadow-lime-200",
  }[iconType];

  return (
    <div className="group relative h-full overflow-hidden rounded-[2rem] border border-purple-100 bg-white shadow-xl shadow-purple-100/70 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-200/80">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-lime-300 via-purple-500 to-lime-300" />

      <div className="relative flex h-full flex-col bg-gradient-to-b from-white via-white to-purple-50/40 p-6 sm:p-7">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div className="relative">
            <div
              className={
                "absolute inset-1 rounded-2xl bg-gradient-to-br blur-xl opacity-35 " +
                iconShell
              }
            />

            <div
              className={
                "relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg transition duration-300 group-hover:scale-105 " +
                iconShell
              }
            >
              <FeatureIcon type={iconType} />
            </div>
          </div>

          <span className="rounded-full border border-purple-200 bg-white px-3 py-1 text-xs font-black tracking-[0.16em] text-purple-700 shadow-sm">
            {number}
          </span>
        </div>

        <h3 className="text-2xl font-black leading-tight text-slate-950">
          {title}
        </h3>

        <p className="mt-4 text-base leading-relaxed text-slate-700 sm:text-lg">
          {text}
        </p>
      </div>
    </div>
  );
}

function LessonSystemCard({ number, title, text, examples }) {
  return (
    <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-xl shadow-black/10 backdrop-blur">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-300 text-xl font-black text-purple-950">
        {number}
      </div>
      <h3 className="text-2xl font-black text-white">{title}</h3>
      <p className="mt-3 text-base leading-relaxed text-white/75">{text}</p>
      <div className="mt-5 rounded-2xl bg-black/25 p-4">
        {examples.map((item) => (
          <p key={item} className="py-1 text-sm font-semibold text-lime-100">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
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
    <div className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 shadow-2xl shadow-black/25 transition duration-300 hover:-translate-y-1 hover:shadow-purple-900/40">
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
    </div>
  );
}

function ProblemIcon({ type }) {
  const common =
    "h-6 w-6 stroke-current";

  if (type === "grammar") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={common}
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v14H7a3 3 0 0 0-3 3V5.5Z" />
        <path d="M14 6h3.5A2.5 2.5 0 0 1 20 8.5V20h-6" />
        <path d="M8 8.5h3" />
        <path d="M8 12h3" />
        <path d="M18 12v3" />
        <path d="M18 18h.01" />
      </svg>
    );
  }

  if (type === "sentence") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={common}
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M7 9h7" />
        <path d="M7 13h5" />
        <path d="m16 12 4 4" />
        <path d="m20 12-4 4" />
      </svg>
    );
  }

  if (type === "words") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={common}
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2h9A3.5 3.5 0 0 1 20 5.5v6a3.5 3.5 0 0 1-3.5 3.5H10l-5.5 5v-5.7A3.5 3.5 0 0 1 4 12.5v-7Z" />
        <path d="M8 8.5h.01" />
        <path d="M12 8.5h.01" />
        <path d="M16 8.5h.01" />
      </svg>
    );
  }

  if (type === "people") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={common}
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <circle cx="17.5" cy="9" r="2.5" />
        <path d="M15.5 15.5a4.5 4.5 0 0 1 5 4.5" />
      </svg>
    );
  }

  if (type === "reply") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={common}
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="5" />
        <path d="M8 5v3l2 1" />
        <path d="M11 14h6a4 4 0 0 1 4 4v.5a3.5 3.5 0 0 1-3.5 3.5H16v2l-3-2h-2" />
      </svg>
    );
  }

  if (type === "link") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={common}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={common}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9v6" />
      <path d="M6 7v10" />
      <path d="M9 10v4" />
      <path d="M15 10v4" />
      <path d="M18 7v10" />
      <path d="M21 9v6" />
      <path d="M9 12h6" />
      <path d="M8 4h8" />
    </svg>
  );
}

function ProblemCard({ type, children, wide = false }) {
  const styles = {
    grammar: {
      icon: "from-amber-500 to-orange-700 text-white",
      accent: "from-amber-400 to-orange-500",
      glow: "shadow-orange-100",
    },
    sentence: {
      icon: "from-rose-600 to-purple-900 text-white",
      accent: "from-rose-400 to-purple-500",
      glow: "shadow-rose-100",
    },
    words: {
      icon: "from-sky-600 to-purple-900 text-white",
      accent: "from-sky-400 to-purple-500",
      glow: "shadow-sky-100",
    },
    people: {
      icon: "from-fuchsia-700 to-purple-950 text-white",
      accent: "from-fuchsia-400 to-purple-500",
      glow: "shadow-fuchsia-100",
    },
    reply: {
      icon: "from-indigo-600 to-purple-950 text-white",
      accent: "from-indigo-400 to-purple-500",
      glow: "shadow-indigo-100",
    },
  }[type];

  return (
    <div
      className={
        "group relative overflow-hidden rounded-[1.75rem] border border-purple-100 bg-white shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl " +
        styles.glow +
        (wide ? " sm:col-span-2" : "")
      }
    >
      <div
        className={
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r " +
          styles.accent
        }
      />

      <div className="flex h-full items-center gap-4 px-5 py-5 sm:px-6 sm:py-6">
        <div
          className={
            "flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg transition duration-300 group-hover:scale-105 " +
            styles.icon
          }
        >
          <ProblemIcon type={type} />
        </div>

        <p className="text-left text-lg font-black leading-snug text-slate-900 sm:text-xl">
          {children}
        </p>
      </div>
    </div>
  );
}

function OfferItem({ title, text }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mt-1 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-lime-300 text-sm font-black text-purple-950">
        ✓
      </div>
      <div>
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{text}</p>
      </div>
    </div>
  );
}

function BonusCard({ title, text }) {
  return (
    <div className="rounded-3xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-lime-50 p-6 shadow-lg shadow-yellow-100/70">
      <div className="mb-4 inline-flex rounded-full bg-purple-950 px-4 py-2 text-sm font-black uppercase tracking-wide text-lime-300">
        Bonus
      </div>
      <h3 className="text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-3 text-base leading-relaxed text-slate-700">{text}</p>
    </div>
  );
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <span className="text-lg font-black text-slate-950">{question}</span>
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-purple-950 text-lg font-black text-lime-300">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 text-base leading-relaxed text-slate-700">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function SpokenEnglishOffer() {
  useEffect(() => {
    document.title = "FluencyJet Spoken English Gym - 1 Year Access";
    document.body.classList.add("marketing-no-nav");
    trackEvent("spoken_english_offer_page_view");

    return () => {
      document.body.classList.remove("marketing-no-nav");
    };
  }, []);

  const offerItems = [
    {
      title: "Sentence Master App Access",
      text: "1-year access to FluencyJet Sentence Master for daily spoken English practice.",
    },
    {
      title: "120 Structured Spoken English Lessons",
      text: "Lessons designed to connect grammar, speaking topics, and sentence practice.",
    },
    {
      title: "Reorder Practice Mode",
      text: "Train your brain to arrange English words in the correct order.",
    },
    {
      title: "Typing Practice Mode",
      text: "Build English sentences from Tamil meaning and improve sentence formation.",
    },
    {
      title: "Voice Practice Mode",
      text: "Practice saying sentences aloud and reduce speaking fear.",
    },
    {
      title: "Dictation Practice Mode",
      text: "Improve listening, sentence understanding, and English recall.",
    },
    {
      title: "Beginner + Intermediate Learning Path",
      text: "Start from your current level and move step by step.",
    },
    {
      title: "XP, Streaks, and Progress Tracking",
      text: "Build a daily practice habit with points, streaks, and progress.",
    },
  ];

  const faqs = [
    {
      question: "Is this a spoken English course or an app?",
      answer:
        "It is a structured spoken English practice app. Inside Sentence Master, you get lessons, grammar explanations, speaking topics, and gym-style practice exercises.",
    },
    {
      question: "I am afraid of grammar. Can I still use it?",
      answer:
        "Yes. Grammar is explained in a simple and practical way. You will not learn grammar as heavy theory. You will learn one useful structure and immediately practice it with sentences.",
    },
    {
      question: "I make wrong sentences. Will this help me?",
      answer:
        "Yes. Reorder and typing practice are designed to help you understand correct sentence order and build better English sentences step by step.",
    },
    {
      question: "How much time should I practice daily?",
      answer:
        "Start with 10–15 minutes daily. Small daily practice is better than watching many videos without practice.",
    },
    {
      question: "Can I use it on mobile?",
      answer: "Yes. You can use Sentence Master on mobile and desktop.",
    },
    {
      question: "Is this useful for beginners?",
      answer:
        "Yes. Beginner lessons are included. You can start from simple sentence patterns and move step by step.",
    },
    {
      question: "Will I speak English fluently immediately?",
      answer:
        "No honest trainer should promise instant fluency. But if you practice consistently, you can improve your sentence formation speed, confidence, and clarity.",
    },
    {
      question: "How will I get access after payment?",
      answer:
        "After successful payment, you will receive access instructions. If you face any issue, you can contact WhatsApp support.",
    },
  ];

  return (
    <>
      <MarketingNavHider />
      <main className="min-h-screen bg-slate-50 pb-24 text-slate-950 sm:pb-0">
        <section className="relative overflow-hidden bg-gradient-to-b from-[#07031f] via-[#10053d] to-[#020617] text-white">
          <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-lime-300/15 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />

          <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-8 pb-12 text-center sm:px-6 lg:px-8">
            <h1 className="mx-auto max-w-5xl text-3xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              English பேச Fear குறையணுமா?{" "}
              <span className="text-yellow-300">
                Daily Spoken English Gym Practice
              </span>{" "}
              Start பண்ணுங்கள்
            </h1>

            <p className="mx-auto mt-6 max-w-4xl text-lg leading-relaxed text-white/80 sm:text-2xl">
              FluencyJet Sentence Master-ல் 120 structured lessons, simple
              grammar explanation, real-life spoken English topics, and Reorder
              + Typing + Voice + Dictation practice modes கிடைக்கும்.
            </p>

            <div className="mt-8 w-full overflow-hidden rounded-3xl border border-white/20 bg-black shadow-2xl shadow-lime-400/10 sm:mt-10">
              <div className="relative w-full pb-[56.25%]">
                <iframe
                  className="absolute left-0 top-0 h-full w-full"
                  src={
                    "https://player.vimeo.com/video/" +
                    VIMEO_VIDEO_ID +
                    "?title=0&byline=0&portrait=0&badge=0&autopause=0"
                  }
                  title="FluencyJet Spoken English Gym VSL"
                  allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
                  allowFullScreen
                />
              </div>
            </div>

            <div className="mt-7 w-full max-w-xl">
              <CtaButton className="w-full">
                Get 1-Year Access for ₹1,199
              </CtaButton>

              <p className="mt-3 text-sm font-semibold text-white/65">
                Secure payment via UPI, GPay, PhonePe, Paytm, Debit Card, and
                Credit Card.
              </p>
            </div>

            <div className="mt-8 w-full max-w-4xl rounded-[1.75rem] bg-gradient-to-br from-lime-300/50 via-white/15 to-purple-500/40 p-[1px] shadow-2xl shadow-lime-500/20 sm:rounded-[2.25rem]">
              <div className="rounded-[1.7rem] bg-white/10 p-2 backdrop-blur sm:rounded-[2.2rem] sm:p-3">
                <div className="relative overflow-hidden rounded-[1.45rem] bg-gradient-to-b from-white via-white to-slate-50 px-4 py-6 text-slate-950 shadow-2xl sm:rounded-[1.85rem] sm:px-8 sm:py-9">
                  <div className="pointer-events-none absolute -left-16 -top-16 h-36 w-36 rounded-full bg-lime-300/30 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-20 -right-16 h-44 w-44 rounded-full bg-purple-400/20 blur-2xl" />

                  <div className="relative">
                    <div className="mx-auto w-fit rounded-full bg-gradient-to-r from-purple-100 via-white to-lime-100 px-4 py-2 shadow-sm sm:px-5">
                      <p className="text-center text-xs font-black uppercase tracking-[0.22em] text-purple-700 sm:text-sm">
                        Special Online Launch Offer
                      </p>
                    </div>

                    <div className="mt-6 text-center">
                      <p className="text-lg font-black text-slate-700 sm:text-xl">
                        Complete 1-Year Access
                      </p>

                      <div className="mx-auto mt-4 w-fit rounded-[2rem] bg-gradient-to-r from-purple-950 via-purple-800 to-purple-950 px-7 py-3 shadow-xl shadow-purple-200">
                        <p className="text-5xl font-black tracking-tight text-white sm:text-7xl">
                          ₹1,199
                        </p>
                      </div>

                      <p className="mx-auto mt-4 w-fit rounded-full bg-lime-100 px-5 py-2 text-base font-black text-lime-800 sm:text-lg">
                        One-time payment only
                      </p>
                    </div>

                    <div className="mt-6 grid gap-3 rounded-[1.25rem] border border-slate-100 bg-slate-50/90 p-3 text-left shadow-inner sm:mt-7 sm:grid-cols-2 sm:rounded-[1.5rem] sm:p-5">
                      {[
                        "120 structured lessons",
                        "Simple grammar explanation",
                        "Real-life spoken English topics",
                        "Reorder + Typing + Voice + Dictation",
                        "Beginner + Intermediate learning path",
                        "XP, streaks, and progress tracking",
                      ].map((item) => (
                        <div
                          key={item}
                          className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 text-sm font-black shadow-sm ring-1 ring-slate-100 sm:px-4"
                        >
                          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gradient-to-br from-lime-300 to-lime-400 text-sm font-black text-purple-950 shadow-sm sm:h-8 sm:w-8 sm:text-base">
                            ✓
                          </span>
                          <span className="leading-snug">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <WhatsAppSupport dark />
            </div>
          </div>
        </section>

        <Section>
          <SectionHeader
            eyebrow="Inside The Gym"
            title="Inside The Spoken English Gym, You Don’t Just Watch. You Practice."
            subtitle="Most English learners watch videos, learn rules, and still struggle when they need to speak. Sentence Master is different. Every lesson helps you understand one useful English structure and immediately practice it through gym-style exercises."
          />

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              iconType="lessons"
              number="01"
              title="120 Structured Lessons"
              text="Step-by-step spoken English lessons from self-introduction to daily conversations, questions, workplace English, interviews, and more."
            />
            <InfoCard
              iconType="grammar"
              number="02"
              title="Simple Grammar Explanation"
              text="No confusing grammar overload. Each lesson explains one practical grammar point that you can use while speaking."
            />
            <InfoCard
              iconType="speaking"
              number="03"
              title="Real-Life Speaking Topics"
              text="Practice English for useful situations like introducing yourself, asking questions, daily routine, work, problems, opinions, and interviews."
            />
            <InfoCard
              iconType="gym"
              number="04"
              title="Spoken English Gym Practice"
              text="Build sentences repeatedly through Reorder, Typing, Voice, and Dictation practice modes."
            />
          </div>
        </Section>

        <section className="bg-gradient-to-b from-purple-950 to-slate-950">
          <Section>
            <SectionHeader
              dark
              eyebrow="Lesson System"
              title="Every Lesson Connects 3 Things"
              subtitle="Grammar + Speaking Topic + Gym Practice = Better Spoken English Practice"
            />

            <div className="grid gap-6 lg:grid-cols-3">
              <LessonSystemCard
                number="1"
                title="Grammar Point"
                text="Understand one useful English structure in a simple way."
                examples={[
                  "Have / Has",
                  "Present Simple",
                  "Present Continuous",
                  "Future & Past Tenses",
                  "Can / Should / Will",
                  "Questions",
                  "Adjectives",
                ]}
              />
              <LessonSystemCard
                number="2"
                title="Spoken English Topic"
                text="Use that structure in a practical speaking situation."
                examples={[
                  "Self-introduction",
                  "Daily routine",
                  "Asking for help",
                  "Office conversation",
                  "Interview answers",
                  "Explaining problems",
                ]}
              />
              <LessonSystemCard
                number="3"
                title="Gym Practice"
                text="Practice the same sentence pattern again and again until your brain becomes faster."
                examples={[
                  "Quick English",
                  "Grammar Genius",
                  "Fluent Voice",
                  "Listening",
                ]}
              />
            </div>
          </Section>
        </section>

        <section className="bg-slate-950">
          <ProblemSolutionSection />
      </section>

              <WhoThisHelpsSection />

        <AccessPackageSection />

        <section className="bg-white">
          <Section>
            <SectionHeader
              eyebrow="Supporting Resources"
              title="Plus Supporting Fluency Resources"
              subtitle="Along with the Spoken English Gym, you also get supporting resources to help you build vocabulary, grammar clarity, and speaking confidence."
            />

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <BonusCard
                title="5-Step English Fluency Course"
                text="Learn the full path: words, grammar, sentence engine, sentences, and communication."
              />
              <BonusCard
                title="English Grammar Memory Method"
                text="Understand grammar concepts using simple memory-based explanation."
              />
              <BonusCard
                title="1000 Core English Words"
                text="Build your basic spoken English vocabulary foundation."
              />
              <BonusCard
                title="180-Day Speaking Topics"
                text="Get practical speaking topic ideas for daily English practice."
              />
              <BonusCard
                title="Ready-to-Use Sentence PDF Library"
                text="Revise useful sentence patterns anytime."
              />
            </div>
          </Section>
        </section>

        <section className="bg-gradient-to-b from-purple-950 to-slate-950 text-white">
          <Section>
            <div className="mx-auto max-w-4xl rounded-[2rem] border border-lime-300/30 bg-white/10 p-6 text-center shadow-2xl shadow-lime-400/10 backdrop-blur sm:p-10">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-lime-300">
                Special Online Launch Offer
              </p>
              <h2 className="mt-4 text-4xl font-black sm:text-5xl">
                Complete 1-Year Access
              </h2>
              <p className="mt-5 text-7xl font-black text-yellow-300">₹1,199</p>
              <p className="mt-3 text-xl font-black text-lime-200">
                One-time payment only
              </p>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/75">
                Includes Sentence Master app access, 120 structured lessons,
                spoken English gym practice modes, and supporting fluency
                resources.
              </p>

              <div className="mt-8">
                <CtaButton className="w-full max-w-xl" />
              </div>

              <p className="mt-4 text-sm font-semibold text-white/70">
                Pay securely using UPI, GPay, PhonePe, Paytm, Debit Card, or
                Credit Card.
              </p>

              <div className="mt-5">
                <WhatsAppSupport dark />
              </div>
            </div>
          </Section>
        </section>

        <Section>
          <div className="grid items-center gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[2rem] bg-gradient-to-br from-purple-950 to-slate-950 p-6 text-white shadow-2xl">
              <div className="aspect-square rounded-[1.5rem] bg-gradient-to-br from-lime-300/30 to-purple-500/30 p-6">
                <div className="flex h-full flex-col items-center justify-center rounded-[1.25rem] border border-white/15 bg-white/10 text-center">
                  <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-lime-300 text-4xl">
                    👨‍🏫
                  </div>
                  <p className="text-3xl font-black">Aravind Pasupathy</p>
                  <p className="mt-2 text-lg font-bold text-lime-200">
                    Founder of FluencyJet
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-black uppercase tracking-[0.22em] text-purple-700">
                Meet Your Mentor
              </p>
              <h2 className="text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
                Learn From A Trainer Who Understands Tamil Learners
              </h2>
              <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-700">
                <p>
                  Hi, I’m Aravind Pasupathy, founder of FluencyJet. I have
                  trained thousands of learners using memory techniques,
                  language learning systems, and practical English training
                  methods.
                </p>
                <p>
                  I created the Spoken English Gym because many Tamil learners
                  don’t fail due to lack of interest. They struggle because they
                  don’t get enough guided sentence-making practice.
                </p>
                <p>
                  Sentence Master is designed to help you practice English step
                  by step — with simple grammar, useful speaking topics, and
                  daily exercises that train your sentence formation.
                </p>
                <p className="font-black text-purple-950">
                  Guinness World Record holder in memory and trainer to 35,000+
                  students.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <section className="bg-white">
          <Section>
            <SectionHeader eyebrow="FAQ" title="Frequently Asked Questions" />

            <div className="mx-auto max-w-4xl space-y-4">
              {faqs.map((faq) => (
                <FaqItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </div>
          </Section>
        </section>

        <section className="bg-gradient-to-b from-[#07031f] via-[#10053d] to-[#020617] text-white">
          <Section>
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="text-4xl font-black leading-tight sm:text-5xl">
                Stop Only Watching English Lessons. Start Practicing Spoken
                English Daily.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/75 sm:text-xl">
                If you want to reduce fear, avoid wrong sentences, and build the
                habit of daily English practice, join the Spoken English Gym
                today.
              </p>

              <div className="mt-8">
                <CtaButton />
              </div>

              <div className="mt-5">
                <WhatsAppSupport dark />
              </div>
            </div>
          </Section>
        </section>

        <footer className="bg-slate-950 px-4 py-8 text-center text-white">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-semibold text-white/80">
              <span>© FluencyJet</span>
              <a href="/legal/privacy" className="hover:text-lime-300">
                Privacy Policy
              </a>
              <a href="/legal/terms" className="hover:text-lime-300">
                Terms
              </a>
              <a href="/legal/refund" className="hover:text-lime-300">
                Refund Policy
              </a>
              <a href="/legal/contact" className="hover:text-lime-300">
                Contact
              </a>
            </div>

            <p className="mx-auto mt-5 max-w-3xl text-xs leading-relaxed text-white/50">
              This site is not part of Facebook or Meta. Additionally, this site
              is not endorsed by Facebook in any way. Facebook is a trademark of
              Meta Platforms, Inc.
            </p>
          </div>
        </footer>

        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur sm:hidden">
          <CtaButton className="w-full py-3 text-base">
            Get 1-Year Access for ₹1,199
          </CtaButton>
        </div>
      </main>
    </>
  );
}
