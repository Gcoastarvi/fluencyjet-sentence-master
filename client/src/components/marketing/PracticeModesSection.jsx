function ModeIcon({ type }) {
  const common =
    "h-6 w-6 stroke-current";

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
        <rect x="3" y="5" width="7" height="5" rx="1.5" />
        <rect x="14" y="14" width="7" height="5" rx="1.5" />
        <path d="M10 7.5h7a3 3 0 0 1 3 3" />
        <path d="m17 8 3 2.5-3 2.5" />
        <path d="M14 16.5H7a3 3 0 0 1-3-3" />
        <path d="m7 14-3-2.5L7 9" />
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
      <path d="M9 8.5c1.6-1 4.4-1 6 0" />
    </svg>
  );
}

const modes = [
  {
    type: "reorder",
    number: "01",
    title: "Reorder Practice",
    text: "Arrange the words in the correct order and train your sentence structure.",
    mediaSrc: "/practice-modes/reorder.mp4",
    icon: "from-purple-950 via-purple-800 to-violet-700 text-lime-300",
    line: "from-lime-300 via-purple-500 to-violet-500",
    pill: "border-purple-200 bg-purple-50 text-purple-800",
  },
  {
    type: "typing",
    number: "02",
    title: "Typing Practice",
    text: "See the Tamil meaning and type the correct English sentence yourself.",
    mediaSrc: "/practice-modes/typing.mp4",
    icon: "from-orange-700 via-amber-600 to-purple-900 text-yellow-100",
    line: "from-yellow-300 via-orange-500 to-purple-500",
    pill: "border-orange-200 bg-orange-50 text-orange-800",
  },
  {
    type: "voice",
    number: "03",
    title: "Voice Practice",
    text: "Speak the sentence aloud and build speaking confidence.",
    mediaSrc: "/practice-modes/voice.mp4",
    icon: "from-emerald-800 via-teal-700 to-purple-900 text-lime-200",
    line: "from-lime-300 via-emerald-500 to-purple-500",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    type: "dictation",
    number: "04",
    title: "Dictation Practice",
    text: "Listen carefully, understand the sentence, and practice English through listening.",
    mediaSrc: "/practice-modes/dictation.mp4",
    icon: "from-sky-800 via-blue-700 to-purple-900 text-cyan-100",
    line: "from-cyan-300 via-sky-500 to-purple-500",
    pill: "border-sky-200 bg-sky-50 text-sky-800",
  },
];

function PracticeModeCard({ mode }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-white shadow-2xl shadow-black/25 transition duration-300 hover:-translate-y-1">
      <div
        className={`h-1.5 flex-none bg-gradient-to-r ${mode.line}`}
      />

      <div className="flex items-center justify-center bg-gradient-to-br from-purple-950 via-[#27064b] to-slate-950 p-4 sm:p-6">
        <div className="relative mx-auto w-full max-w-[285px]">
          <div className="absolute inset-4 rounded-[2.25rem] bg-purple-500/25 blur-2xl" />

          <div className="relative overflow-hidden rounded-[2rem] border-[9px] border-slate-900 bg-slate-950 shadow-2xl">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="aspect-[9/16] w-full bg-slate-950 object-cover"
              aria-label={`${mode.title} demonstration`}
            >
              <source src={mode.mediaSrc} type="video/mp4" />
              Your browser does not support this video.
            </video>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col rounded-b-[2rem] bg-white p-6 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ${mode.icon}`}
          >
            <ModeIcon type={mode.type} />
          </div>

          <span
            className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${mode.pill}`}
          >
            Mode {mode.number}
          </span>
        </div>

        <h3 className="text-2xl font-black text-slate-950">
          {mode.title}
        </h3>

        <p className="mt-3 text-base leading-relaxed text-slate-700 sm:text-lg">
          {mode.text}
        </p>

        <div className="mt-auto pt-6">
          <div className="h-1 w-12 rounded-full bg-gradient-to-r from-purple-700 to-lime-300 transition-all duration-300 group-hover:w-20" />
        </div>
      </div>
    </article>
  );
}

export default function PracticeModesSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#020617] via-[#05071b] to-[#020617] text-white">
      <div className="pointer-events-none absolute -left-32 top-28 h-96 w-96 rounded-full bg-purple-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-20 h-96 w-96 rounded-full bg-lime-300/10 blur-3xl" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-14 pb-28 sm:px-6 sm:py-16 sm:pb-16 lg:px-8">
        <div className="mx-auto mb-11 max-w-4xl text-center">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.24em] text-lime-300">
            Practice Modes
          </p>

          <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
            See How The Spoken English Gym Works
          </h2>

          <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-white/70 sm:text-xl">
            This is not passive learning. You actively build, type, speak, and
            listen to English sentences.
          </p>

          <div className="mx-auto mt-6 h-1.5 w-24 rounded-full bg-gradient-to-r from-lime-300 via-purple-500 to-lime-300" />
        </div>

        <div className="mx-auto grid max-w-6xl items-stretch gap-7 lg:grid-cols-2">
          {modes.map((mode) => (
            <PracticeModeCard key={mode.type} mode={mode} />
          ))}
        </div>
      </div>
    </section>
  );
}
