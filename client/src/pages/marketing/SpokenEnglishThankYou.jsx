import { useEffect, useMemo } from "react";

const LEVEL_CHECK_URL =
  "/level-check?source=spoken_english_purchase";

const LOGIN_URL = "/login";

const WHATSAPP_URL =
  "https://wa.me/919047122250?text=" +
  encodeURIComponent(
    "Hi FluencyJet, I have completed the ₹1,199 payment for Sentence Master Spoken English Gym. Please help me with my learning-path access."
  );

function SuccessIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-12 w-12 stroke-current"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function StepIcon({ type }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    className: "h-7 w-7 stroke-current",
    strokeWidth: "2.1",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  if (type === "level") {
    return (
      <svg {...props}>
        <path d="M5 20h4v-5H5v5Z" />
        <path d="M10 20h4V10h-4v10Z" />
        <path d="M15 20h4V5h-4v15Z" />
        <path d="m5 10 5-5 3 3 6-5" />
      </svg>
    );
  }

  if (type === "login") {
    return (
      <svg {...props}>
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M9 12h8" />
        <path d="m14 9 3 3-3 3" />
        <path d="M8 7h.01" />
      </svg>
    );
  }

  return (
    <svg {...props}>
      <path d="M3 9v6" />
      <path d="M6 7v10" />
      <path d="M9 10v4" />
      <path d="M15 10v4" />
      <path d="M18 7v10" />
      <path d="M21 9v6" />
      <path d="M9 12h6" />
    </svg>
  );
}

const steps = [
  {
    number: "01",
    type: "level",
    title: "Confirm Your Learning Level",
    text: "Take the short level check to identify whether the Beginner or Intermediate path suits you.",
  },
  {
    number: "02",
    type: "login",
    title: "Open Your Sentence Master Login",
    text: "Use your FluencyJet login to access your selected learning path.",
  },
  {
    number: "03",
    type: "practice",
    title: "Start Your Daily Gym Practice",
    text: "Practise for 10–15 minutes using Reorder, Typing, Voice, and Dictation modes.",
  },
];

function NextStepCard({ step }) {
  return (
    <article className="relative overflow-hidden rounded-[1.75rem] border border-purple-100 bg-white p-6 shadow-lg shadow-purple-100/60">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-lime-300 via-purple-500 to-lime-300" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-950 via-purple-800 to-violet-700 text-lime-300 shadow-xl shadow-purple-200">
          <StepIcon type={step.type} />
        </div>

        <span className="rounded-full border border-lime-200 bg-lime-50 px-3 py-1 text-xs font-black tracking-[0.16em] text-purple-800">
          {step.number}
        </span>
      </div>

      <h2 className="mt-5 text-xl font-black leading-tight text-slate-950">
        {step.title}
      </h2>

      <p className="mt-3 text-base leading-relaxed text-slate-600">
        {step.text}
      </p>
    </article>
  );
}

export default function SpokenEnglishThankYou() {
  const paymentReference = useMemo(() => {
    if (typeof window === "undefined") return "";

    const params = new URLSearchParams(window.location.search);

    return (
      params.get("razorpay_payment_id") ||
      params.get("payment_id") ||
      params.get("reference") ||
      ""
    );
  }, []);

  useEffect(() => {
    document.title =
      "Payment Successful | FluencyJet Spoken English Gym";

    try {
      window.gtag?.("event", "spoken_english_thank_you_view", {
        value: 1199,
        currency: "INR",
      });

      window.fbq?.(
        "trackCustom",
        "SpokenEnglishThankYouViewed",
        {
          value: 1199,
          currency: "INR",
        }
      );
    } catch (error) {
      console.warn("Thank-you tracking error:", error);
    }
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-b from-[#05021a] via-[#12053d] to-[#020617] pb-10 text-white">
      <section className="relative">
        <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-lime-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-60 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-lime-300 to-lime-400 text-purple-950 shadow-2xl shadow-lime-500/30">
              <SuccessIcon />
            </div>

            <p className="mt-7 text-sm font-black uppercase tracking-[0.25em] text-lime-300">
              Payment Successful
            </p>

            <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Welcome to the FluencyJet
              <span className="block text-yellow-300">
                Spoken English Gym
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-white/75 sm:text-xl">
              Thank you for joining. Your ₹1,199 payment for
              1-year access has been received.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-5xl rounded-[2.25rem] bg-gradient-to-br from-lime-300/70 via-purple-500/50 to-purple-950 p-[2px] shadow-2xl shadow-purple-950/40">
            <div className="rounded-[2.15rem] bg-white px-5 py-7 text-slate-950 sm:px-8 sm:py-9">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-purple-50 p-5 text-center">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">
                    Payment
                  </p>
                  <p className="mt-2 text-3xl font-black text-purple-950">
                    ₹1,199
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    One-time payment
                  </p>
                </div>

                <div className="rounded-2xl bg-lime-50 p-5 text-center">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">
                    Access Period
                  </p>
                  <p className="mt-2 text-3xl font-black text-purple-950">
                    1 Year
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Online browser access
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-5 text-center">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">
                    Learning Path
                  </p>
                  <p className="mt-2 text-xl font-black text-purple-950">
                    Beginner or Intermediate
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Based on your current level
                  </p>
                </div>
              </div>

              {paymentReference && (
                <div className="mt-5 rounded-2xl border border-purple-100 bg-white px-5 py-4 text-center">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">
                    Payment Reference
                  </p>
                  <p className="mt-2 break-all font-bold text-slate-700">
                    {paymentReference}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-5xl">
            <div className="text-center">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-lime-300">
                What Happens Next
              </p>

              <h2 className="mt-3 text-3xl font-black sm:text-4xl">
                Complete These 3 Simple Steps
              </h2>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {steps.map((step) => (
                <NextStepCard key={step.number} step={step} />
              ))}
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-4xl rounded-[2rem] border border-white/15 bg-white/10 p-5 text-center shadow-2xl backdrop-blur sm:p-7">
            <p className="text-lg font-black text-white sm:text-xl">
              Start by confirming the right learning path for you.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <a
                href={LEVEL_CHECK_URL}
                className="flex items-center justify-center rounded-2xl bg-gradient-to-r from-yellow-300 to-lime-400 px-6 py-5 text-lg font-black text-slate-950 shadow-xl shadow-lime-500/20 transition hover:-translate-y-0.5"
              >
                Take My Level Check
              </a>

              <a
                href={LOGIN_URL}
                className="flex items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-6 py-5 text-lg font-black text-white transition hover:bg-white/15"
              >
                Go to Sentence Master Login
              </a>
            </div>

            <div className="mt-6 rounded-2xl border border-lime-300/20 bg-slate-950/40 px-5 py-4">
              <p className="font-black text-lime-300">
                No Play Store or App Store download required
              </p>

              <p className="mt-1 text-sm leading-relaxed text-white/65">
                Sentence Master works directly in Chrome, Safari,
                or your computer browser.
              </p>
            </div>

            <p className="mt-7 text-sm font-semibold text-white/65">
              Need help with access or level selection?
            </p>

            <a
              href={WHATSAPP_URL}
              className="mt-2 inline-flex text-lg font-black text-white underline decoration-lime-300 decoration-2 underline-offset-4"
            >
              WhatsApp Support: 9047122250
            </a>
          </div>

          <footer className="mx-auto mt-12 max-w-3xl text-center">
            <p className="text-xs leading-relaxed text-white/45 sm:text-sm">
              This site is not part of Facebook or Meta and is not
              endorsed by Facebook in any way. Facebook is a
              trademark of Meta Platforms, Inc.
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}
