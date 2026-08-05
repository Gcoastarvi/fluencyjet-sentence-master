// client/src/pages/marketing/VocabularyCourse.jsx
import { useEffect, useState, useMemo } from "react";
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

const VOCABULARY_BONUSES = [
  {
    number: "01",
    title: "Ultimate Tense Playbook",
    image: "/vocabulary-bonuses/bonus-01-tense-playbook.png",
    value: "₹700",
    benefit:
      "Understand the major English tense patterns through a practical reference guide.",
  },
  {
    number: "02",
    title: "Clever Ways to Speak in Style",
    image: "/vocabulary-bonuses/bonus-02-speak-in-style.png",
    value: "₹700",
    benefit:
      "Learn useful expressions that make everyday English sound more natural and engaging.",
  },
  {
    number: "03",
    title: "Fearless Communicator’s Handbook",
    image: "/vocabulary-bonuses/bonus-03-fearless-communicator.png",
    value: "₹700",
    benefit:
      "Use practical communication strategies to speak with greater confidence.",
  },
  {
    number: "04",
    title: "Pronunciation Tongue Twisters",
    image: "/vocabulary-bonuses/bonus-04-pronunciation.png",
    value: "₹600",
    benefit:
      "Practise difficult English sounds and improve pronunciation clarity.",
  },
  {
    number: "05",
    title: "Idiom Powerpack",
    image: "/vocabulary-bonuses/bonus-05-idioms.png",
    value: "₹500",
    benefit:
      "Understand and use high-value English idioms in the right situations.",
  },
  {
    number: "06",
    title: "Dynamic Phrasal Verbs Guide",
    image: "/vocabulary-bonuses/bonus-06-phrasal-verbs.png",
    value: "₹500",
    benefit:
      "Build confidence with commonly used phrasal verbs and their meanings.",
  },
  {
    number: "07",
    title: "Native Speakers’ Collocations",
    image: "/vocabulary-bonuses/bonus-07-collocations.png",
    value: "₹500",
    benefit:
      "Learn natural word combinations commonly used by fluent English speakers.",
  },
  {
    number: "08",
    title: "Brilliant Ways to Write",
    image: "/vocabulary-bonuses/bonus-08-writing.png",
    value: "₹500",
    benefit:
      "Improve sentence clarity, vocabulary choice and everyday English writing.",
  },
  {
    number: "09",
    title: "Daily English Quiz on WhatsApp",
    image: "/vocabulary-bonuses/bonus-09-whatsapp-quiz.png",
    value: "Priceless",
    benefit:
      "Continue practising regularly through short vocabulary quizzes on WhatsApp.",
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

const VIDEO_TESTIMONIALS = [
  {
    id: "945277822",
    title: "Student Experience",
  },
  {
    id: "926579704",
    title: "Vocabulary Learning Feedback",
  },
  {
    id: "926580464",
    title: "Student Success Feedback",
  },
];

const VOCABULARY_FAQS = [
  {
    question: "What is the main goal of this vocabulary course?",
    answer:
      "The course helps you understand and remember difficult English words through source words, word families and meaningful connections instead of memorising every word separately.",
  },
  {
    question: "Who is this course suitable for?",
    answer:
      "It is suitable for students, professionals, job seekers, competitive-exam learners and anyone who wants to improve English vocabulary, reading, writing, speaking and comprehension.",
  },
  {
    question: "How much course content is included?",
    answer:
      "You receive more than 11 hours of structured video lessons, practical vocabulary explanations, source-word examples and supporting bonus materials.",
  },
  {
    question: "Do I need advanced English knowledge?",
    answer:
      "No. The lessons explain the method in clear English and gradually help you understand connected word families. Both developing and experienced English learners can use the course.",
  },
  {
    question: "How long can I access the course?",
    answer:
      "You receive one full year of access. You can learn at your own pace using a mobile phone, tablet or computer.",
  },
  {
    question: "What bonuses are included?",
    answer:
      "You receive nine practical English bonuses covering tenses, speaking style, confident communication, pronunciation, idioms, phrasal verbs, collocations, writing and daily WhatsApp vocabulary practice.",
  },
  {
    question: "Is ₹799 a monthly subscription?",
    answer:
      "No. ₹799 is a one-time payment. There is no monthly subscription and no automatic monthly renewal.",
  },
  {
    question: "How will I receive the course after payment?",
    answer:
      "Course access instructions will be shared using the email and contact details entered during payment. You can also contact FluencyJet WhatsApp support if you need assistance.",
  },
];

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

function BonusStackSection({ destination }) {
  return (
    <section className="bg-gradient-to-b from-white to-slate-50 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
            Included With Your Course
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
            Get All 9 Practical English Bonuses
          </h2>

          <p className="mx-auto mt-4 max-w-3xl text-base font-medium leading-7 text-slate-600 sm:text-lg">
            These additional guides help you strengthen grammar, speaking,
            pronunciation, vocabulary and writing alongside the main course.
          </p>

          <div className="mx-auto mt-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-black text-emerald-800">
            Bonuses worth ₹4,700 included
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {VOCABULARY_BONUSES.map((bonus) => (
            <article
              key={bonus.number}
              className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/50"
            >
              <div className="aspect-[4/5] overflow-hidden bg-white">
                <img
                  src={bonus.image}
                  alt={bonus.title}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-lime-300">
                    Bonus #{bonus.number}
                  </span>

                  <span className="text-sm font-black text-orange-600">
                    Value {bonus.value}
                  </span>
                </div>

                <h3 className="mt-4 text-xl font-black leading-tight text-slate-950">
                  {bonus.title}
                </h3>

                <p className="mt-3 leading-7 text-slate-600">{bonus.benefit}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-2xl rounded-[2rem] bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 p-6 text-center text-white shadow-2xl sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-lime-300">
            Complete Vocabulary Course + All 9 Bonuses
          </p>

          <div className="mt-4 flex items-end justify-center gap-3">
            <span className="text-xl font-bold text-white/45 line-through">
              ₹8,700
            </span>

            <span className="text-5xl font-black text-yellow-300">₹799</span>
          </div>

          <p className="mt-3 font-semibold text-white/70">
            One-time payment · 1-year course access
          </p>

          <div className="mt-6">
            <PurchaseButton
              placement="bonus-stack"
              destination={destination}
              children="Get 1-Year Access + All 9 Bonuses — ₹799"
            />
          </div>

          <p className="mt-4 text-xs font-semibold text-white/55 sm:text-sm">
            Secure Razorpay checkout · No monthly subscription
          </p>
        </div>
      </div>
    </section>
  );
}

function TestimonialSection({ destination }) {
  return (
    <section className="bg-slate-950 px-4 py-14 text-white sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-300">
            Student Feedback
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            See What Learners Say About the Training
          </h2>

          <p className="mx-auto mt-4 max-w-3xl text-base font-medium leading-7 text-white/70 sm:text-lg">
            Hear directly from learners who experienced the vocabulary and
            English-training method.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {VIDEO_TESTIMONIALS.map((testimonial) => (
            <article
              key={testimonial.id}
              className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 shadow-2xl"
            >
              <div className="relative w-full pb-[56.25%]">
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={`https://player.vimeo.com/video/${testimonial.id}?title=0&byline=0&portrait=0`}
                  title={testimonial.title}
                  loading="lazy"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <p className="p-4 text-center font-bold text-white/80">
                {testimonial.title}
              </p>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-2xl text-center">
          <PurchaseButton
            placement="testimonials"
            destination={destination}
            children="Join the Vocabulary Challenge — ₹799"
          />

          <p className="mt-4 text-sm font-semibold text-white/55">
            One-time payment · 1-year access · Secure Razorpay checkout
          </p>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="bg-slate-50 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
            Questions Answered
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Frequently Asked Questions
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Everything you need to know before joining the Vocabulary Challenge.
          </p>
        </div>

        <div className="mt-10 space-y-4">
          {VOCABULARY_FAQS.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <article
                key={item.question}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left sm:px-6"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-black text-slate-950 sm:text-lg">
                    {item.question}
                  </span>

                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-950 text-xl font-black text-lime-300">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
                    <p className="leading-7 text-slate-600">{item.answer}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalOfferSection({ destination }) {
  return (
    <section className="bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950 px-4 py-14 text-white sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-6 text-center shadow-2xl backdrop-blur sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-300">
          Complete Course + All 9 Bonuses
        </p>

        <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
          Start Building a More Powerful English Vocabulary
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
          Get the complete source-word vocabulary course, one-year access and
          all nine practical English bonuses.
        </p>

        <div className="mt-7 flex items-end justify-center gap-4">
          <span className="pb-1 text-xl font-bold text-white/40 line-through sm:text-2xl">
            ₹8,700
          </span>

          <span className="text-5xl font-black text-yellow-300 sm:text-6xl">
            ₹799
          </span>
        </div>

        <p className="mt-3 font-semibold text-white/70">
          One-time payment · No monthly subscription
        </p>

        <div className="mx-auto mt-8 max-w-2xl">
          <PurchaseButton
            placement="final-offer"
            destination={destination}
            children="Get 1-Year Access + All 9 Bonuses — ₹799"
          />
        </div>

        <div className="mt-7 grid gap-3 text-sm font-bold text-white/75 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            ✓ One-time payment
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            ✓ One-year access
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            ✓ Secure Razorpay checkout
          </div>
        </div>
      </div>
    </section>
  );
}

function VocabularyWhatsAppSupport() {
  const whatsappUrl =
    "https://wa.me/919487070761?text=" +
    encodeURIComponent(
      "Hi FluencyJet, I watched the English Vocabulary Masterclass and I need help joining the ₹799 Vocabulary Challenge.",
    );

  return (
    <section className="bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-[1.75rem] border border-emerald-100 bg-emerald-50 p-6 text-center sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
          Need Help?
        </p>

        <h2 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">
          Questions Before Joining?
        </h2>

        <p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-600">
          Contact FluencyJet support if you have questions about payment, course
          access or the learning method.
        </p>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          onClick={trackVocabularyOfferWhatsAppClick}
          className="mt-6 inline-flex min-h-14 items-center justify-center rounded-2xl bg-emerald-600 px-7 py-4 text-base font-black text-white shadow-lg transition hover:bg-emerald-700"
        >
          Chat on WhatsApp: 9487070761
        </a>
      </div>
    </section>
  );
}

function VocabularyLegalFooter() {
  return (
    <footer className="bg-[#020617] px-4 py-8 text-center text-white/50 sm:px-6">
      <p className="mx-auto max-w-4xl text-xs leading-6 sm:text-sm">
        This site is not part of Facebook or Meta. This site is not endorsed by
        Facebook or Meta in any way. Facebook is a trademark of Meta Platforms,
        Inc.
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm font-semibold">
        <a href="/privacy-policy" className="transition hover:text-white">
          Privacy Policy
        </a>

        <a href="/terms" className="transition hover:text-white">
          Terms & Conditions
        </a>

        <a href="/refund-policy" className="transition hover:text-white">
          Refund Policy
        </a>

        <a href="/contact" className="transition hover:text-white">
          Contact
        </a>
      </div>

      <p className="mt-5 text-xs text-white/35">
        © {new Date().getFullYear()} FluencyJet. All rights reserved.
      </p>
    </footer>
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
                  ₹8,700
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

        <BonusStackSection destination={paymentDestination} />

        <TestimonialSection destination={paymentDestination} />

        <FAQSection />

        <FinalOfferSection destination={paymentDestination} />

        <VocabularyWhatsAppSupport />

        <VocabularyLegalFooter />
      </main>
    </>
  );
}
