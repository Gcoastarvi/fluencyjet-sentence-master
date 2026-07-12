function MentorIcon({ type }) {
  const common =
    "h-6 w-6 stroke-current";

  if (type === "record") {
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
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4v2a4 4 0 0 0 4 4" />
        <path d="M17 6h3v2a4 4 0 0 1-4 4" />
        <path d="m12 6.5.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3.9-1.8Z" />
      </svg>
    );
  }

  if (type === "students") {
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
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <circle cx="17.5" cy="9" r="2.5" />
        <path d="M15.5 15.5a4.5 4.5 0 0 1 5 4.5" />
      </svg>
    );
  }

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
      <path d="M9 3.5a3 3 0 0 0-3 3v2a3.5 3.5 0 0 0-2 3.2A3.3 3.3 0 0 0 6 14.8V17a3 3 0 0 0 3 3" />
      <path d="M15 3.5a3 3 0 0 1 3 3v2a3.5 3.5 0 0 1 2 3.2 3.3 3.3 0 0 1-2 3.1V17a3 3 0 0 1-3 3" />
      <path d="M9 3.5v17" />
      <path d="M15 3.5v17" />
      <path d="M9 8h2" />
      <path d="M13 12h2" />
      <path d="M9 16h2" />
    </svg>
  );
}

const credentials = [
  {
    type: "record",
    label: "Guinness World Record",
    text: "Memory achievement",
    icon: "from-amber-500 via-orange-600 to-purple-900 text-yellow-100",
  },
  {
    type: "students",
    label: "35,000+ Students",
    text: "Trained across programs",
    icon: "from-indigo-800 via-purple-800 to-violet-700 text-lime-200",
  },
  {
    type: "coach",
    label: "Memory & Language Coach",
    text: "Practical learning systems",
    icon: "from-emerald-800 via-teal-700 to-purple-900 text-lime-200",
  },
];

function CredentialCard({ item }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-purple-100 bg-white p-4 shadow-md shadow-purple-100/60">
      <div
        className={`flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ${item.icon}`}
      >
        <MentorIcon type={item.type} />
      </div>

      <div>
        <p className="text-sm font-black leading-tight text-slate-950 sm:text-base">
          {item.label}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {item.text}
        </p>
      </div>
    </div>
  );
}

export default function MentorSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-purple-50/60">
      <div className="pointer-events-none absolute -left-28 top-28 h-80 w-80 rounded-full bg-lime-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-10 h-96 w-96 rounded-full bg-purple-300/20 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-14 pb-28 sm:px-6 sm:py-16 sm:pb-16 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14 lg:px-8">
        <div className="relative mx-auto w-full max-w-[500px]">
          <div className="absolute -inset-3 rounded-[2.5rem] bg-gradient-to-br from-lime-300/50 via-purple-500/40 to-purple-950/70 blur-xl" />

          <div className="relative rounded-[2.4rem] bg-gradient-to-br from-lime-300 via-purple-500 to-purple-950 p-[2px] shadow-2xl shadow-purple-200">
            <div className="rounded-[2.3rem] bg-gradient-to-br from-purple-950 via-purple-900 to-slate-950 p-4 sm:p-5">
              <div className="relative overflow-hidden rounded-[1.9rem] bg-slate-950">
                <img
                  src="/coach.jpg"
                  alt="Aravind Pasupathy, founder of FluencyJet"
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/5] w-full object-cover object-top"
                />

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent px-6 pb-6 pt-24 text-white">
                  <p className="text-3xl font-black leading-tight">
                    Aravind Pasupathy
                  </p>

                  <p className="mt-2 text-base font-black text-lime-300 sm:text-lg">
                    Founder of FluencyJet
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute left-5 top-5 rounded-full border border-yellow-200/60 bg-slate-950/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-yellow-200 shadow-xl backdrop-blur">
            Guinness World Record Holder
          </div>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-purple-700">
            Meet Your Mentor
          </p>

          <h2 className="mt-4 text-3xl font-black leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
            Learn From A Trainer Who Understands Tamil Learners
          </h2>

          <p className="mt-5 text-lg font-bold leading-relaxed text-purple-800 sm:text-xl">
            Memory coach, English trainer, and founder of FluencyJet.
          </p>

          <div className="mt-7 rounded-[1.75rem] bg-gradient-to-r from-lime-300 via-lime-200 to-purple-200 p-[2px] shadow-lg shadow-purple-100">
            <div className="rounded-[1.65rem] bg-white px-6 py-6">
              <p className="text-xl font-black leading-relaxed text-slate-950 sm:text-2xl">
                “Many Tamil learners don’t need more passive English videos.
                They need guided sentence-making practice.”
              </p>
            </div>
          </div>

          <div className="mt-7 space-y-5 text-base leading-relaxed text-slate-700 sm:text-lg">
            <p>
              Hi, I’m Aravind Pasupathy, founder of FluencyJet. I have trained
              thousands of learners using memory techniques, language learning
              systems, and practical English training methods.
            </p>

            <p>
              I created the Spoken English Gym because many Tamil learners
              don’t fail due to lack of interest. They struggle because they
              don’t get enough guided sentence-making practice.
            </p>

            <p>
              Sentence Master is designed to help you practise English step by
              step—with simple grammar, useful speaking topics, and daily
              exercises that train your sentence formation.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {credentials.map((item) => (
              <CredentialCard key={item.label} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
