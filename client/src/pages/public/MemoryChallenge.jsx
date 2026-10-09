import { useEffect, useRef, useState } from "react";
import { trackEvent } from "../../lib/tracking";

const FORM_A_SESSION_KEYS = [
  "memory_form_a_immediate_answers",
  "memory_form_a_ordered_answers",
  "memory_form_a_association_answers",
  "memory_form_a_academic_answers",
  "memory_form_a_delayed_answers",
  "memory_form_a_result",
  "memory_form_a_public_token",
  "memory_form_a_owner_token",
  "memory_form_a_lead_saved",
];

function clearPreviousFormAAssessment() {
  try {
    for (const key of FORM_A_SESSION_KEYS) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Track selection can continue if browser storage is unavailable.
  }
}

const TRACKS = [
  {
    id: "school_foundation",
    title: "Class 6–8",
    description: "See how much of what you study stays in your memory.",
    badge: "Available now",
    available: true,
  },
  {
    id: "school_advanced",
    title: "Class 9–12",
    description: "Test how well you can remember important study information.",
    badge: "Available now",
    available: true,
  },
  {
    id: "advanced",
    title: "College & Competitive Exams",
    description: "Test how well you can remember information when it matters.",
    badge: "Available now",
    available: true,
  },
];

export default function MemoryChallenge() {
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [coachImageAvailable, setCoachImageAvailable] = useState(true);
  const trackedLandingView = useRef(false);

  const selectedTrackConfig =
    TRACKS.find((track) => track.id === selectedTrack) || null;

  useEffect(() => {
    document.title = "Free Study Memory Test | BrainoDad";

    if (trackedLandingView.current) return;
    trackedLandingView.current = true;

    trackEvent("memory_landing_view", {
      funnel: "amaze_memory",
      source: "memory_challenge",
    });
  }, []);

  function handleTrackSelect(track) {
    if (!track.available) return;

    clearPreviousFormAAssessment();
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
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-white via-white to-indigo-50/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-9">
          <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:gap-10">
            <div>
              <div className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
                Free Study Memory Test
              </div>

              <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                BrainoDad
              </p>

              <h1 className="mt-2 text-[2rem] font-black leading-[1.08] tracking-tight text-slate-950 sm:text-5xl">
                You studied it. But how much can you REALLY remember?
              </h1>

              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600 sm:text-lg">
                Take this free <span className="font-black text-slate-900">5-part memory test</span>{" "}
                and discover your{" "}
                <span className="font-black text-slate-900">Study Memory Score</span>.
              </p>
            </div>

            {coachImageAvailable && (
              <figure className="flex items-center gap-3 border-t border-indigo-100 pt-4 sm:block sm:border-0 sm:pt-0">
                <img
                  src="/images/memory-challenge-hero.webp"
                  alt="Aravind Pasupathy, Memory Coach"
                  onError={() => setCoachImageAvailable(false)}
                  className="h-[76px] w-[66px] shrink-0 rounded-xl object-cover object-top ring-1 ring-indigo-100 sm:mx-auto sm:h-60 sm:w-48 sm:rounded-2xl"
                />
                <figcaption className="max-w-[220px] text-xs font-semibold leading-5 text-slate-600 sm:mx-auto sm:mt-3 sm:text-center sm:text-sm">
                  Aravind Pasupathy — Memory Coach &amp; Guinness World Record Holder
                </figcaption>
              </figure>
            )}
          </div>
        </header>

        <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.07)] sm:mt-7 sm:p-8">
          <div className="mb-5">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-indigo-600">
              Step 1
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Choose your class or study level
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
              Choose the option that matches your study level.
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

                    {isSelected ? (
                      <span className="shrink-0 rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-700">
                        ✓ Selected
                      </span>
                    ) : (
                      !track.available && (
                        <span className="shrink-0 rounded-full bg-slate-200 px-3 py-1 text-xs font-black text-slate-500">
                          {track.badge}
                        </span>
                      )
                    )}
                  </div>

                </button>
              );
            })}
          </div>

          {selectedTrackConfig?.available && (
            <>
              <div className="mt-6 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-lg font-black text-emerald-900">
                  Great! Your Memory Test is ready 🎯
                </p>

                <p className="mt-2 font-black text-emerald-900">
                  5 quick challenges. One Study Memory Score.
                </p>

                <p className="mt-1 text-sm font-medium leading-6 text-emerald-800">
                  See how much you can remember without notes or help.
                </p>
              </div>

              <a
                href="/memory-challenge/start"
                className="mt-5 flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-6 py-4 text-base font-black text-white transition hover:bg-indigo-700"
              >
                START MY FREE TEST →
              </a>
            </>
          )}
        </section>

        <section className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
          <p className="font-black text-slate-900">About this test</p>
          <p className="mt-2">
            Free educational memory test. Not an IQ test or medical assessment.
          </p>
        </section>
      </div>
    </main>
  );
}
