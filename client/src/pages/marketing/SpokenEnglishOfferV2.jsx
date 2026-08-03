// client/src/pages/marketing/SpokenEnglishOfferV2.jsx

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  trackSpokenEnglishOfferView,
  trackSpokenEnglishInitiateCheckout,
  trackOfferWhatsAppClick,
} from "../../lib/tracking";

const VIMEO_VIDEO_ID = "1210087375";

const PAYMENT_URL =
  import.meta.env.VITE_SPOKEN_ENGLISH_PAYMENT_URL ||
  "https://rzp.io/rzp/gFLPK5Sq";

const WHATSAPP_URL =
  "https://wa.me/919047122250?text=Hi%20FluencyJet%2C%20I%20want%20to%20join%20the%20Spoken%20English%20Gym.%20I%20need%20help.";

const WARM_SOURCES = new Set([
  "lesson1-curriculum",
  "lesson-list",
  "spoken-english-challenge",
  "whatsapp-recovery",
  "lesson1-practice-hub",
]);

const OUTCOMES = [
  {
    icon: "↔",
    title: "Translate Less in Your Mind",
    text: "Practise complete English patterns instead of translating every word from Tamil.",
  },
  {
    icon: "⚡",
    title: "Make Sentences Faster",
    text: "Repeat useful sentence patterns until the right sentence comes to mind more easily.",
  },
  {
    icon: "✓",
    title: "Use Grammar More Accurately",
    text: "Learn correct word order and tense patterns through practice—not only through rules.",
  },
  {
    icon: "🎙",
    title: "Speak With Less Fear",
    text: "Listen, repeat and practise privately before speaking with other people.",
  },
];

const PRACTICE_MODES = [
  {
    number: "01",
    icon: "🧩",
    brand: "Quick English",
    title: "Reorder Practice",
    text: "Arrange the words in the correct order and build the complete English sentence.",
    video: "/practice-modes/reorder.mp4",
    iconTone: "bg-violet-700 text-lime-300",
    badgeTone: "border-violet-200 bg-violet-50 text-violet-800",
  },
  {
    number: "02",
    icon: "⌨️",
    brand: "Grammar Genius",
    title: "Typing Practice",
    text: "See the Tamil meaning and type the correct English sentence yourself.",
    video: "/practice-modes/typing.mp4",
    iconTone: "bg-amber-600 text-white",
    badgeTone: "border-amber-200 bg-amber-50 text-amber-800",
  },
  {
    number: "03",
    icon: "🎙️",
    brand: "Fluent Voice",
    title: "Voice Practice",
    text: "Listen to the sentence, repeat it aloud and build speaking confidence.",
    video: "/practice-modes/voice.mp4",
    iconTone: "bg-emerald-700 text-white",
    badgeTone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    number: "04",
    icon: "🎧",
    brand: "Listening Quiz",
    title: "Dictation Practice",
    text: "Listen carefully, understand the sentence and type what you hear.",
    video: "/practice-modes/dictation.mp4",
    iconTone: "bg-blue-700 text-white",
    badgeTone: "border-blue-200 bg-blue-50 text-blue-800",
  },
];

const INCLUDED_ITEMS = [
  "One full year of FluencyJet Sentence Master access",
  "120 structured spoken English lessons",
  "4,800 guided sentence exercises",
  "Beginner and Intermediate learning paths",
  "Short lesson videos with Tamil support",
  "Quick English Reorder practice",
  "Grammar Genius Typing practice",
  "Fluent Voice speaking practice",
  "Listening and Dictation practice",
  "XP, streaks and progress tracking",
  "Continue from where you stopped",
];

const FAQS = [
  {
    question: "Is FluencyJet an app or a video course?",
    answer:
      "FluencyJet is an active spoken English practice web app. You receive short lesson videos, useful sentence patterns and interactive Reorder, Typing, Voice and Listening exercises.",
  },
  {
    question: "Is it suitable for beginners?",
    answer:
      "Yes. FluencyJet includes a step-by-step Beginner path. An Intermediate learning path is also included.",
  },
  {
    question: "What do I receive with one-year access?",
    answer:
      "You receive complete FluencyJet Sentence Master access, 120 structured lessons, guided exercises, lesson videos, four practice methods and progress tracking for one year.",
  },
  {
    question: "How much should I practise every day?",
    answer:
      "Start with around 10 focused minutes a day. Regular short practice is more useful than studying for a long time only occasionally.",
  },
  {
    question: "Can I use FluencyJet on my phone?",
    answer:
      "Yes. FluencyJet works in a supported browser on your mobile phone, tablet or computer.",
  },
  {
    question: "Is there a monthly subscription?",
    answer:
      "No. ₹1,199 is a one-time payment for one year. There is no monthly subscription and no automatic monthly renewal.",
  },
  {
    question: "How does the 7-day money-back guarantee work?",
    answer:
      "You can try FluencyJet after purchasing. If it is not right for you, request a refund within seven days according to the FluencyJet Refund Policy.",
  },
];

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

function PurchaseButton({
  children = "Get 1-Year Access — ₹1,199",
  className = "",
}) {
  function handlePurchase() {
    trackSpokenEnglishInitiateCheckout();

    if (!PAYMENT_URL || PAYMENT_URL.includes("PASTE_RAZORPAY")) {
      window.alert(
        "Payment link is not configured. Please contact WhatsApp Support: 9047122250",
      );
      return;
    }

    setTimeout(() => {
      window.location.href = PAYMENT_URL;
    }, 300);
  }

  return (
    <button
      type="button"
      onClick={handlePurchase}
      className={`rounded-2xl bg-gradient-to-r from-yellow-300 to-lime-400 px-6 py-4 text-center text-base font-black text-slate-950 shadow-xl shadow-lime-500/20 transition hover:-translate-y-0.5 hover:shadow-lime-500/30 active:scale-[0.99] sm:text-lg ${className}`}
      data-testid="spoken-english-offer-v2-purchase"
    >
      {children}
    </button>
  );
}

function WhatsAppSupport({ dark = false }) {
  return (
    <a
      href={WHATSAPP_URL}
      onClick={() => trackOfferWhatsAppClick()}
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

function SectionHeader({ eyebrow, title, text, dark = false }) {
  return (
    <div className="mx-auto mb-9 max-w-4xl text-center">
      <p
        className={`text-xs font-black uppercase tracking-[0.24em] ${
          dark ? "text-lime-300" : "text-violet-700"
        }`}
      >
        {eyebrow}
      </p>

      <h2
        className={`mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl ${
          dark ? "text-white" : "text-slate-950"
        }`}
      >
        {title}
      </h2>

      {text && (
        <p
          className={`mx-auto mt-4 max-w-3xl text-base font-medium leading-7 sm:text-lg ${
            dark ? "text-white/75" : "text-slate-600"
          }`}
        >
          {text}
        </p>
      )}
    </div>
  );
}

function PracticeModePreview({ src, title }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  const [shouldLoad, setShouldLoad] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) return undefined;

    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting);

        setIsVisible(visible);

        if (visible) {
          setShouldLoad(true);
        }
      },
      {
        rootMargin: "320px 0px",
        threshold: 0.08,
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !shouldLoad) return;

    if (isVisible) {
      video.play().catch(() => {
        // Some browsers may wait for a user interaction.
      });
    } else {
      video.pause();
    }
  }, [isVisible, shouldLoad]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-[#430b69] via-[#270646] to-[#130225]"
    >
      {shouldLoad ? (
        <video
          ref={videoRef}
          className="h-full w-full object-contain p-4 sm:p-6"
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          disablePictureInPicture
          aria-label={`${title} demonstration`}
        >
          <source src={src} type="video/mp4" />
        </video>
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="h-10 w-10 animate-pulse rounded-full border-4 border-white/20 border-t-lime-300" />
        </div>
      )}
    </div>
  );
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-black text-slate-950 sm:text-lg">
          {question}
        </span>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-950 font-black text-lime-300">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-5 text-base leading-7 text-slate-700">
          {answer}
        </div>
      )}
    </article>
  );
}

export default function SpokenEnglishOfferV2() {
  const [searchParams] = useSearchParams();

  const source = String(searchParams.get("source") || "direct").toLowerCase();
  const isWarmLead =
    WARM_SOURCES.has(source) ||
    searchParams.has("placement") ||
    searchParams.get("onboarding") === "1";

  useEffect(() => {
    document.title = "FluencyJet Spoken English Gym — 1-Year Access";
    document.body.classList.add("marketing-no-nav");
    trackSpokenEnglishOfferView();

    return () => {
      document.body.classList.remove("marketing-no-nav");
    };
  }, []);

  const hero = isWarmLead
    ? {
        eyebrow: "YOU’VE ALREADY STARTED",
        title: "Continue Building English Sentences With Confidence.",
        text: "You completed your first workout and explored FluencyJet. Unlock all 120 lessons and continue practising English step by step.",
        tamil:
          "நீங்கள் முதல் பயிற்சியை முடித்துவிட்டீர்கள். இப்போது முழு பாடங்களையும் திறந்து தொடர்ந்து பயிற்சி செய்யுங்கள்.",
      }
    : {
        eyebrow: "WELCOME TO THE SPOKEN ENGLISH GYM",
        title: "Build English Sentences Faster. Speak With Greater Confidence.",
        text: "Practise through 120 structured lessons and 4,800 guided exercises—one short English workout at a time.",
        tamil:
          "தினமும் சிறிது நேரம் பயிற்சி செய்து ஆங்கில வாக்கியங்களை வேகமாக உருவாக்குங்கள்.",
      };

  return (
    <>
      <MarketingNavHider />

      <main className="min-h-screen overflow-x-hidden bg-slate-50 pb-28 text-slate-950">
        {/* HERO */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#08021f] via-[#16064c] to-[#351183] text-white">
          <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-lime-300/10 blur-3xl" />

          <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:px-8 lg:py-16">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-300">
                {hero.eyebrow}
              </p>

              <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                {hero.title}
              </h1>

              <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-white/85">
                {hero.text}
              </p>

              <p className="mt-4 max-w-3xl text-base font-semibold leading-8 text-violet-100">
                {hero.tamil}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {[
                  "120 lessons",
                  "4,800 exercises",
                  "4 ways to practise",
                  "1-year access",
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <aside className="rounded-[2rem] border border-white/15 bg-white p-6 text-slate-950 shadow-2xl sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
                Complete One-Year Access
              </p>

              <div className="mt-4 flex items-end gap-3">
                <span className="text-5xl font-black tracking-tight sm:text-6xl">
                  ₹1,199
                </span>
                <span className="pb-2 font-bold text-slate-500">for 1 year</span>
              </div>

              <div className="mt-5 space-y-3 text-base font-bold text-slate-700">
                <p>✓ One-time payment</p>
                <p>✓ No monthly subscription</p>
                <p>✓ No automatic renewal</p>
                <p>✓ 7-day money-back guarantee</p>
              </div>

              <PurchaseButton className="mt-7 w-full" />

              <p className="mt-4 text-center text-xs font-bold leading-5 text-slate-500">
                Secure payment through UPI, GPay, PhonePe, Paytm, debit card or
                credit card.
              </p>

              <div className="mt-5 text-center text-sm">
                <WhatsAppSupport />
              </div>
            </aside>
          </div>
        </section>

        {/* VSL */}
        <section className="bg-[#090321] px-4 py-10 text-white sm:px-6 sm:py-14">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto mb-7 max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">
                See How FluencyJet Works
              </p>

              <h2 className="mt-3 text-3xl font-black sm:text-4xl">
                Watch This Short Explanation
              </h2>

              <p className="mt-3 text-base leading-7 text-white/70">
                See how the lessons, sentence patterns and daily practice work
                together.
              </p>
            </div>

            <div className="overflow-hidden rounded-[2rem] border-4 border-white/10 bg-black shadow-2xl">
              <div className="aspect-video">
                <iframe
                  className="h-full w-full"
                  src={`https://player.vimeo.com/video/${VIMEO_VIDEO_ID}`}
                  title="FluencyJet Spoken English Gym explanation"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>

            <div className="mt-7 text-center">
              <PurchaseButton />
            </div>
          </div>
        </section>

        {/* OUTCOMES */}
        <section className="bg-white px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeader
              eyebrow="What FluencyJet Helps You Do"
              title="Turn the English You Know Into Sentences You Can Speak."
              text="You may know English words and grammar. FluencyJet gives you short daily practice so the right sentence can come to mind more quickly."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {OUTCOMES.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[1.75rem] border border-violet-100 bg-gradient-to-br from-white to-violet-50/50 p-6 shadow-sm"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-2xl text-violet-800">
                    {item.icon}
                  </div>

                  <h3 className="mt-5 text-xl font-black text-slate-950">
                    {item.title}
                  </h3>

                  <p className="mt-3 text-base leading-7 text-slate-600">
                    {item.text}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-9 text-center">
              <PurchaseButton />
            </div>
          </div>
        </section>

        {/* PRACTICE MECHANISM */}
        <section className="bg-gradient-to-br from-[#11042f] via-[#26075a] to-[#15032e] px-4 py-12 text-white sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeader
              eyebrow="One Sentence. Four Ways to Practise."
              title="Build It. Type It. Speak It. Remember It."
              text="You practise the same useful sentence in different ways. This helps your brain understand, remember and use it."
              dark
            />

            <div className="grid gap-6 md:grid-cols-2">
              {PRACTICE_MODES.map((mode) => (
                <article
                  key={mode.title}
                  className="overflow-hidden rounded-[2rem] border border-white/15 bg-white text-slate-950 shadow-2xl"
                >
                  <PracticeModePreview
                    src={mode.video}
                    title={mode.title}
                  />

                  <div className="p-6 sm:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl shadow-lg ${mode.iconTone}`}
                      >
                        {mode.icon}
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${mode.badgeTone}`}
                      >
                        Mode {mode.number}
                      </span>
                    </div>

                    <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-violet-700">
                      {mode.brand}
                    </p>

                    <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                      {mode.title}
                    </h3>

                    <p className="mt-3 text-base font-medium leading-7 text-slate-600">
                      {mode.text}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <p className="mx-auto mt-9 max-w-3xl text-center text-lg font-black text-lime-200">
              You do not only watch English lessons. You practise using English.
            </p>

            <div className="mt-8 text-center">
              <PurchaseButton />
            </div>
          </div>
        </section>

        {/* INCLUDED + CREATOR */}
        <section className="bg-slate-50 px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeader
              eyebrow="Everything Included"
              title="Your Complete Spoken English Practice System"
              text="Open FluencyJet, continue from where you stopped and complete one short workout at a time."
            />

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-xl sm:p-8">
                <div className="grid gap-3 sm:grid-cols-2">
                  {INCLUDED_ITEMS.map((item) => (
                    <div
                      key={item}
                      className="flex gap-3 rounded-2xl bg-slate-50 p-4"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-700">
                        ✓
                      </span>

                      <span className="font-bold leading-6 text-slate-800">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>

                <PurchaseButton className="mt-7 w-full" />
              </div>

              <aside className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-950 to-slate-950 p-6 text-white shadow-xl sm:p-8">
                <img
                  src="/coach.jpg"
                  alt="Aravind Pasupathy, creator of FluencyJet"
                  loading="lazy"
                  className="mx-auto h-44 w-44 rounded-full border-4 border-white/20 object-cover shadow-xl"
                />

                <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-lime-300">
                  Your FluencyJet Trainer
                </p>

                <h3 className="mt-3 text-3xl font-black">Aravind Pasupathy</h3>

                <div className="mt-5 space-y-2 font-bold text-violet-100">
                  <p>✓ Guinness World Record Holder in Memory</p>
                  <p>✓ English Trainer and Memory Coach</p>
                  <p>✓ 35,000+ Learners Trained</p>
                </div>

                <p className="mt-6 leading-7 text-white/75">
                  I created FluencyJet for learners who know English words and
                  grammar but need a clear daily system to build sentences and
                  speak confidently.
                </p>

                <blockquote className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-5 font-bold leading-7 text-white">
                  “Stop only learning English. Start using it with confidence.”
                </blockquote>
              </aside>
            </div>
          </div>
        </section>

        {/* FINAL OFFER */}
        <section className="bg-gradient-to-br from-[#08021f] via-[#180650] to-[#301076] px-4 py-12 text-white sm:px-6 sm:py-16">
          <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/15 bg-white/10 p-6 text-center shadow-2xl backdrop-blur sm:p-10">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-300">
              Continue Your FluencyJet Journey
            </p>

            <h2 className="mt-4 text-3xl font-black sm:text-5xl">
              Complete One-Year Access
            </h2>

            <p className="mt-5 text-6xl font-black text-yellow-300">₹1,199</p>

            <p className="mt-3 text-lg font-black text-lime-200">
              One-time payment only
            </p>

            <div className="mx-auto mt-6 grid max-w-2xl gap-3 text-left font-bold sm:grid-cols-3">
              <div className="rounded-xl bg-white/10 p-4">✓ No subscription</div>
              <div className="rounded-xl bg-white/10 p-4">
                ✓ No automatic renewal
              </div>
              <div className="rounded-xl bg-white/10 p-4">
                ✓ 7-day guarantee
              </div>
            </div>

            <PurchaseButton className="mt-8 w-full max-w-xl" />

            <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/65">
              Secure payment using UPI, GPay, PhonePe, Paytm, debit card or
              credit card.
            </p>

            <div className="mt-6">
              <WhatsAppSupport dark />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <SectionHeader
              eyebrow="Questions"
              title="Frequently Asked Questions"
              text="Everything you need to know before joining FluencyJet."
            />

            <div className="space-y-4">
              {FAQS.map((faq) => (
                <FaqItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </div>
          </div>
        </section>

        <footer className="bg-slate-950 px-4 py-10 text-center text-sm text-slate-400">
          <p className="font-bold text-white">
            FluencyJet Sentence Master · Spoken English Gym
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-5">
            <a href="/refund-policy" className="hover:text-white">
              Refund Policy
            </a>
            <a href="/terms" className="hover:text-white">
              Terms
            </a>
            <a href="/privacy-policy" className="hover:text-white">
              Privacy
            </a>
            <a href="/contact" className="hover:text-white">
              Contact
            </a>
          </div>
        </footer>

        {/* STICKY PURCHASE BAR */}
        <div
          className="fixed inset-x-0 bottom-0 z-[100] border-t border-lime-300/40 bg-slate-950/95 px-3 pt-2 shadow-2xl backdrop-blur"
          style={{
            paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
          }}
        >
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="hidden min-w-0 flex-1 sm:block">
              <p className="font-black text-white">One-Year Full Access</p>
              <p className="text-xs font-semibold text-white/60">
                One-time payment · 7-day money-back guarantee
              </p>
            </div>

            <PurchaseButton className="w-full shrink-0 py-3.5 sm:w-auto sm:min-w-[340px]" />
          </div>
        </div>
      </main>
    </>
  );
}
