function ProblemIcon({ type }) {
  const common =
    "h-7 w-7 stroke-current";

  switch (type) {
    case "grammar":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={common}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4Z" />
          <path d="M17 7h2a2 2 0 0 1 2 2v11h-4" />
          <path d="M8 9h5" />
          <path d="M8 13h4" />
          <path d="M18 13v3" />
          <path d="M18 19h.01" />
        </svg>
      );

    case "sentence":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={common}
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

    case "words":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={common}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-6l-5 5v-5.5A4 4 0 0 1 4 12V6Z" />
          <path d="M8 9h.01" />
          <path d="M12 9h.01" />
          <path d="M16 9h.01" />
        </svg>
      );

    case "people":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={common}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="3" />
          <path d="M2.5 20a5.5 5.5 0 0 1 11 0" />
          <circle cx="17.5" cy="9" r="2.5" />
          <path d="M15 15.5a4.5 4.5 0 0 1 6 4.5" />
        </svg>
      );

    case "reply":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={common}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="5" />
          <path d="M8 5v3l2 1.5" />
          <path d="M11 14h6a4 4 0 0 1 4 4v.5a3.5 3.5 0 0 1-3.5 3.5H16v2l-3-2h-2" />
        </svg>
      );

    case "link":
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
          <path d="M10 13a5 5 0 0 0 7.1.1l2-2A5 5 0 0 0 12 4l-1.1 1.1" />
          <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" />
        </svg>
      );

    default:
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
}

const problemStyles = {
  grammar: {
    icon: "from-amber-500 to-orange-700",
    line: "from-amber-400 to-orange-500",
  },
  sentence: {
    icon: "from-rose-600 to-purple-900",
    line: "from-rose-400 to-purple-500",
  },
  words: {
    icon: "from-sky-600 to-purple-900",
    line: "from-sky-400 to-purple-500",
  },
  people: {
    icon: "from-fuchsia-700 to-purple-950",
    line: "from-fuchsia-400 to-purple-500",
  },
  reply: {
    icon: "from-indigo-600 to-purple-950",
    line: "from-indigo-400 to-purple-500",
  },
};

function ProblemCard({ type, children, wide = false }) {
  const style = problemStyles[type];

  return (
    <div
      className={`group relative h-full overflow-hidden rounded-[1.75rem] border border-purple-100 bg-white shadow-lg shadow-purple-100/60 transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.line}`}
      />

      <div className="flex h-full items-center gap-4 px-5 py-5 sm:px-6 sm:py-6">
        <div
          className={`flex h-13 w-13 flex-none items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition duration-300 group-hover:scale-105 ${style.icon}`}
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

function DownArrow({ dark = false }) {
  return (
    <div
      className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-md ${
        dark
          ? "border-lime-300/40 bg-purple-950 text-lime-300"
          : "border-purple-200 bg-white text-purple-700"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5 stroke-current"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 4v16" />
        <path d="m6 14 6 6 6-6" />
      </svg>
    </div>
  );
}

export default function ProblemSolutionSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-purple-50/70">
      <div className="pointer-events-none absolute -left-24 top-28 h-72 w-72 rounded-full bg-lime-200/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-20 h-80 w-80 rounded-full bg-purple-300/20 blur-3xl" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-14 pb-28 sm:px-6 sm:py-16 sm:pb-16 lg:px-8">
        <div className="mx-auto mb-10 max-w-4xl text-center">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.22em] text-purple-700">
            The Real Problem
          </p>

          <h2 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
            Why Many Tamil Learners Struggle To Speak English
          </h2>

          <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-slate-700 sm:text-xl">
            Many learners know English words. Many learners have studied grammar.
            But when they need to speak, they still feel fear, hesitation, and confusion.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 sm:gap-5">
          <ProblemCard type="grammar">
            You may be afraid of grammar mistakes.
          </ProblemCard>

          <ProblemCard type="sentence">
            You may worry about saying wrong sentences.
          </ProblemCard>

          <ProblemCard type="words">
            You may not get the right words at the right time.
          </ProblemCard>

          <ProblemCard type="people">
            You may feel nervous that people will laugh.
          </ProblemCard>

          <ProblemCard type="reply" wide>
            You may understand English, but struggle to reply quickly.
          </ProblemCard>
        </div>

        <div className="mt-7 flex justify-center">
          <DownArrow />
        </div>

        <div className="mx-auto mt-7 max-w-5xl rounded-[2rem] bg-gradient-to-r from-lime-300 via-lime-200 to-purple-200 p-[2px] shadow-xl shadow-purple-100">
          <div className="flex flex-col items-center gap-5 rounded-[1.9rem] bg-white px-6 py-7 text-center sm:flex-row sm:px-8 sm:py-8 sm:text-left">
            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-purple-950 via-purple-800 to-purple-950 text-lime-300 shadow-xl shadow-purple-200">
              <ProblemIcon type="link" />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-700">
                The Missing Link
              </p>

              <p className="mt-2 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
                The missing link is daily spoken English practice.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-7 flex justify-center">
          <DownArrow dark />
        </div>

        <div className="mx-auto mt-7 max-w-5xl overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-lime-300/70 via-purple-500/50 to-purple-950 p-[2px] shadow-2xl shadow-purple-200">
          <div className="relative overflow-hidden rounded-[2.15rem] bg-gradient-to-br from-purple-950 via-purple-900 to-slate-950 px-6 py-9 text-white sm:px-10 sm:py-10">
            <div className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-lime-300/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-16 h-48 w-48 rounded-full bg-purple-400/25 blur-3xl" />

            <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
              <div className="flex h-20 w-20 flex-none items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-lime-300 to-lime-400 text-purple-950 shadow-xl shadow-lime-500/20">
                <ProblemIcon type="solution" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">
                  The Solution
                </p>

                <p className="mt-3 text-2xl font-black leading-snug text-white sm:text-3xl">
                  That is why FluencyJet Sentence Master gives you a Spoken English Gym — a place where you can practice sentences every day, from your current level, without pressure.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
