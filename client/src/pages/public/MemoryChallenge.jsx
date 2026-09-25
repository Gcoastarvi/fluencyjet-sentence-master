import { useEffect, useRef, useState } from "react";
import { trackEvent } from "../../lib/tracking";

const TRACKS = [
  {
    id: "school_foundation",
    title: "Class 6–8",
    description: "For middle-school students building stronger study recall.",
    badge: "Available now",
    available: true,
  },
  {
    id: "school_advanced",
    title: "Class 9–12",
    description: "For secondary and higher-secondary students.",
    badge: "Coming next",
    available: false,
  },
  {
    id: "advanced",
    title: "Advanced",
    description: "College, competitive exams and professional learning.",
    badge: "Coming next",
    available: false,
  },
];

export default function MemoryChallenge() {
  const [selectedTrack, setSelectedTrack] = useState(null);
  const trackedLandingView = useRef(false);

  useEffect(() => {
    document.title = "Free Study Recall Benchmark | Amaze Memory";

    if (trackedLandingView.current) return;
    trackedLandingView.current = true;

    trackEvent("memory_landing_view", {
      funnel: "amaze_memory",
      source: "memory_challenge",
    });
  }, []);

  function handleTrackSelect(track) {
    if (!track.available) return;

    setSelectedTrack(track.id);

    try {
      window.sessionStorage.setItem("memory_track", track.id);
    } catch {
      // Selection still works if browser storage is unavailable.
    }

    trackEvent("memory_track_selected", {
      funnel: "amaze_memory",
      track: track.id,
      source: "memory_challenge",
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <div className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
            Free Study Recall Benchmark
          </div>

          <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-slate-500">
            Amaze Memory
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
            How well do you remember what you study?
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600 sm:text-lg">
            Take a short five-part benchmark to measure how you recall
            information today.
          </p>
        </header>

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.07)] sm:p-8">
          <div className="mb-5">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-indigo-600">
              Step 1
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Choose your learner group
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
              We use a matched benchmark designed for your study level.
            </p>
          </div>

          <div className="space-y-3">
            {TRACKS.map((track) => {
              const isSelected = selectedTrack === track.id;

              return (
                <button
                  key={track.id}
                  type="button"
                  disabled={!track.available}
                  onClick={() => handleTrackSelect(track)}
                  className={`w-full rounded-[1.5rem] border p-5 text-left transition ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50 shadow-sm"
                      : track.available
                        ? "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                        : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-65"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-950">
                        {track.title}
                      </h3>
                      <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
                        {track.description}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                        track.available
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {track.badge}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-bold text-indigo-700 shadow-sm">
                      ✓ Class 6–8 benchmark selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedTrack === "school_foundation" && (
            <>
              <div className="mt-6 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5">
                <p className="font-black text-emerald-900">
                  You're ready for the Class 6–8 Study Recall Benchmark.
                </p>
                <p className="mt-2 text-sm font-medium leading-6 text-emerald-800">
                  It will check Immediate Recall, Ordered Recall, Association
                  Recall, Academic Recall and Delayed Recall.
                </p>
              </div>

              <a
                href="/memory-challenge/start"
                className="mt-5 flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-6 py-4 text-base font-black text-white transition hover:bg-indigo-700"
              >
                Continue to Free Benchmark
              </a>
            </>
          )}
        </section>

        <section className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
          <p className="font-black text-slate-900">About this benchmark</p>
          <p className="mt-2">
            This is an educational Study Recall Benchmark. It is not an IQ test,
            clinical memory test, neuropsychological test or medical diagnosis.
          </p>
        </section>
      </div>
    </main>
  );
}
