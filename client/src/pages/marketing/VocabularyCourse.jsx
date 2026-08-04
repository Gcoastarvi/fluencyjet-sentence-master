// client/src/pages/marketing/VocabularyCourse.jsx
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  trackVocabularyCourseView,
  trackVocabularyInitiateCheckout,
  trackVocabularyCourseWhatsAppClick,
} from "../../lib/tracking";

const PAYMENT_URL =
  import.meta.env.VITE_VOCABULARY_PAYMENT_URL || "https://rzp.io/l/oiniUKO";

const WHATSAPP_URL =
  "https://wa.me/919487070761?text=" +
  encodeURIComponent(
    "Hi FluencyJet, I watched the English Vocabulary Masterclass and I need help joining the Vocabulary Challenge.",
  );

const ALLOWED_FORWARD_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "source",
  "fbclid",
];

const DELIVERABLES = [
  {
    icon: "▶",
    title: "11+ Hours of Lessons",
    text: "Structured vocabulary lessons taught through practical explanations.",
  },
  {
    icon: "🧠",
    title: "Source-Word Method",
    text: "Learn connected word families instead of memorising every word separately.",
  },
  {
    icon: "💬",
    title: "Daily WhatsApp Quiz",
    text: "Strengthen recall and continue practising vocabulary regularly.",
  },
  {
    icon: "📅",
    title: "1-Year Access",
    text: "Learn at your own pace on your phone, tablet or computer.",
  },
];

const WORD_FAMILY_EXAMPLES = [
  {
    source: "PORT",
    meaning: "carry",
    explanation:
      "Once you understand that PORT means carry, several related words become easier to decode.",
    words: [
      {
        word: "Transport",
        breakdown: "TRANS + PORT",
        meaning: "carry across",
      },
      {
        word: "Import",
        breakdown: "IM + PORT",
        meaning: "carry into a country",
      },
      {
        word: "Export",
        breakdown: "EX + PORT",
        meaning: "carry out of a country",
      },
      {
        word: "Portable",
        breakdown: "PORT + ABLE",
        meaning: "able to be carried",
      },
    ],
  },
  {
    source: "SPECT",
    meaning: "look or see",
    explanation:
      "Recognising SPECT helps learners understand words connected with looking, seeing and observing.",
    words: [
      {
        word: "Inspect",
        breakdown: "IN + SPECT",
        meaning: "look into carefully",
      },
      {
        word: "Spectator",
        breakdown: "SPECT + ATOR",
        meaning: "a person who watches",
      },
      {
        word: "Retrospect",
        breakdown: "RETRO + SPECT",
        meaning: "look back",
      },
      {
        word: "Perspective",
        breakdown: "PER + SPECT",
        meaning: "a way of looking at something",
      },
    ],
  },
  {
    source: "DICT",
    meaning: "say or speak",
    explanation:
      "DICT appears in many words connected with speaking, saying and communicating.",
    words: [
      {
        word: "Predict",
        breakdown: "PRE + DICT",
        meaning: "say before it happens",
      },
      {
        word: "Contradict",
        breakdown: "CONTRA + DICT",
        meaning: "speak against",
      },
      {
        word: "Dictate",
        breakdown: "DICT + ATE",
        meaning: "say something aloud",
      },
      {
        word: "Dictionary",
        breakdown: "DICT + IONARY",
        meaning: "a reference for words",
      },
    ],
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

function buildTrackedPaymentUrl(searchParams) {
  try {
    const paymentUrl = new URL(PAYMENT_URL);

    ALLOWED_FORWARD_PARAMS.forEach((key) => {
      const value = searchParams.get(key);

      if (value) {
        paymentUrl.searchParams.set(key, value);
      }
    });

    paymentUrl.searchParams.set("product", "vocabulary-challenge-799");

    return paymentUrl.toString();
  } catch {
    return PAYMENT_URL;
  }
}

function PurchaseButton({
  placement,
  destination,
  children = "Join Now for ₹799",
  className = "",
}) {
  function handlePurchase() {
    trackVocabularyInitiateCheckout({
      placement,
      source: "vocabulary-course",
    });

    if (!destination) {
      window.alert(
        "The payment link is temporarily unavailable. Please contact WhatsApp Support: 9487070761",
      );
      return;
    }

    window.setTimeout(() => {
      window.location.href = destination;
    }, 250);
  }

  return (
    <button
      type="button"
      onClick={handlePurchase}
      data-testid={`vocabulary-payment-${placement}`}
      className={`w-full rounded-2xl bg-gradient-to-r from-yellow-300 via-yellow-300 to-lime-400 px-6 py-5 text-center text-lg font-black text-slate-950 shadow-xl shadow-lime-500/20 transition hover:-translate-y-0.5 hover:shadow-lime-500/30 active:scale-[0.99] sm:text-xl ${className}`}
    >
      {children}
    </button>
  );
}

function SecurePaymentStrip() {
  return (
    <div className="mt-5">
      <div className="grid gap-3 text-sm font-bold text-white/80 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
          ✓ One-time payment
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
          ✓ 1-year access
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
          ✓ Secure Razorpay checkout
        </div>
      </div>

      <img
        src="/secure-payment.png"
        alt="Secure payment and trusted checkout"
        className="mx-auto mt-5 h-auto w-full max-w-md object-contain"
        loading="lazy"
      />

      <p className="mt-2 text-center text-xs font-semibold text-white/60 sm:text-sm">
        Secure checkout through Razorpay
      </p>
    </div>
  );
}

function SourceWordMethodSection({ destination }) {
  return (
    <section className="bg-gradient-to-b from-white to-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">
            How the method works
          </p>

          <h2 className="mt-4 text-3xl font-black leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
            Learn one source word.
            <span className="block text-emerald-700">
              Unlock an entire family of English words.
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
            Instead of memorising difficult words one by one, FluencyJet helps
            you understand the meaningful building blocks hidden inside them.
          </p>
        </div>

        <div className="mt-12 grid gap-7 lg:grid-cols-3">
          {WORD_FAMILY_EXAMPLES.map((family) => (
            <article
              key={family.source}
              className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/50"
            >
              <div className="bg-gradient-to-br from-[#032f27] to-[#021426] px-6 py-7 text-center text-white">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-300">
                  Source word
                </p>

                <h3 className="mt-2 text-5xl font-black text-yellow-300">
                  {family.source}
                </h3>

                <p className="mt-2 text-lg font-bold text-white/85">
                  Meaning: “{family.meaning}”
                </p>
              </div>

              <div className="p-5 sm:p-6">
                <p className="text-sm leading-6 text-slate-600">
                  {family.explanation}
                </p>

                <div className="mt-5 space-y-3">
                  {family.words.map((item) => (
                    <div
                      key={item.word}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-lg font-black text-slate-950">
                          {item.word}
                        </p>

                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                          {item.breakdown}
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-semibold text-slate-600">
                        {item.meaning}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-8">
          <p className="text-xl font-black text-slate-950 sm:text-2xl">
            One source word can help you understand several connected words.
          </p>

          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600">
            This reduces random memorisation and helps unfamiliar words become
            easier to understand, remember and use.
          </p>

          <PurchaseButton
            placement="source-word-method"
            destination={destination}
            className="mt-6 max-w-2xl"
          >
            Learn the Source-Word Method — Join for ₹799
          </PurchaseButton>
        </div>
      </div>
    </section>
  );
}

export default function VocabularyCourse() {
  const [searchParams] = useSearchParams();

  const paymentDestination = useMemo(
    () => buildTrackedPaymentUrl(searchParams),
    [searchParams],
  );

  const source =
    searchParams.get("source") ||
    searchParams.get("utm_source") ||
    "vocabulary-course";

  useEffect(() => {
    document.title = "English Vocabulary Challenge | FluencyJet";

    document.body.classList.add("marketing-no-nav");

    trackVocabularyCourseView({
      source,
    });

    return () => {
      document.body.classList.remove("marketing-no-nav");
    };
  }, [source]);

  return (
    <>
      <MarketingNavHider />

      <main className="min-h-screen overflow-hidden bg-white text-slate-950">
        {/* HERO */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#03152d] via-[#062f40] to-[#06351f] px-4 py-10 text-white sm:px-6 sm:py-14">
          <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-lime-300/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-yellow-300/10 blur-3xl" />

          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-300 sm:text-sm">
                English Vocabulary Challenge
              </p>

              <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Build a Powerful English Vocabulary
                <span className="block text-yellow-300">
                  Without Memorising Words One by One
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-3xl text-lg font-medium leading-8 text-white/80 sm:text-xl">
                Learn how source words and word families can help you decode,
                understand and remember difficult English words more
                confidently.
              </p>
            </div>

            <div className="mx-auto mt-9 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                "2,239 high-value words",
                "11+ hours of lessons",
                "Daily WhatsApp quiz",
                "1-year access",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-center font-bold text-white backdrop-blur"
                >
                  <span className="mr-2 text-lime-300">✓</span>
                  {item}
                </div>
              ))}
            </div>

            <div className="mx-auto mt-9 max-w-2xl rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur sm:p-8">
              <p className="text-center text-sm font-black uppercase tracking-[0.18em] text-lime-300">
                Complete Course + Bonuses
              </p>

              <div className="mt-4 flex items-end justify-center gap-3">
                <span className="text-xl font-bold text-white/50 line-through">
                  ₹8,200
                </span>

                <span className="text-5xl font-black text-yellow-300 sm:text-6xl">
                  ₹799
                </span>
              </div>

              <p className="mt-2 text-center font-semibold text-white/70">
                One-time payment · 1-year access
              </p>

              <PurchaseButton
                placement="hero"
                destination={paymentDestination}
                className="mt-6"
              />

              <p className="mt-3 text-center text-sm font-bold text-white/70">
                No monthly subscription · No automatic renewal
              </p>

              <SecurePaymentStrip />
            </div>

            <div className="mt-7 text-center">
              <a
                href={WHATSAPP_URL}
                onClick={() =>
                  trackVocabularyCourseWhatsAppClick({
                    source: "hero",
                  })
                }
                className="font-bold text-white underline decoration-lime-300 underline-offset-4 transition hover:text-lime-300"
              >
                Questions? WhatsApp Support: 9487070761
              </a>
            </div>
          </div>
        </section>

        {/* DELIVERABLES */}
        <section className="bg-slate-50 px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
                What You Receive
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                A Complete Vocabulary-Building System
              </h2>

              <p className="mt-4 text-lg leading-8 text-slate-600">
                Build word power through organised lessons, meaningful
                connections and regular practice.
              </p>
            </div>

            <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {DELIVERABLES.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-center shadow-lg shadow-slate-200/50"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950 text-2xl text-lime-300">
                    {item.icon}
                  </div>

                  <h3 className="mt-5 text-xl font-black">{item.title}</h3>

                  <p className="mt-3 leading-7 text-slate-600">{item.text}</p>
                </article>
              ))}
            </div>

            <div className="mx-auto mt-10 max-w-xl">
              <PurchaseButton
                placement="deliverables"
                destination={paymentDestination}
                children="Start the Vocabulary Challenge — ₹799"
              />
            </div>
          </div>
        </section>

        <SourceWordMethodSection destination={paymentDestination} />

        {/* CREDIBILITY */}
        <section className="bg-white px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-8 rounded-[2rem] bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 p-6 text-white shadow-2xl sm:p-9 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
            <img
              src="/coach.jpg"
              alt="Aravind Pasupathy, memory trainer and creator of FluencyJet"
              loading="lazy"
              className="mx-auto h-64 w-64 rounded-[2rem] border-4 border-white/10 object-cover shadow-2xl"
            />

            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">
                Learn From an Experienced Memory Trainer
              </p>

              <h2 className="mt-3 text-3xl font-black sm:text-4xl">
                Aravind Pasupathy
              </h2>

              <div className="mt-5 space-y-3 font-bold text-white/85">
                <p>✓ Guinness World Record holder in memory</p>
                <p>✓ English trainer and memory coach</p>
                <p>✓ 35,000+ learners trained</p>
              </div>

              <p className="mt-6 max-w-2xl leading-8 text-white/70">
                This vocabulary system is designed to help learners organise
                words into meaningful families so that learning becomes clearer,
                faster and easier to remember.
              </p>
            </div>
          </div>
        </section>

        <footer className="bg-slate-950 px-4 py-8 text-center text-white">
          <p className="mx-auto max-w-4xl text-xs leading-6 text-white/50 sm:text-sm">
            This site is not part of Facebook or Meta. This site is not endorsed
            by Facebook or Meta in any way. Facebook is a trademark of Meta
            Platforms, Inc.
          </p>
        </footer>
      </main>
    </>
  );
}
