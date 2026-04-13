// client/src/components/Navbar.jsx
// 🎯 STEP 1: ADD THIS MISSING IMPORT (Vital for line 8)
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, auth, logout, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const trackPath =
    user?.track?.toLowerCase() === "intermediate" ? "/i/lessons" : "/b/lessons";

  // 🎯 STEP 2: Use the local 'useState' instead of 'React.useState' for cleaner code
  const [showStreakModal, setShowStreakModal] = useState(false);

  // ✅ LOADING GUARD — THIS IS THE KEY
  if (loading) {
    return (
      <nav className="flex items-center px-6 py-4 shadow-sm bg-white">
        <span className="text-purple-700 font-bold text-xl">
          FluencyJet Sentence Master
        </span>
      </nav>
    );
  }

  const isAdmin = user?.role === "ADMIN";

  function handleLoginClick() {
    navigate("/login");
  }

  function handleLogoutClick() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <nav className="w-full bg-white shadow-sm overflow-x-hidden">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="text-xl sm:text-2xl font-bold text-purple-700 leading-tight whitespace-nowrap"
          >
            FluencyJet <span className="font-normal">Sentence Master</span>
          </Link>

          {/* 🥉 Navbar League Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100 hover:bg-slate-100 transition-colors cursor-help group relative">
            <span className="text-lg">🥉</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase leading-none tracking-tighter">
                League
              </span>
              <span className="text-xs font-black text-slate-700 leading-none mt-0.5">
                {auth?.user?.league || "BRONZE"}
              </span>
            </div>

            {/* Tooltip on Hover */}
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-3 py-2 bg-slate-900 text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Maintain Top 3 to Promote! 🚀
            </div>
          </div>

          {/* 🔥 Clickable Streak Flame Trigger */}
          {user?.daily_streak > 0 && (
            <button
              onClick={() => setShowStreakModal(true)}
              className="flex items-center gap-1 bg-orange-50 border border-orange-100 px-3 py-1 rounded-full hover:scale-105 transition-transform"
            >
              <span>🔥 {user.daily_streak}</span>
              {/* 🛡️ Streak Freeze Shield for Premium Users */}
              {(user?.plan === "BEGINNER" || auth?.has_access) && (
                <span className="text-[10px] ml-1" title="Protected">
                  🛡️
                </span>
              )}
            </button>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap pb-1 sm:pb-0">
            {!isAuthenticated && (
              <>
                <Link
                  to="/practice"
                  className="text-sm sm:text-base hover:text-purple-600"
                >
                  Free Quiz
                </Link>
                <button
                  onClick={handleLoginClick}
                  className="shrink-0 px-4 py-2 bg-purple-600 text-white rounded-full shadow text-sm sm:text-base"
                >
                  Login
                </button>
              </>
            )}

            <nav className="hidden md:flex items-center gap-4 sm:gap-8">
              {isAuthenticated && (
                <>
                  <Link className="text-sm sm:text-base" to="/dashboard">
                    Dashboard
                  </Link>
                  {/* 🎯 THE SMART UNIT LABEL */}
                  <Link
                    className="text-sm sm:text-base flex items-center gap-1"
                    to={trackPath}
                  >
                    Lessons
                    {user?.current_unit && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-black">
                        U{user.current_unit}
                      </span>
                    )}
                  </Link>

                  {/* 👤 Profile Link */}
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    <span>👤</span>
                    Profile
                  </Link>
                  <Link className="text-sm sm:text-base" to="/leaderboard">
                    Leaderboard
                  </Link>

                  {/* 🎯 Hide Upgrade if user has paid access */}
                  {!auth?.has_access && (
                    <Link
                      to="/upgrade"
                      className="shrink-0 px-4 py-2 bg-yellow-400 text-black rounded-full font-semibold text-sm sm:text-base"
                    >
                      Upgrade
                    </Link>
                  )}
                  {isAdmin && (
                    <Link className="text-sm sm:text-base" to="/admin">
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={handleLogoutClick}
                    className="shrink-0 px-4 py-2 bg-gray-800 text-white rounded-full shadow text-sm sm:text-base"
                  >
                    Logout
                  </button>
                </>
              )}
            </nav>
          </div>
          {/* 🎯 Premium Streak Flame */}
          {showStreakModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in duration-300">
                <button
                  onClick={() => setShowStreakModal(false)}
                  className="absolute top-6 right-6 text-slate-400"
                >
                  ✕
                </button>
                <div className="text-center">
                  <div className="text-6xl mb-4">🔥</div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {user?.daily_streak} Day Streak!
                  </h3>
                  <p className="text-slate-500 mt-2 text-sm font-medium">
                    Keep practicing daily to build your fluency engine.
                  </p>
                  <div className="mt-6 p-4 bg-orange-50 rounded-2xl border border-orange-100 flex justify-around">
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                      <div
                        key={i}
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold ${i < user?.daily_streak % 7 ? "bg-orange-500 text-white shadow-sm" : "bg-white text-slate-300"}`}
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
