function SystemIcon({ type }) {
  const common =
    "h-8 w-8 stroke-current";

  if (type === "grammar") {
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
        <path d="M4.5 5A2.5 2.5 0 0 1 7 2.5h7a3 3 0 0 1 3 3V20H8a3.5 3.5 0 0 0-3.5 3V5Z" />
        <path d="M17 6h2a2 2 0 0 1 2 2v12h-4" />
        <path d="M8 8h5" />
        <path d="M8 12h4" />
        <path d="m14 15 1.5 1.5 3-3.5" />
      </svg>
    );
  }

  if (type === "speaking") {
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
        <path d="M3.5 5.5A3.5 3.5 0 0 1 7 2h7a3.5 3.5 0 0 1 3.5 3.5V10a3.5 3.5 0 0 1-3.5 3.5H10L5 18v-5A3.5 3.5 0 0 1 3.5 10V5.5Z" />
        <path d="M14 15h3a3.5 3.5 0 0 1 3.5 3.5v.5A3 3 0 0 1 17.5 22H16v2l-3-2h-1" />
        <path d="M8 7h5" />
        <path d="M8 10h3" />
      </svg>
    );
  }

  if (type === "practice") {
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
        <path d="M8.5 5c1-1 2.2-1.5 3.5-1.5S14.5 4 15.5 5" />
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
      <path d="M4 19 9 14l4 3 7-9" />
      <path d="M15 8h5v5" />
      <path d="M4 5v14h16" />
    </svg>
  );
}

const lessonSteps = [
  {
    number: "01",
    type: "grammar",
    eyebrow: "Learn",
    title: "Simple Grammar Point",
    description:
      "Understand one practical English structure without confusing grammar overload.",
    examples: [
      "Be Verbs",
      "Present Simple",
      "Questions",
      "Can / Should / Will",
    ],
    icon:
      "from-indigo-950 via-purple-800 to-violet-700 text-lime-300",
    line:
      "from-lime-300 via-purple-500 to-violet-500",
    badge:
      "border-indigo-200 bg-indigo-50 text-indigo-800",
  },
  {
    number: "02",
    type: "speaking",
    eyebrow: "Apply",
    title: "Real-Life Speaking Topic",
    description:
      "Use the grammar point in a useful situation where you actually need to speak.",
    examples: [
      "Self-Introduction",
      "Daily Routine",
      "Workplace English",
      "Interview Answers",
    ],
    icon:
      "from-fuchsia-950 via-purple-800 to-violet-700 text-cyan-200",
    line:
      "from-cyan-300 via-fuchsia-500 to-purple-500",
    badge:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  },
  {
    number: "03",
    type: "practice",
    eyebrow: "Train",
    title: "Active Gym Practice",
    description:
      "Practice the same sentence pattern repeatedly until sentence-making becomes faster.",
    examples: [
      "Reorder Practice",
      "Typing Practice",
      "Voice Practice",
      "Dictation Practice",
    ],
    icon:
      "from-emerald-900 via-purple-900 to-violet-700 text-lime-200",
    line:
      "from-lime-300 via-emerald-500 to-purple-500",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
];

function FlowArrow() {
  return (
    <>
      <div className="flex justify-center py-3 lg:hidden">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-lime-300/40 bg-purple-950 text-lime-300 shadow-lg shadow-purple-950/30">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5 stroke-current"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 4v16" />
            <path d="m6 14 6 6 6-6" />
          </svg>
        </div>
      </div>

      <div className="hidden items-center justify-center lg:flex">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-lime-300/40 bg-purple-950 text-lime-300 shadow-lg shadow-purple-950/30">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5 stroke-current"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12h16" />
            <path d="m14 6 6 6-6 6" />
          </svg>
        </div>
      </div>
    </>
  );
}

function LessonStepCard({ step }) {
  return (
    <article className="group relative h-full overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur transition duration-300 hover:-translate-y-1 hover:bg-white/[0.13]">
      <div
        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${step.line}`}
      />

      <div className="flex h-full flex-col p-6 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="relative">
            <div
              className={`absolute inset-1 rounded-2xl bg-gradient-to-br opacity-40 blur-xl ${step.icon}`}
            />

            <div
              className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-xl transition duration-300 group-hover:scale-105 ${step.icon}`}
            >
              <SystemIcon type={step.type} />
            </div>
          </div>

          <span
            className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em] shadow-sm ${step.badge}`}
          >
            {step.number}
          </span>
        </div>

        <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-300">
          {step.eyebrow}
        </p>

        <h3 className="mt-2 text-2xl font-black leading-tight text-white">
          {step.title}
        </h3>

        <p className="mt-4 text-base leading-relaxed text-white/70">
          {step.description}
        </p>

        <div className="mt-6 flex-1 rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4">
          <div className="grid gap-3">
            {step.examples.map((example) => (
              <div
                key={example}
                className="flex items-center gap-3 text-sm font-bold text-white/90"
              >
                <span
                  className={`h-2.5 w-2.5 flex-none rounded-full bg-gradient-to-br ${step.line}`}
                />
                <span>{example}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-5 text-sm font-bold text-lime-200/80">
          And many more across 120 structured lessons
        </p>
      </div>
    </article>
  );
}

function ExampleStep({
  number,
  label,
  value,
  type,
  last = false,
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-950 via-purple-800 to-violet-700 text-lime-300 shadow-xl shadow-purple-200">
        {type ? (
          <SystemIcon type={type} />
        ) : (
          <span className="text-lg font-black">
            {number}
          </span>
        )}
      </div>

      <p className="mt-4 text-xs font-black uppercase tracking-[0.17em] text-purple-700">
        {label}
      </p>

      <p className="mt-2 text-lg font-black leading-snug text-slate-950 sm:text-xl">
        {value}
      </p>

      {!last && (
        <>
          <div className="my-5 flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-700 sm:hidden">
            ↓
          </div>

          <div className="absolute left-[calc(50%+2.5rem)] top-7 hidden h-[2px] w-[calc(100%-5rem)] bg-gradient-to-r from-purple-400 to-lime-300 sm:block" />
        </>
      )}
    </div>
  );
}

export default function LessonSystemSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#33065f] via-[#19052f] to-[#020617] text-white">
      <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-10 h-96 w-96 rounded-full bg-lime-300/10 blur-3xl" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-14 pb-28 sm:px-6 sm:py-16 sm:pb-16 lg:px-8">
        <div className="mx-auto mb-11 max-w-4xl text-center">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.24em] text-lime-300">
            Lesson System
          </p>

          <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
            Every Lesson Connects 3 Things
          </h2>

          <p className="mx-auto mt-4 max-w-3xl text-lg font-bold leading-relaxed text-white/75 sm:text-xl">
            Simple Grammar + Real-Life Speaking Topic + Active Gym Practice
          </p>

          <div className="mx-auto mt-6 h-1.5 w-24 rounded-full bg-gradient-to-r from-lime-300 via-purple-400 to-lime-300" />
        </div>

        <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch lg:gap-5">
          <LessonStepCard step={lessonSteps[0]} />

          <FlowArrow />

          <LessonStepCard step={lessonSteps[1]} />

          <FlowArrow />

          <LessonStepCard step={lessonSteps[2]} />
        </div>

        <div className="mx-auto mt-12 max-w-6xl overflow-hidden rounded-[2.25rem] bg-gradient-to-r from-lime-300 via-purple-400 to-lime-300 p-[2px] shadow-2xl shadow-purple-950/30">
          <div className="rounded-[2.15rem] bg-white px-5 py-8 text-slate-950 sm:px-8 sm:py-10">
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-purple-700">
                Real Lesson Example
              </p>

              <h3 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
                Talk About Your Daily Routine
              </h3>

              <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                See how one lesson moves from understanding to real spoken English practice.
              </p>
            </div>

            <div className="mt-9 flex flex-col gap-1 sm:flex-row sm:items-start">
              <ExampleStep
                number="1"
                label="Grammar Point"
                value="Present Simple"
                type="grammar"
              />

              <ExampleStep
                number="2"
                label="Speaking Topic"
                value="Describe Your Daily Routine"
                type="speaking"
              />

              <ExampleStep
                number="3"
                label="Gym Practice"
                value="Reorder, Typing, Voice & Dictation"
                type="practice"
              />

              <ExampleStep
                number="4"
                label="Result"
                value="Make Sentences Faster"
                type="result"
                last
              />
            </div>
          </div>
        </div>

        <div className="mx-auto mt-9 max-w-5xl rounded-[2rem] bg-gradient-to-r from-lime-300 via-lime-200 to-purple-300 p-[2px] shadow-xl shadow-purple-950/30">
          <div className="flex flex-col items-center gap-5 rounded-[1.9rem] bg-slate-950 px-6 py-7 text-center sm:flex-row sm:px-8 sm:py-8 sm:text-left">
            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-lime-300 to-lime-400 text-purple-950 shadow-xl shadow-lime-500/20">
              <SystemIcon type="result" />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-300">
                The Result
              </p>

              <p className="mt-2 text-2xl font-black leading-snug text-white sm:text-3xl">
                Understand it. Use it. Practice it. Speak it faster.
              </p>

              <p className="mt-3 text-base leading-relaxed text-white/65 sm:text-lg">
                Together, these three parts help you build sentences with greater speed, accuracy, and confidence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
