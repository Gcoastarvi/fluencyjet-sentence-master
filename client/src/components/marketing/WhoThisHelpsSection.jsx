function AudienceIcon({ type }) {
  const common = "h-7 w-7 stroke-current";

  switch (type) {
    case "tamil":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={common}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3.5 5.5A3.5 3.5 0 0 1 7 2h5a3.5 3.5 0 0 1 3.5 3.5V9A3.5 3.5 0 0 1 12 12.5H8.5L5 16v-4.2A3.5 3.5 0 0 1 3.5 9V5.5Z" />
          <path d="M13 13.5h4A3.5 3.5 0 0 1 20.5 17v.5A3.5 3.5 0 0 1 17 21h-1v2l-3-2h-1" />
          <path d="M7 6.5h5" />
          <path d="M7 9h3" />
          <path d="M16 16.5h1.5" />
        </svg>
      );

    case "sentences":
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
          <rect x="3" y="4" width="7" height="6" rx="2" />
          <rect x="14" y="4" width="7" height="6" rx="2" />
          <rect x="8.5" y="14" width="7" height="6" rx="2" />
          <path d="M10 7h4" />
          <path d="m12.5 5.5 1.5 1.5-1.5 1.5" />
          <path d="M7 10v2.5h5" />
          <path d="M17 10v2.5h-5" />
        </svg>
      );

    case "students":
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
          <path d="m3 9 9-5 9 5-9 5-9-5Z" />
          <path d="M7 12.5V17c2.7 2.2 7.3 2.2 10 0v-4.5" />
          <path d="M21 9v6" />
          <path d="M21 15.5h.01" />
        </svg>
      );

    case "professionals":
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
          <rect x="3" y="7" width="18" height="13" rx="3" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
          <path d="M9.5 12v2h5v-2" />
        </svg>
      );

    case "business":
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
          <path d="M4 10v10h16V10" />
          <path d="M3 10 5 4h14l2 6" />
          <path d="M3 10a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2" />
          <path d="M8 20v-5h5v5" />
          <path d="m15 17 2-2 2 1" />
        </svg>
      );

    default:
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
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3 2" />
          <path d="M7 3.5 5 5.5" />
          <path d="M17 3.5 19 5.5" />
          <path d="M8 20.5h8" />
          <path d="m17.5 9 .7 1.5 1.7.2-1.2 1.2.3 1.7-1.5-.8-1.5.8.3-1.7-1.2-1.2 1.7-.2.7-1.5Z" />
        </svg>
      );
  }
}

const audienceCards = [
  {
    type: "tamil",
    label: "Tamil Learners",
    text: "Tamil speakers who want to speak English without fear",
    icon: "from-purple-950 via-purple-800 to-violet-700 text-lime-300",
    line: "from-lime-300 via-purple-500 to-violet-500",
    pill: "bg-lime-50 text-purple-800 border-lime-200",
    glow: "group-hover:shadow-purple-200/80",
  },
  {
    type: "sentences",
    label: "Sentence Building",
    text: "Learners who know words but struggle to make sentences",
    icon: "from-indigo-950 via-indigo-800 to-purple-700 text-cyan-200",
    line: "from-cyan-300 via-indigo-500 to-purple-500",
    pill: "bg-indigo-50 text-indigo-800 border-indigo-200",
    glow: "group-hover:shadow-indigo-200/80",
  },
  {
    type: "students",
    label: "Students",
    text: "Students preparing for interviews or career growth",
    icon: "from-sky-800 via-blue-800 to-purple-800 text-white",
    line: "from-sky-300 via-blue-500 to-purple-500",
    pill: "bg-sky-50 text-sky-800 border-sky-200",
    glow: "group-hover:shadow-sky-200/80",
  },
  {
    type: "professionals",
    label: "Professionals",
    text: "Working professionals who want better communication",
    icon: "from-slate-900 via-purple-900 to-indigo-700 text-lime-200",
    line: "from-slate-400 via-purple-500 to-indigo-500",
    pill: "bg-slate-50 text-slate-800 border-slate-200",
    glow: "group-hover:shadow-slate-200/80",
  },
  {
    type: "business",
    label: "Business Owners",
    text: "Business owners who want to speak with more confidence",
    icon: "from-emerald-800 via-purple-900 to-purple-700 text-lime-200",
    line: "from-emerald-300 via-purple-500 to-violet-500",
    pill: "bg-emerald-50 text-emerald-800 border-emerald-200",
    glow: "group-hover:shadow-emerald-200/80",
  },
  {
    type: "daily",
    label: "Daily Practice",
    text: "Anyone who can practice English for 10–15 minutes daily",
    icon: "from-amber-600 via-orange-700 to-purple-900 text-yellow-100",
    line: "from-yellow-300 via-orange-500 to-purple-500",
    pill: "bg-amber-50 text-amber-800 border-amber-200",
    glow: "group-hover:shadow-amber-200/80",
  },
];

function AudienceCard({ card }) {
  return (
    <div
      className={`group relative h-full overflow-hidden rounded-[2rem] border border-purple-100 bg-white shadow-lg shadow-purple-100/60 transition duration-300 hover:-translate-y-1 hover:shadow-2xl ${card.glow}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${card.line}`}
      />

      <div className="relative flex h-full flex-col bg-gradient-to-b from-white via-white to-purple-50/40 p-6 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="relative">
            <div
              className={`absolute inset-1 rounded-2xl bg-gradient-to-br opacity-30 blur-xl ${card.icon}`}
            />

            <div
              className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-xl transition duration-300 group-hover:scale-105 ${card.icon}`}
            >
              <AudienceIcon type={card.type} />
            </div>
          </div>

          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] shadow-sm ${card.pill}`}
          >
            {card.label}
          </span>
        </div>

        <p className="text-xl font-black leading-snug text-slate-950 sm:text-[1.35rem]">
          {card.text}
        </p>

        <div className="mt-auto pt-6">
          <div className="h-1 w-12 rounded-full bg-gradient-to-r from-purple-700 to-lime-300 transition-all duration-300 group-hover:w-20" />
        </div>
      </div>
    </div>
  );
}

export default function WhoThisHelpsSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-white to-purple-50/50">
      <div className="pointer-events-none absolute -left-28 top-24 h-72 w-72 rounded-full bg-lime-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-10 h-80 w-80 rounded-full bg-purple-300/20 blur-3xl" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-14 pb-28 sm:px-6 sm:py-16 sm:pb-16 lg:px-8">
        <div className="mx-auto mb-11 max-w-4xl text-center">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.24em] text-purple-700">
            Who This Helps
          </p>

          <h2 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
            Who Is This Spoken English Gym For?
          </h2>

          <div className="mx-auto mt-6 h-1.5 w-24 rounded-full bg-gradient-to-r from-lime-300 via-purple-500 to-lime-300" />
        </div>

        <div className="mx-auto grid max-w-7xl items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {audienceCards.map((card) => (
            <AudienceCard key={card.label} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}
