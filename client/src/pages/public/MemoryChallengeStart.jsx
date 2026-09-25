import { Link, useNavigate } from "react-router-dom";

export default function MemoryChallengeStart() {
  const navigate = useNavigate();

  let selectedTrack = null;

  try {
    selectedTrack = window.sessionStorage.getItem("memory_track");
  } catch {
    selectedTrack = null;
  }

  if (selectedTrack !== "school_foundation") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">
            Choose your learner group first
          </h1>

          <p className="mt-3 text-slate-600">
            Select Class 6–8 before starting the benchmark.
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
            Class 6–8
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Before you begin
          </h1>

          <p className="mt-4 text-base font-medium leading-7 text-slate-600">
            This benchmark has five short parts. Follow the instructions
            carefully and answer from memory without using notes.
          </p>

          <div className="mt-7 space-y-3">
            {[
              "Immediate Recall",
              "Ordered Recall",
              "Association Recall",
              "Academic Recall",
              "Delayed Recall",
            ].map((part, index) => (
              <div
                key={part}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 px-4 py-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-black text-indigo-700">
                  {index + 1}
                </div>

                <p className="font-black text-slate-900">{part}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 rounded-2xl bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-900">
            Some study items will disappear after a short time. You will not
            see the correct answers during the benchmark.
          </div>

          <button
            type="button"
            onClick={() => navigate("/memory-challenge/test")}
            className="mt-7 w-full rounded-2xl bg-indigo-600 px-6 py-4 text-base font-black text-white transition hover:bg-indigo-700"
          >
            Begin Study Recall Benchmark
          </button>
        </div>
      </div>
    </main>
  );
}
