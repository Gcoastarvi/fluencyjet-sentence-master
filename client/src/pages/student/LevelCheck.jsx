import React from "react";
import { useNavigate } from "react-router-dom";

const TRACK_KEY = "fj_track";

export default function LevelCheck() {
  const navigate = useNavigate();

  function choose(track) {
    try {
      localStorage.setItem(TRACK_KEY, track);
    } catch {}

    navigate(track === "intermediate" ? "/i/lessons" : "/b/lessons", {
      replace: true,
    });
  }

  return (
    <div className="mx-auto max-w-3xl p-6 mt-8">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Level Check</h1>
        <p className="mt-2 text-gray-600">
          Pick your starting level. You can switch later.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose("beginner")}
            className="rounded-2xl border p-5 text-left hover:bg-gray-50"
          >
            <div className="text-lg font-semibold">Beginner</div>
            <div className="mt-1 text-sm text-gray-600">
              Start from basics and build fluency step-by-step.
            </div>
            <div className="mt-3 inline-flex items-center text-sm font-semibold text-indigo-600">
              Start Beginner →
            </div>
          </button>

          <button
            type="button"
            onClick={() => choose("intermediate")}
            className="rounded-2xl border p-5 text-left hover:bg-gray-50"
          >
            <div className="text-lg font-semibold">Intermediate</div>
            <div className="mt-1 text-sm text-gray-600">
              If you can form basic sentences already, start here.
            </div>
            <div className="mt-3 inline-flex items-center text-sm font-semibold text-indigo-600">
              Start Intermediate →
            </div>
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Tip: If you’re unsure, start Beginner.
        </div>
      </div>
    </div>
  );
}
