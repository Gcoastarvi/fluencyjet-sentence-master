import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCefrDay } from "@/api/cefrApi";

const ACTIVITY_LABELS = {
  MCQ: "Quick Check",
  REORDER: "Build It",
  TYPING: "Type It",
  TEXT: "Type It",
  LISTENING_MCQ: "Hear It",
  AUDIO_REPEAT: "Say It",
  GROUPED_FIELDS: "Write It",
  SPEAKING_PROMPT: "Speak It",
};

function activityLabel(activity) {
  return (
    ACTIVITY_LABELS[activity?.activityType] ||
    activity?.activityType ||
    "Practice"
  );
}

function ActivityCard({ activity, index }) {
  const itemCount = Array.isArray(activity.items)
    ? activity.items.length
    : 0;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-black text-indigo-700">
          {index + 1}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-600">
                {activityLabel(activity)}
              </p>

              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                {activity.title}
              </h2>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-500">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {activity.evaluationMode === "SELF_ATTESTED"
                ? "Practice activity"
                : "Auto checked"}
            </p>

            <span className="text-sm font-black text-slate-400">
              Practice player next
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CefrDayPage() {
  const {
    programSlug = "",
    dayNumber: rawDayNumber = "",
  } = useParams();

  const [state, setState] = useState({
    loading: true,
    error: "",
    status: null,
    code: "",
    data: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({
        loading: true,
        error: "",
        status: null,
        code: "",
        data: null,
      });

      const response = await getCefrDay(
        programSlug,
        rawDayNumber,
      );

      if (cancelled) return;

      if (!response.ok) {
        setState({
          loading: false,
          error:
            response.data?.message ||
            response.error ||
            "Unable to load this learning day.",
          status: response.status,
          code: response.data?.code || "",
          data: response.data || null,
        });
        return;
      }

      setState({
        loading: false,
        error: "",
        status: response.status,
        code: "",
        data: response.data,
      });
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [programSlug, rawDayNumber]);

  const programPath = `/learn/${encodeURIComponent(programSlug)}`;

  if (state.loading) {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-9 w-72 max-w-full rounded bg-slate-200" />
            <div className="mt-4 h-5 w-96 max-w-full rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (state.code === "DAY_LOCKED") {
    const day = state.data?.day;

    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Link
            to={programPath}
            className="text-sm font-black text-indigo-700"
          >
            ← Back to learning path
          </Link>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
              🔒
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Day {day?.dayNumber || rawDayNumber}
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {day?.title || "This day is locked"}
            </h1>

            {day?.summary && (
              <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-slate-600">
                {day.summary}
              </p>
            )}

            <p className="mt-5 text-sm font-bold text-slate-500">
              Practice will unlock after the scheduled live class.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Link
            to={programPath}
            className="text-sm font-black text-indigo-700"
          >
            ← Back to learning path
          </Link>

          <div className="mt-5 rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-500">
              Unable to open day
            </p>

            <h1 className="mt-3 text-2xl font-black text-slate-950">
              {state.error}
            </h1>

            {state.status === 404 && (
              <p className="mt-3 text-sm font-medium text-slate-600">
                This learning day could not be found.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const {
    program,
    day,
  } = state.data || {};

  const activities = Array.isArray(day?.activities)
    ? day.activities
    : [];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          to={programPath}
          className="text-sm font-black text-indigo-700"
        >
          ← {program?.name || "Learning path"}
        </Link>

        <section className="mt-5 rounded-[2rem] border border-indigo-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">
            Day {day?.dayNumber}
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {day?.title}
          </h1>

          {day?.summary && (
            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-600 sm:text-base">
              {day.summary}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {program?.cefrLevel && (
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-700">
                CEFR {program.cefrLevel}
              </span>
            )}

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">
              {activities.length} activities
            </span>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              Today&apos;s practice
            </h2>

            <p className="mt-1 text-sm font-medium text-slate-500">
              Complete the activities in order.
            </p>
          </div>

          <div className="space-y-4">
            {activities.map((activity, index) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                index={index}
              />
            ))}
          </div>

          {activities.length === 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="font-bold text-slate-600">
                No activities are available for this day.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
