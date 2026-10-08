import { Link, useNavigate } from "react-router-dom";
import { getMemoryAssessment } from "../../data/memory/assessmentRegistry";

export default function MemoryChallengeStart() {
  const navigate = useNavigate();

  let selectedTrack = null;

  try {
    selectedTrack = window.sessionStorage.getItem("memory_track");
  } catch {
    selectedTrack = null;
  }

  const assessment = getMemoryAssessment(selectedTrack);

  const levelLabel =
    selectedTrack === "school_foundation"
      ? "CLASS 6–8"
      : selectedTrack === "school_advanced"
        ? "CLASS 9–12"
        : selectedTrack === "advanced"
          ? "COLLEGE & COMPETITIVE EXAMS"
          : "";

  if (!assessment) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">
            Choose your class or study level first
          </h1>

          <p className="mt-3 text-slate-600">
            Choose your class or study level before starting the test.
          </p>

          <Link
            to="/memory-challenge"
            className="mt-6 inline-flex rounded-2xl bg-indigo-600 px-6 py-3 font-black text-white"
          >
            Go back
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)] sm:p-9">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-600">
            {levelLabel}
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Ready to test your memory? 🧠
          </h1>

          <p className="mt-4 text-base font-medium leading-7 text-slate-600">
            Complete <strong>5 quick memory challenges</strong> and discover your{" "}
            <strong>Study Memory Score</strong>.
          </p>

          <p className="mt-2 text-base font-black text-slate-900">
            No notes. No help. Just do your best!
          </p>

          <h2 className="mt-7 text-xl font-black text-slate-950">
            Your 5 Memory Challenges
          </h2>

          <div className="mt-4 space-y-3">
            {[
              {
                title: "Quick Memory",
                description: "Remember what you see.",
              },
              {
                title: "Remember the Order",
                description: "Can you remember things in the correct order?",
              },
              {
                title: "Match & Remember",
                description: "Connect things together and remember them.",
              },
              {
                title: "Study & Remember",
                description: "Read something and remember the important points.",
              },
              {
                title: "Remember Later",
                description: "Can you still remember it after a little while?",
              },
            ].map((part, index) => (
              <div
                key={part.title}
                className="flex items-start gap-4 rounded-2xl border border-slate-200 px-4 py-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-black text-indigo-700">
                  {index + 1}
                </div>

                <div>
                  <p className="font-black text-slate-900">{part.title}</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
                    {part.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <p className="font-black">👀 Watch carefully!</p>
            <p className="mt-1 font-medium">
              Some things will disappear after a few seconds. Remember as much
              as you can!
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/memory-challenge/test")}
            className="mt-7 w-full rounded-2xl bg-indigo-600 px-6 py-4 text-base font-black text-white transition hover:bg-indigo-700"
          >
            START & DISCOVER MY SCORE →
          </button>

          <p className="mt-5 text-center text-xs font-medium leading-5 text-slate-500">
            This is an educational memory test. It is not an IQ test, medical
            test or diagnosis.
          </p>
        </div>
      </div>
    </main>
  );
}
