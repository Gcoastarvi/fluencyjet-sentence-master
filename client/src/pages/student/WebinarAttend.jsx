import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

function getNextWednesday() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  const daysUntil = day === 3 ? 7 : (3 - day + 7) % 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  return next;
}

function formatDate(date) {
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const OUTCOMES = [
  {
    icon: "💬",
    title: "Build sentences without translating",
    desc: "Learn to think directly in English — not Tamil-first.",
  },
  {
    icon: "🧠",
    title: "3 core patterns for daily conversation",
    desc: "Master the structures used in 80% of everyday English.",
  },
  {
    icon: "🎤",
    title: "Live practice with a real teacher",
    desc: "Speak, get corrected, and gain confidence in the session.",
  }, 
];

const STEPS = [
  {
    id: 1,
    label: "Free Preview",
    sublabel: "Lesson 1 & 2 — Done",
    state: "done",
  },
  {
    id: 2,
    label: "Live Class",
    sublabel: "Your next step",
    state: "current",
  },
];

export default function WebinarAttend() {
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from") || "";

  const webinarDate = useMemo(() => getNextWednesday(), []);
  const dateLabel = useMemo(() => formatDate(webinarDate), [webinarDate]);

  const lockedLesson = useMemo(() => {
    const match = from.match(/lesson_(\d+)/);
    return match ? Number(match[1]) : null;
  }, [from]);

  return (
    <div className="min-h-screen bg-white">

      {/* ── HERO ── */}
      <header className="bg-indigo-950 px-5 pt-10 pb-10 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-300">
          <svg
            className="h-3 w-3 fill-current"
            viewBox="0 0 12 12"
            aria-hidden="true"
          >
            <path d="M10.28 2.28L4.5 8.06 1.72 5.28a1 1 0 0 0-1.44 1.44l3.5 3.5a1 1 0 0 0 1.44 0l6.5-6.5a1 1 0 0 0-1.44-1.44z" />
          </svg>
          Lesson 1 Complete
        </span>

        <h1 className="mt-4 text-[1.85rem] font-black leading-tight tracking-tight text-white sm:text-4xl">
          Great work!{" "}
          <span className="text-amber-400">Your next step is the&nbsp;Live&nbsp;Webinar.</span>
        </h1>

        <p className="mt-3 text-base font-medium leading-relaxed text-indigo-200">
          You've completed the free preview. Join the live class to keep going
          and unlock the full course.
        </p>

        {lockedLesson && (
          <p className="mt-3 text-sm font-semibold text-indigo-400">
            Lesson {lockedLesson} and beyond are waiting for you there.
          </p>
        )}
      </header>

      {/* ── PROGRESS STEPS ── */}
      <section className="bg-slate-50 px-5 py-7">
        <p className="mb-5 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
          Your journey so far
        </p>

        <ol className="relative flex flex-col gap-0">
          {STEPS.map((step, i) => (
            <li key={step.id} className="flex items-start gap-4">
              {/* connector line */}
              <div className="flex flex-col items-center">
                <StepDot state={step.state} num={step.id} />
                {i < STEPS.length - 1 && (
                  <div
                    className={[
                      "mt-1 mb-1 w-0.5 flex-1",
                      step.state === "done"
                        ? "h-8 bg-emerald-400"
                        : "h-8 bg-slate-200",
                    ].join(" ")}
                  />
                )}
              </div>

              <div className="pb-6 pt-0.5">
                <p
                  className={[
                    "text-sm font-black",
                    step.state === "done"
                      ? "text-emerald-600"
                      : step.state === "current"
                        ? "text-indigo-700"
                        : "text-slate-400",
                  ].join(" ")}
                >
                  {step.label}
                  {step.state === "current" && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700">
                      Next
                    </span>
                  )}
                  {step.state === "locked" && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Locked
                    </span>
                  )}
                </p>
                <p
                  className={[
                    "mt-0.5 text-xs font-semibold",
                    step.state === "locked" ? "text-slate-400" : "text-slate-500",
                  ].join(" ")}
                >
                  {step.sublabel}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── FREE PREVIEW CLARIFICATION ── */}
      <section className="border-t border-slate-100 bg-amber-50 px-5 py-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex-shrink-0 text-lg" aria-hidden="true">
            ℹ️
          </span>
          <p className="text-sm font-semibold leading-relaxed text-amber-900">
            <span className="font-black">Do not miss the live class.</span>{" "}
            The remaining lessons open up after you attend the live class —
            it's free, and it's where the real progress happens.
          </p>
        </div>
      </section>

      {/* ── WEBINAR DATE CARD ── */}
      <section className="px-5 py-8">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-5 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">
            Next live session
          </p>
          <p
            className="mt-1 text-xl font-black text-indigo-900"
            data-testid="text-webinar-date"
          >
            {dateLabel}
          </p>
          <p className="mt-0.5 text-sm font-bold text-indigo-600">
            8:00 PM – 9:30 PM IST
          </p>
          <p className="mt-2 text-xs font-semibold text-indigo-400">
            Live via Zoom · Free for all FluencyJet learners
          </p>
        </div>
      </section>

      {/* ── OUTCOMES ── */}
      <section className="border-t border-slate-100 px-5 py-7">
        <h2 className="text-lg font-black text-slate-900">
          What you'll learn in the webinar
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          A focused 60-minute session — practical, interactive, no fluff.
        </p>

        <ul className="mt-5 space-y-4">
          {OUTCOMES.map((o) => (
            <li
              key={o.title}
              className="flex items-start gap-3"
              data-testid={`outcome-${o.title.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
            >
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-lg"
                aria-hidden="true"
              >
                {o.icon}
              </span>
              <div>
                <p className="text-sm font-black text-slate-800">{o.title}</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {o.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── CTA ── */}
      <section className="sticky bottom-0 z-50 border-t border-slate-100 bg-white px-5 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <a
          href="/webinar"
          data-testid="button-register-webinar"
          className="flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-6 py-4 text-base font-black text-white shadow-lg shadow-indigo-200 transition active:scale-[0.98]"
        >
          Reserve My Free Seat
        </a>
        <p className="mt-2 text-center text-xs font-semibold text-slate-400">
          Free to attend · No payment required
        </p>
      </section>

      {/* ── FOOTER ── */}
      <div className="h-28" aria-hidden="true" />
      <footer className="border-t border-slate-100 bg-slate-50 px-5 py-6 text-center">
        <p className="text-xs font-medium text-slate-400">
          FluencyJet · Spoken English practice for Tamil speakers
        </p>
        <p className="mt-1 text-xs font-medium text-slate-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-bold text-indigo-600 hover:underline"
            data-testid="link-login"
          >
            Log in here
          </Link>
        </p>
      </footer>
    </div>
  );
}

function StepDot({ state, num }) {
  if (state === "done") {
    return (
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-200">
        <svg className="h-4 w-4 fill-current" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M10.28 2.28L4.5 8.06 1.72 5.28a1 1 0 0 0-1.44 1.44l3.5 3.5a1 1 0 0 0 1.44 0l6.5-6.5a1 1 0 0 0-1.44-1.44z" />
        </svg>
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm shadow-indigo-200 ring-4 ring-indigo-100">
        <span className="text-xs font-black">{num}</span>
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-400">
      <span className="text-xs font-black">{num}</span>
    </span>
  );
}
