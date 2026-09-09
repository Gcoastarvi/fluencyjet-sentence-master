import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCefrProgress } from "@/api/cefrApi";

function formatUnlockTime(value, timeZone) {
  if (!value) return null;

  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timeZone || undefined,
    }).format(new Date(value));
  } catch {
    return null;
  }
}

function DayStatusBadge({ day }) {
  if (day.completed) {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-700">
        Completed
      </span>
    );
  }

  if (day.unlocked) {
    return (
      <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-extrabold text-indigo-700">
        Available
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">
      Locked
    </span>
  );
}

function DayCard({ programSlug, cohort, day }) {
  const unlockLabel = formatUnlockTime(
    day.liveSession?.appUnlockAt,
    cohort?.timezone,
  );

  const progressLabel = day.unlocked
    ? `${day.completedActivityCount || 0} / ${day.activityCount || 0} activities completed`
    : unlockLabel
      ? `Unlocks ${unlockLabel}`
      : "Unlocks after the live class";

  const card = (
    <div
      className={`rounded-3xl border bg-white p-5 shadow-sm transition sm:p-6 ${
        day.unlocked
          ? "border-indigo-100 hover:-translate-y-0.5 hover:shadow-md"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Day {day.dayNumber}
          </p>

          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
            {day.title}
          </h2>
        </div>

        <DayStatusBadge day={day} />
      </div>

      {day.summary && (
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-600 sm:text-base">
          {day.summary}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
        <p className="text-sm font-bold text-slate-500">{progressLabel}</p>

        {day.unlocked ? (
          <span className="text-sm font-black text-indigo-700">
            {day.completed ? "Review day →" : "Continue →"}
          </span>
        ) : (
          <span className="text-sm font-bold text-slate-400">
            Scheduled
          </span>
        )}
      </div>
    </div>
  );

  if (!day.unlocked) {
    return card;
  }

  return (
    <Link
      to={`/learn/${encodeURIComponent(programSlug)}/day/${day.dayNumber}`}
      className="block"
    >
      {card}
    </Link>
  );
}

export default function CefrProgramPage() {
  const { programSlug = "" } = useParams();

  const [state, setState] = useState({
    loading: true,
    error: "",
    status: null,
    data: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({
        loading: true,
        error: "",
        status: null,
        data: null,
      });

      const response = await getCefrProgress(programSlug);

      if (cancelled) return;

      if (!response.ok) {
        setState({
          loading: false,
          error:
            response.data?.message ||
            response.error ||
            "Unable to load this learning program.",
          status: response.status,
          data: response.data || null,
        });
        return;
      }

      setState({
        loading: false,
        error: "",
        status: response.status,
        data: response.data,
      });
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [programSlug]);

  const completedDays = useMemo(() => {
    const days = state.data?.days || [];
    return days.filter((day) => day.completed).length;
  }, [state.data]);

  if (state.loading) {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="h-5 w-28 rounded bg-slate-200" />
            <div className="mt-4 h-10 w-64 rounded bg-slate-200" />
            <div className="mt-3 h-5 w-80 max-w-full rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-rose-500">
            Program unavailable
          </p>

          <h1 className="mt-3 text-2xl font-black text-slate-950">
            {state.error}
          </h1>

          {state.status === 403 && (
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
              Your account does not currently have access to this learning
              program.
            </p>
          )}
        </div>
      </div>
    );
  }

  const {
    program,
    version,
    enrollment,
    cohort,
    totalXp = 0,
    days = [],
  } = state.data || {};

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-[2rem] border border-indigo-100 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">
                  FluencyJet Learning Program
                </p>

                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  {program?.name || "Learning Program"}
                </h1>

                <div className="mt-3 flex flex-wrap gap-2">
                  {program?.cefrLevel && (
                    <span className="rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs font-extrabold text-indigo-700">
                      CEFR {program.cefrLevel}
                    </span>
                  )}

                  {program?.language?.name && (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-extrabold text-slate-600">
                      {program.language.name}
                    </span>
                  )}

                  {version?.versionKey && (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-extrabold text-slate-500">
                      {version.versionKey}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid min-w-[230px] grid-cols-2 gap-3">
                <div className="rounded-2xl border border-indigo-100 bg-white p-4 text-center shadow-sm">
                  <p className="text-2xl font-black text-indigo-700">
                    {Number(totalXp || 0).toLocaleString("en-IN")}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    XP earned
                  </p>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-white p-4 text-center shadow-sm">
                  <p className="text-2xl font-black text-indigo-700">
                    {completedDays}/{days.length}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Days complete
                  </p>
                </div>
              </div>
            </div>

            {cohort && (
              <div className="mt-6 rounded-2xl border border-indigo-100 bg-white/80 px-4 py-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
                  Your cohort
                </p>
                <p className="mt-1 text-sm font-black text-slate-800">
                  {cohort.name}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              Your learning path
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Practice unlocks according to your live-class schedule.
            </p>
          </div>

          <div className="space-y-4">
            {days.map((day) => (
              <DayCard
                key={day.id}
                programSlug={programSlug}
                cohort={cohort}
                day={day}
              />
            ))}
          </div>

          {days.length === 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="font-bold text-slate-600">
                No learning days are available yet.
              </p>
            </div>
          )}
        </section>

        {enrollment && (
          <p className="mt-8 text-center text-xs font-medium text-slate-400">
            Enrollment active
          </p>
        )}
      </div>
    </div>
  );
}
