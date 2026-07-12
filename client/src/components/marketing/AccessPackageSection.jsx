function AccessIcon({ type, className = "h-7 w-7" }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    className,
    stroke: "currentColor",
    strokeWidth: "2.1",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  switch (type) {
    case "app":
      return (
        <svg {...commonProps}>
          <rect x="5" y="2.5" width="14" height="19" rx="3" />
          <path d="M9 6h6" />
          <path d="M8 9h8v7H8z" />
          <path d="M11 18.5h2" />
        </svg>
      );

    case "lessons":
      return (
        <svg {...commonProps}>
          <rect x="4" y="3.5" width="14" height="17" rx="2.5" />
          <path d="M8 8h6" />
          <path d="M8 12h6" />
          <path d="M8 16h3" />
          <path d="M18 7h2a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H8" />
          <path d="m14 16 1.5 1.5 3-3.5" />
        </svg>
      );

    case "reorder":
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="7" height="5" rx="1.5" />
          <rect x="14" y="14" width="7" height="5" rx="1.5" />
          <path d="M10 7.5h7a3 3 0 0 1 3 3" />
          <path d="m17 8 3 2.5-3 2.5" />
          <path d="M14 16.5H7a3 3 0 0 1-3-3" />
          <path d="m7 14-3-2.5L7 9" />
        </svg>
      );

    case "typing":
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M7 9h.01M11 9h.01M15 9h.01M18 9h.01" />
          <path d="M7 13h.01M11 13h.01M15 13h.01" />
          <path d="M8 16h8" />
        </svg>
      );

    case "voice":
      return (
        <svg {...commonProps}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
          <path d="M12 17.5V21" />
          <path d="M9 21h6" />
        </svg>
      );

    case "dictation":
      return (
        <svg {...commonProps}>
          <path d="M4 13V9a8 8 0 0 1 16 0v4" />
          <path d="M4 12h3v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 1-2Z" />
          <path d="M20 12h-3v7h2a2 2 0 0 0 2-2v-3a2 2 0 0 0-1-2Z" />
          <path d="M12 19h3" />
          <path d="M9 8.5c1.6-1 4.4-1 6 0" />
        </svg>
      );

    case "path":
      return (
        <svg {...commonProps}>
          <circle cx="5" cy="18" r="2" />
          <circle cx="12" cy="11" r="2" />
          <circle cx="19" cy="5" r="2" />
          <path d="m6.5 16.5 4-4" />
          <path d="m13.5 9.5 4-3.5" />
          <path d="M5 4v5" />
          <path d="m3 7 2 2 2-2" />
        </svg>
      );

    case "progress":
      return (
        <svg {...commonProps}>
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
          <path d="M7 6H4v2a4 4 0 0 0 4 4" />
          <path d="M17 6h3v2a4 4 0 0 1-4 4" />
          <path d="m12 7 .8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2L12 7Z" />
        </svg>
      );

    case "calendar":
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M3 10h18" />
          <path d="m8 15 2 2 5-5" />
        </svg>
      );

    case "levels":
      return (
        <svg {...commonProps}>
          <path d="M5 20h4v-5H5v5Z" />
          <path d="M10 20h4V10h-4v10Z" />
          <path d="M15 20h4V5h-4v15Z" />
          <path d="m6 11 5-5 3 3 5-5" />
        </svg>
      );

    default:
      return null;
  }
}

const summaryItems = [
  {
    type: "calendar",
    value: "1 Year",
    label: "Complete Access",
    icon: "from-purple-950 to-purple-700 text-lime-300",
  },
  {
    type: "lessons",
    value: "120",
    label: "Structured Lessons",
    icon: "from-indigo-900 to-purple-700 text-cyan-200",
  },
  {
    type: "typing",
    value: "4",
    label: "Practice Modes",
    icon: "from-emerald-800 to-purple-800 text-lime-200",
  },
  {
    type: "levels",
    value: "2",
    label: "Learning Levels",
    icon: "from-amber-600 to-purple-900 text-yellow-100",
  },
];

const groups = [
  {
    eyebrow: "Core Platform",
    title: "Your Complete Learning System",
    description:
      "Get the structured app access and lessons needed for daily spoken English development.",
    cards: [
      {
        type: "app",
        label: "App Access",
        title: "Sentence Master App Access",
        text: "1-year access to FluencyJet Sentence Master for daily spoken English practice.",
        icon: "from-purple-950 via-purple-800 to-violet-700 text-lime-300",
        line: "from-lime-300 via-purple-500 to-violet-500",
        pill: "border-lime-200 bg-lime-50 text-purple-800",
      },
      {
        type: "lessons",
        label: "Structured Learning",
        title: "120 Structured Spoken English Lessons",
        text: "Lessons designed to connect grammar, speaking topics, and sentence practice.",
        icon: "from-indigo-950 via-indigo-800 to-purple-700 text-cyan-200",
        line: "from-cyan-300 via-indigo-500 to-purple-500",
        pill: "border-indigo-200 bg-indigo-50 text-indigo-800",
      },
    ],
  },
  {
    eyebrow: "Active Practice",
    title: "Four Ways To Train Your English",
    description:
      "Each practice mode strengthens a different part of sentence formation, speaking, and listening.",
    cards: [
      {
        type: "reorder",
        label: "Sentence Order",
        title: "Reorder Practice Mode",
        text: "Train your brain to arrange English words in the correct order.",
        icon: "from-violet-950 via-purple-800 to-fuchsia-700 text-lime-200",
        line: "from-violet-400 via-purple-500 to-fuchsia-400",
        pill: "border-violet-200 bg-violet-50 text-violet-800",
      },
      {
        type: "typing",
        label: "Sentence Building",
        title: "Typing Practice Mode",
        text: "Build English sentences from Tamil meaning and improve sentence formation.",
        icon: "from-orange-700 via-amber-600 to-purple-900 text-yellow-100",
        line: "from-yellow-300 via-orange-500 to-purple-500",
        pill: "border-orange-200 bg-orange-50 text-orange-800",
      },
      {
        type: "voice",
        label: "Speaking Confidence",
        title: "Voice Practice Mode",
        text: "Practice saying sentences aloud and reduce speaking fear.",
        icon: "from-emerald-800 via-teal-700 to-purple-900 text-lime-200",
        line: "from-lime-300 via-emerald-500 to-purple-500",
        pill: "border-emerald-200 bg-emerald-50 text-emerald-800",
      },
      {
        type: "dictation",
        label: "Listening Practice",
        title: "Dictation Practice Mode",
        text: "Improve listening, sentence understanding, and English recall.",
        icon: "from-sky-800 via-blue-700 to-purple-900 text-cyan-100",
        line: "from-cyan-300 via-sky-500 to-purple-500",
        pill: "border-sky-200 bg-sky-50 text-sky-800",
      },
    ],
  },
  {
    eyebrow: "Progress System",
    title: "Follow Your Path And Stay Consistent",
    description:
      "Move from your current level step by step while tracking your daily practice progress.",
    cards: [
      {
        type: "path",
        label: "Learning Path",
        title: "Beginner + Intermediate Learning Path",
        text: "Start from your current level and move step by step.",
        icon: "from-indigo-950 via-purple-800 to-violet-700 text-lime-200",
        line: "from-indigo-400 via-purple-500 to-lime-300",
        pill: "border-indigo-200 bg-indigo-50 text-indigo-800",
      },
      {
        type: "progress",
        label: "Motivation System",
        title: "XP, Streaks, and Progress Tracking",
        text: "Build a daily practice habit with points, streaks, and progress.",
        icon: "from-amber-600 via-orange-700 to-purple-900 text-yellow-100",
        line: "from-yellow-300 via-orange-500 to-purple-500",
        pill: "border-amber-200 bg-amber-50 text-amber-800",
      },
    ],
  },
];

function SummaryItem({ item }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-purple-100 bg-white px-4 py-4 shadow-md shadow-purple-100/60 sm:px-5">
      <div
        className={`flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ${item.icon}`}
      >
        <AccessIcon type={item.type} className="h-6 w-6" />
      </div>

      <div>
        <p className="text-xl font-black leading-none text-slate-950">
          {item.value}
        </p>
        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-600">
          {item.label}
        </p>
      </div>
    </div>
  );
}

function AccessCard({ card }) {
  return (
    <div className="group relative h-full overflow-hidden rounded-[2rem] border border-purple-100 bg-white shadow-lg shadow-purple-100/60 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-200/70">
      <div
        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${card.line}`}
      />

      <div className="flex h-full flex-col bg-gradient-to-b from-white via-white to-purple-50/40 p-6 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="relative">
            <div
              className={`absolute inset-1 rounded-2xl bg-gradient-to-br opacity-30 blur-xl ${card.icon}`}
            />

            <div
              className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-xl transition duration-300 group-hover:scale-105 ${card.icon}`}
            >
              <AccessIcon type={card.type} />
            </div>
          </div>

          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.13em] shadow-sm ${card.pill}`}
          >
            {card.label}
          </span>
        </div>

        <h4 className="text-xl font-black leading-snug text-slate-950 sm:text-2xl">
          {card.title}
        </h4>

        <p className="mt-4 text-base leading-relaxed text-slate-700">
          {card.text}
        </p>

        <div className="mt-auto pt-6">
          <div className="h-1 w-12 rounded-full bg-gradient-to-r from-purple-700 to-lime-300 transition-all duration-300 group-hover:w-20" />
        </div>
      </div>
    </div>
  );
}

function AccessGroup({ group }) {
  return (
    <div className="mt-12 first:mt-0">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-700">
            {group.eyebrow}
          </p>

          <h3 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
            {group.title}
          </h3>
        </div>

        <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-right">
          {group.description}
        </p>
      </div>

      <div className="grid items-stretch gap-5 sm:grid-cols-2">
        {group.cards.map((card) => (
          <AccessCard key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}

export default function AccessPackageSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-purple-50/60">
      <div className="pointer-events-none absolute -left-28 top-40 h-80 w-80 rounded-full bg-lime-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-28 h-96 w-96 rounded-full bg-purple-300/20 blur-3xl" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-14 pb-28 sm:px-6 sm:py-16 sm:pb-16 lg:px-8">
        <div className="mx-auto mb-10 max-w-4xl text-center">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.24em] text-purple-700">
            Your Access
          </p>

          <h2 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
            Here’s What You Get With 1-Year Access
          </h2>

          <div className="mx-auto mt-6 h-1.5 w-24 rounded-full bg-gradient-to-r from-lime-300 via-purple-500 to-lime-300" />
        </div>

        <div className="mx-auto mb-12 grid max-w-5xl grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {summaryItems.map((item) => (
            <SummaryItem key={item.label} item={item} />
          ))}
        </div>

        <div className="mx-auto max-w-6xl rounded-[2.5rem] border border-purple-100 bg-white/70 p-4 shadow-2xl shadow-purple-100/50 backdrop-blur sm:p-7 lg:p-9">
          {groups.map((group) => (
            <AccessGroup key={group.eyebrow} group={group} />
          ))}
        </div>
      </div>
    </section>
  );
}
