import { trackSpokenEnglishInitiateCheckout } from "../../lib/tracking";

function OfferFeatureIcon({ type }) {
  const common = "h-5 w-5 stroke-current";

  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    className: common,
    stroke: "currentColor",
    strokeWidth: "2.1",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  switch (type) {
    case "lessons":
      return (
        <svg {...props}>
          <rect x="4" y="3" width="14" height="18" rx="2.5" />
          <path d="M8 8h6" />
          <path d="M8 12h6" />
          <path d="M8 16h3" />
          <path d="M18 7h2a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H8" />
        </svg>
      );

    case "grammar":
      return (
        <svg {...props}>
          <path d="M5 4h8a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4Z" />
          <path d="M16 7h3a2 2 0 0 1 2 2v11h-5" />
          <path d="M8 9h4" />
          <path d="M8 13h3" />
          <path d="m14 15 1.5 1.5 3-3.5" />
        </svg>
      );

    case "topics":
      return (
        <svg {...props}>
          <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2h7A3.5 3.5 0 0 1 18 5.5V10a3.5 3.5 0 0 1-3.5 3.5H10L5 18v-5A3.5 3.5 0 0 1 4 10V5.5Z" />
          <path d="M8 7h6" />
          <path d="M8 10h3" />
          <path d="M15 16h2a3 3 0 0 1 3 3v2h-2l-3 2v-2" />
        </svg>
      );

    case "modes":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="7" height="6" rx="2" />
          <rect x="14" y="4" width="7" height="6" rx="2" />
          <rect x="3" y="14" width="7" height="6" rx="2" />
          <rect x="14" y="14" width="7" height="6" rx="2" />
        </svg>
      );

    case "path":
      return (
        <svg {...props}>
          <circle cx="5" cy="18" r="2" />
          <circle cx="12" cy="11" r="2" />
          <circle cx="19" cy="5" r="2" />
          <path d="m6.5 16.5 4-4" />
          <path d="m13.5 9.5 4-3.5" />
        </svg>
      );

    default:
      return (
        <svg {...props}>
          <path d="M4 19V9" />
          <path d="M10 19V5" />
          <path d="M16 19v-7" />
          <path d="M22 19H2" />
          <path d="m4 7 5-4 5 4 6-5" />
        </svg>
      );
  }
}

const features = [
  {
    type: "lessons",
    text: "120 structured lessons",
    icon: "from-purple-950 to-purple-700 text-lime-300",
  },
  {
    type: "grammar",
    text: "Simple grammar explanations",
    icon: "from-indigo-900 to-purple-700 text-cyan-200",
  },
  {
    type: "topics",
    text: "Real-life spoken English topics",
    icon: "from-fuchsia-900 to-purple-700 text-lime-200",
  },
  {
    type: "modes",
    text: "Reorder, Typing, Voice & Dictation",
    icon: "from-emerald-800 to-purple-800 text-lime-200",
  },
  {
    type: "path",
    text: "Choose Beginner or Intermediate",
    icon: "from-sky-800 to-purple-800 text-cyan-100",
  },
  {
    type: "progress",
    text: "XP, streaks and progress tracking",
    icon: "from-amber-600 to-purple-900 text-yellow-100",
  },
];

export default function LaunchOfferCard({ paymentUrl }) {
  return (
    <section className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
      <div className="rounded-[2.5rem] bg-gradient-to-br from-lime-300/70 via-purple-500/45 to-purple-950 p-[2px] shadow-2xl shadow-purple-950/30">
        <div className="overflow-hidden rounded-[2.4rem] bg-white">
          <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
            <div className="relative overflow-hidden bg-gradient-to-br from-purple-950 via-purple-900 to-slate-950 px-6 py-9 text-center text-white sm:px-9 sm:py-11 lg:flex lg:flex-col lg:justify-center">
              <div className="pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full bg-lime-300/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-purple-400/25 blur-3xl" />

              <div className="relative">
                <div className="mx-auto w-fit rounded-full border border-lime-300/25 bg-white/10 px-5 py-2 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-300 sm:text-sm">
                    Special Online Offer
                  </p>
                </div>

                <h2 className="mx-auto mt-6 max-w-xl text-3xl font-black leading-tight sm:text-4xl">
                  1-Year Access to Your Spoken English Gym
                </h2>

                <div className="mx-auto mt-7 w-fit rounded-[2rem] bg-gradient-to-r from-purple-700 via-violet-600 to-purple-700 px-7 py-4 shadow-2xl shadow-purple-950/40">
                  <p className="text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
                    ₹1,199
                  </p>
                </div>

                <p className="mx-auto mt-5 w-fit rounded-full bg-lime-300 px-5 py-2 text-base font-black text-purple-950">
                  One-time payment only
                </p>

                <div className="mx-auto mt-5 w-fit rounded-2xl border border-white/15 bg-white/10 px-5 py-3">
                  <p className="text-sm font-black text-white sm:text-base">
                    Beginner <span className="text-lime-300">or</span>{" "}
                    Intermediate
                  </p>
                  <p className="mt-1 text-xs font-semibold text-white/60">
                    Choose the path that matches your current level
                  </p>
                </div>
              </div>
            </div>

            <div className="relative bg-gradient-to-b from-white via-white to-purple-50/40 px-5 py-7 sm:px-8 sm:py-9">
              <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-lime-200/25 blur-3xl" />

              <div className="relative">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-700">
                  Your Access Includes
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {features.map((feature) => (
                    <div
                      key={feature.text}
                      className="flex items-center gap-3 rounded-2xl border border-purple-100 bg-white px-4 py-3 shadow-sm shadow-purple-100/60"
                    >
                      <div
                        className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br shadow-md ${feature.icon}`}
                      >
                        <OfferFeatureIcon type={feature.type} />
                      </div>

                      <p className="text-sm font-black leading-snug text-slate-900">
                        {feature.text}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-4">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-lime-300 text-lg font-black text-purple-950">
                    ✓
                  </div>

                  <div>
                    <p className="font-black text-slate-950">
                      No app download required
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Practise directly in your mobile or computer browser.
                    </p>
                  </div>
                </div>

                <a
                  href={paymentUrl}
                  onClick={trackSpokenEnglishInitiateCheckout}
                  className="mt-6 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-yellow-300 to-lime-400 px-6 py-5 text-center text-lg font-black text-slate-950 shadow-xl shadow-lime-300/30 transition hover:-translate-y-0.5 hover:shadow-2xl active:translate-y-0 sm:text-xl"
                >
                  Get 1-Year Access for ₹1,199
                </a>

                <p className="mt-4 text-center text-xs font-bold leading-relaxed text-slate-500 sm:text-sm">
                  Secure payment via UPI, GPay, PhonePe, Paytm, Debit Card or
                  Credit Card
                </p>

                <div className="mt-5 border-t border-purple-100 pt-5 text-center">
                  <p className="text-sm font-bold text-slate-600">
                    Not sure which level is right for you?
                  </p>

                  <a
                    href="https://wa.me/919047122250?text=Hi%20FluencyJet%2C%20I%20need%20help%20choosing%20the%20right%20Spoken%20English%20learning%20path."
                    className="mt-2 inline-flex font-black text-purple-800 underline decoration-lime-400 decoration-2 underline-offset-4 transition hover:text-purple-950"
                  >
                    WhatsApp Support: 9047122250
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
