import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import * as api from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import LessonCard from "../../components/student/LessonCard";
import confetti from "canvas-confetti";

export default function LessonList({ difficulty }) {
  // 🎯 1. Fundamental Hooks
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useAuth();

  // 🎯 2. Local State
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState({ 1: true });

  const [showReward, setShowReward] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const [showMilestone, setShowMilestone] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);

  // Logic to check if all missions are done
  const allMissionsDone = auth?.user?.daily_streak >= 3; // Add your other mission logic here

  // 🎯 3. Toggle Logic
  const toggleModule = (id) => {
    setExpandedModules((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 🎯 Calculate Level (Level 1 = 0 XP, Level 2 = 1000 XP, etc.)
  const userXP = auth?.user?.total_xp || 0;
  const currentLevel = Math.floor(userXP / 1000) + 1;
  const nextLevelXP = currentLevel * 1000;
  const progressToNextLevel = (userXP % 1000) / 10; // 0-100% for the bar

  // 🎯 Load session progress from storage
  const [sentencesMastered, setSentencesMastered] = useState(() => {
    const savedDate = localStorage.getItem("last_practice_date");
    const today = new Date().toLocaleDateString();

    // 🎯 If the dates don't match, it's a new day! Reset to 0.
    if (savedDate !== today) {
      localStorage.setItem("last_practice_date", today);
      localStorage.setItem("daily_sentences_count", "0");
      return 0;
    }

    // Inside your initialization logic
    if (new Date().getDay() === 0 && savedDate !== today) {
      // It's a brand new Sunday morning! Reset the dots for the new week.
      localStorage.setItem(
        "weekly_mastery_dots",
        JSON.stringify([false, false, false, false, false, false, false]),
      );
    }

    return Number(localStorage.getItem("daily_sentences_count") || 0);
  });

  const handleSentenceMastery = () => {
    setSentencesMastered((prev) => {
      const newVal = prev + 1;
      // Trigger confetti if they just hit the goal of 2!
      if (newVal === 2) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
      }
      return newVal;
    });
  };

  // 🎯 Track the 7 days of the week (0 = Sunday, 6 = Saturday)
  const [weeklyProgress, setWeeklyProgress] = useState(() => {
    const saved = localStorage.getItem("weekly_mastery_dots");
    return saved
      ? JSON.parse(saved)
      : [false, false, false, false, false, false, false];
  });

  // Logic for the first mission item
  const isSentencesDone = sentencesMastered >= 2;

  const [claimedSundayReward, setClaimedSundayReward] = useState(() => {
    return (
      localStorage.getItem("sunday_reward_claimed") ===
      new Date().toLocaleDateString()
    );
  });

  // 🎯 Update the dot for 'today' if missions are done
  useEffect(() => {
    if (isSentencesDone) {
      const today = new Date().getDay(); // Get 0-6
      setWeeklyProgress((prev) => {
        const updated = [...prev];
        updated[today] = true;
        localStorage.setItem("weekly_mastery_dots", JSON.stringify(updated));
        return updated;
      });
    }
  }, [isSentencesDone]);

  // 🎯 Save whenever it changes
  useEffect(() => {
    localStorage.setItem("daily_sentences_count", sentencesMastered);
  }, [sentencesMastered]);

  useEffect(() => {
    const isSunday = new Date().getDay() === 0;
    const perfectWeek = weeklyProgress.every(Boolean);

    // 🎯 Trigger Grand Prize if it's Sunday, the week is perfect, and not yet claimed
    if (isSunday && perfectWeek && !claimedSundayReward) {
      // 1. Fire an massive gold confetti burst
      confetti({
        particleCount: 400,
        spread: 100,
        origin: { y: 0.5 },
        colors: ["#FFD700", "#FFA500", "#FFFFFF"], // Pure Gold palette
      });

      // 2. Mark as claimed for today
      setClaimedSundayReward(true);
      localStorage.setItem(
        "sunday_reward_claimed",
        new Date().toLocaleDateString(),
      );
    }
  }, [weeklyProgress, claimedSundayReward]);

  // 🎯 4. Data Fetching (Starting your original useEffect)

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        setLoading(true);
        const response = await api.api.get(`/lessons?difficulty=${difficulty}`);

        // 🎯 Dig into the correct object property based on your console log
        const incomingData = response?.data || [];

        if (Array.isArray(incomingData) && incomingData.length > 0) {
          setLessons(incomingData);
        } else {
          console.warn(
            "No lessons found in the 'lessons' array for:",
            difficulty,
          );
          setLessons([]);
        }
      } catch (err) {
        console.error("Fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLessons();
  }, [difficulty]);

  useEffect(() => {
    const today = new Date().getDay();
    const perfectWeek = weeklyProgress.every(Boolean);

    // 🎯 If it's Sunday (0) and all dots are true
    if (today === 0 && perfectWeek && !claimedSundayReward) {
      // Fire the Golden Confetti Cannon!
      confetti({
        particleCount: 300,
        spread: 100,
        origin: { y: 0.5 },
        colors: ["#FFD700", "#FFA500"],
      });
      setShowSundayBadge(true);
    }
  }, [weeklyProgress]);

  const [topLearners, setTopLearners] = useState([]);

  useEffect(() => {
    const fetchTopLearners = async () => {
      try {
        const response = await api.api.get("/leaderboard?limit=3");
        setTopLearners(response.data || []);
      } catch (err) {
        console.error("Leaderboard fetch failed:", err);
      }
    };
    fetchTopLearners();
  }, []);

  useEffect(() => {
    const xp = auth?.user?.total_xp || 0;
    const lastLevel = localStorage.getItem("last_celebrated_level") || 1;
    const currentLevel = Math.floor(xp / 1000) + 1;

    if (currentLevel > lastLevel) {
      // 🎯 TRIGGER THE CELEBRATION
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#f59e0b", "#10b981"],
      });

      localStorage.setItem("last_celebrated_level", currentLevel);
    }
  }, [auth?.user?.total_xp]);

  useEffect(() => {
    // Trigger if streak is reached and user hasn't seen the reward yet
    if (auth?.user?.daily_streak >= 3 && !showReward) {
      setShowReward(true);
    }
  }, [auth?.user?.daily_streak]);

  const modules = useMemo(() => {
    if (!lessons.length) return [];
    return Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      lessons: lessons.slice(i * 10, (i + 1) * 10),
    }));
  }, [lessons]);

  const [showLeagueIntro, setShowLeagueIntro] = useState(() => {
    return !localStorage.getItem("league_intro_seen");
  });

  useEffect(() => {
    if (showLeagueIntro) {
      // 🎊 Fire a Bronze-colored confetti burst (Orange/Brown/Gold)
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#CD7F32", "#A0522D", "#8B4513"],
      });

      // Auto-hide after 4 seconds
      const timer = setTimeout(() => {
        setShowLeagueIntro(false);
        localStorage.setItem("league_intro_seen", "true");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showLeagueIntro]);

  // 63: Keep your loading check
  if (loading) return <LessonSkeleton />;

  // 65: Standardized return (Removed the double return/fragment)
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* 🏆 1. Sticky Header stays fixed at top */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-6 pt-4 pb-2">
          {/* Your existing progress bar logic */}
          <div className="flex justify-between items-end mb-2">
            <div>
              <h3 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">
                Current Progress
              </h3>
              <p className="text-sm font-bold text-slate-900">Module Mastery</p>
            </div>

            {/* 👑 Smart Upgrade Button or Progress % */}
            {auth?.user?.has_access === false || auth?.has_access === false ? (
              <button
                onClick={() => navigate("/upgrade")}
                className="mb-1 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-200 hover:scale-105 transition-transform animate-pulse"
              >
                Unlock All Units 👑
              </button>
            ) : (
              <span className="text-xs font-black text-indigo-600">
                {Math.round(
                  (lessons.filter((l) => (l.progress || 0) >= 100).length /
                    120) *
                    100,
                )}
                % Overall
              </span>
            )}
          </div>

          {/* Progress Bar Container */}
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-indigo-500 transition-all duration-1000"
              style={{ width: "0%" }}
            />
          </div>

          {/* 🎯 UPDATED: Smart Navigation Pill Menu */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {modules.map((m) => {
              // 🎯 1. Calculate if this unit is 100% finished
              const isMastered =
                m.lessons.length > 0 &&
                m.lessons.every((l) => (l.progress || 0) >= 100);

              // 🎯 2. Determine if the unit is premium (Locked for Mango if no access)
              // Unit 1 (Lessons 1-10) is free, everything else is locked
              const isUnitLocked =
                (auth?.user?.has_access === false ||
                  auth?.has_access === false) &&
                m.id > 1;

              return (
                <button
                  key={m.id}
                  onClick={() => {
                    if (!expandedModules[m.id]) toggleModule(m.id);
                    document
                      .getElementById(`unit-${m.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all whitespace-nowrap border-2 flex items-center gap-1.5 ${
                    expandedModules[m.id]
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                      : isMastered
                        ? "bg-emerald-50 border-emerald-200 text-emerald-600" // Mastery Style
                        : "bg-white border-slate-100 text-slate-400"
                  }`}
                >
                  {isUnitLocked && <span>🔒</span>}
                  Unit {m.id}
                  {isMastered && <span>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {/* 227: 📚 Main Layout Grid (Replaces old duplicate loops) */}
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* 🎯 Left Column: The Lesson Path (8/12 space) */}
        <div className="lg:col-span-8 space-y-8">
          {modules.map((module) => (
            <section
              key={module.id}
              id={`unit-${module.id}`}
              className="relative"
            >
              {/* 🎯 Clickable Unit Header Banner */}
              <button
                onClick={() => toggleModule(module.id)}
                className={`w-full mb-4 p-6 rounded-[2rem] text-white shadow-xl flex justify-between items-center transition-all active:scale-95 ${
                  auth?.user?.has_access === false && module.id > 1
                    ? "bg-slate-400 grayscale-[0.5]"
                    : "bg-gradient-to-br from-indigo-600 to-violet-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black italic">
                    Unit {module.id}
                  </h2>
                  {auth?.user?.has_access === false && module.id > 1 && (
                    <span className="bg-white/20 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest backdrop-blur-sm">
                      Premium 👑
                    </span>
                  )}
                </div>
                <span className="text-xl opacity-50">
                  {expandedModules[module.id] ? "▲" : "▼"}
                </span>
              </button>

              {/* 🎯 Staggered Lesson Path */}
              {expandedModules[module.id] && (
                <div className="flex flex-col items-center gap-8 relative animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="absolute top-0 bottom-0 w-1 bg-slate-100 left-1/2 -translate-x-1/2 -z-10" />

                  {module.lessons.map((lesson, idx) => {
                    const displayNum = (module.id - 1) * 10 + (idx + 1);
                    const isLocked =
                      auth?.user?.has_access === false && displayNum > 3;

                    return (
                      <React.Fragment key={lesson.id}>
                        <LessonCard
                          lesson={lesson}
                          displayNum={displayNum}
                          isLocked={isLocked}
                        />

                        {/* 🎯 Unit 1 End-of-Preview Cliffhanger */}
                        {module.id === 1 &&
                          idx === 9 &&
                          auth?.user?.has_access === false && (
                            <div className="w-full mt-10 p-8 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl relative overflow-hidden border-4 border-amber-400/30">
                              <h4 className="text-xl font-black mb-2 italic text-amber-400">
                                Unit 1 Complete! 🚀
                              </h4>
                              <p className="text-slate-400 text-[11px] mb-6 font-bold uppercase tracking-wider">
                                Unlock 110+ more professional lessons now.
                              </p>
                              <button
                                onClick={() => navigate("/upgrade")}
                                className="w-full py-4 bg-amber-400 text-slate-900 font-black rounded-2xl text-[10px] hover:scale-105 transition-transform"
                              >
                                Continue Your Journey
                              </button>
                            </div>
                          )}
                      </React.Fragment>
                    );
                  })}

                  {/* 🏆 Unit Mastery Trophy (Celebrates 100% completion) */}
                  {module.lessons.length > 0 &&
                    module.lessons.every((l) => (l.progress || 0) >= 100) && (
                      <div className="w-full mt-8 p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-100 text-center animate-bounce">
                        <div className="text-4xl mb-2">🏆</div>
                        <h5 className="text-emerald-900 font-black text-sm uppercase tracking-widest">
                          Unit {module.id} Mastered!
                        </h5>
                      </div>
                    )}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* 🎯 Right Column: Daily Mission Sidebar (4/12 space) */}
        {/* 242: 🎯 Right Column: Daily Mission Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="sticky top-32 bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
            {/* 🏆 UNIT MASTERED CELEBRATION OVERLAY */}
            {Object.keys(expandedModules).some((id) => {
              const mod = modules.find((m) => m.id === Number(id));
              return (
                expandedModules[id] &&
                mod?.lessons.length > 0 &&
                mod?.lessons.every((l) => (l.progress || 0) >= 100)
              );
            }) ? (
              <div className="text-center py-6 animate-in zoom-in duration-500">
                <div className="text-6xl mb-4 animate-bounce">🏆</div>
                <h3 className="font-black text-slate-900 text-xl leading-tight uppercase">
                  Unit Mastered!
                </h3>
                <p className="text-indigo-600 font-bold text-[10px] tracking-widest mt-2">
                  அலகு முடிந்தது!
                </p>
                <div className="mt-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-700">
                    You're a Sentence Master! Keep the momentum going.
                  </p>
                </div>
              </div>
            ) : (
              /* 🎯 Standard Daily Missions */
              <>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg leading-none">
                      Daily Missions
                    </h3>
                    <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-1">
                      தினசரி இலக்குகள்
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <MissionItem
                    label="Master 2 New Sentences"
                    tamil="2 புதிய வாக்கியங்கள்"
                    xp={50}
                    done={isSentencesDone}
                  />
                  <MissionItem
                    label="Maintain 3-Day Streak"
                    tamil="3 நாள் தொடர்ச்சி"
                    xp={100}
                    isStreak={true}
                    done={auth?.user?.daily_streak >= 3}
                  />
                  <MissionItem
                    label="Check Leaderboard"
                    tamil="முன்னணிப் பட்டியல்"
                    xp={20}
                    done={true}
                  />
                </div>
              </>
            )}

            <div className="mt-8 pt-6 border-t border-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Total Daily XP
              </p>
              <p className="text-2xl font-black text-indigo-600">+170 XP</p>
            </div>
          </div>
        </aside>
      </div>{" "}
      {/* 📅 Weekly Streak Calendar */}
      <div className="mt-8 pt-6 border-t border-slate-50">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Weekly Goal
          </h4>
          <span className="text-[10px] font-black text-emerald-500 uppercase">
            {weeklyProgress.filter(Boolean).length}/7 Days
          </span>
        </div>

        <div className="flex justify-between items-center gap-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => {
            const isToday = new Date().getDay() === i;
            const isDone = weeklyProgress[i]; // 🎯 This is the key boolean

            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-500 ${
                    isDone
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-100 scale-110" // 🟢 Finished day
                      : isToday
                        ? "border-2 border-dashed border-indigo-400 text-indigo-400 animate-pulse" // ⚡ Current day
                        : "bg-slate-100 text-slate-400" // ⚪ Future/Missed day
                  }`}
                >
                  {isDone ? "✓" : day}
                </div>
                {isToday && (
                  <div className="h-1 w-1 rounded-full bg-indigo-400" />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* 🎖️ Level Progression Badge */}
      <div className="mb-6 p-4 rounded-3xl bg-slate-900 text-white overflow-hidden relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
            Current Rank
          </span>
          <span className="text-xs font-black italic">
            Level {Math.floor((auth?.user?.xpTotal || 0) / 1000) + 1}
          </span>
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-1000"
            style={{ width: `${((auth?.user?.xpTotal || 0) % 1000) / 10}%` }}
          />
        </div>
      </div>
      {/* Close Grid Layout */}
      {/* 🎖️ LEVEL UP POPUP (Pasted here) */}
      {showLevelUp && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-indigo-900/80 backdrop-blur-md animate-in fade-in duration-500">
          <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full text-center shadow-[0_0_50px_rgba(99,102,241,0.5)] animate-in zoom-in duration-300">
            <div className="relative inline-block mb-6">
              <span className="text-8xl">🎖️</span>
              <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white text-xs font-black px-3 py-1 rounded-full border-4 border-white">
                LVL {Math.floor((auth?.user?.xpTotal || 0) / 1000) + 1}
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">
              New Rank!
            </h2>
            <p className="text-indigo-600 font-bold uppercase tracking-widest text-[10px] mb-8">
              புதிய நிலை எட்டப்பட்டது!
            </p>
            <button
              onClick={() => setShowLevelUp(false)}
              className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all"
            >
              Keep Exploring
            </button>
          </div>
        </div>
      )}
      {/* 🥉 LEAGUE ENTRY ANIMATION */}
      {showLeagueIntro && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-500">
          <div className="text-center animate-in zoom-in-50 duration-500">
            <div className="inline-block p-8 rounded-[3rem] bg-white shadow-2xl relative">
              <span className="text-8xl block mb-4 animate-bounce">🥉</span>
              <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">
                Bronze League
              </h2>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">
                Welcome to the Arena, {auth?.user?.username}!
              </p>

              {/* Decorative rays */}
              <div className="absolute inset-0 -z-10 bg-orange-400/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}
      {/* 🎯 Right Column: Daily Mission Sidebar (4/12 space) */}
      <aside className="lg:col-span-4 hidden lg:block">
        <div className="sticky top-32 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-2xl shadow-slate-200/50">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-2xl">🎯</span>
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg">
                Daily Missions
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-tamil">
                தினசரி இலக்குகள்
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <MissionItem
              label="Master 2 New Sentences"
              tamilLabel="2 புதிய வாக்கியங்களை கற்க"
              xp={50}
              done={false}
            />
            <MissionItem
              label="Maintain 3-Day Streak"
              tamilLabel="3 நாட்கள் தொடர் கற்றல்"
              xp={100}
              done={auth?.user?.daily_streak >= 3}
            />
            <MissionItem
              label="Finish a Unit"
              tamilLabel="ஒரு பாடப்பிரிவை முடிக்க"
              xp={150}
              done={false}
            />
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <div className="sticky top-32 bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xl shadow-slate-200/50">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">🎯</span>
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg leading-none">
                    Daily Missions
                  </h3>
                  <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-1">
                    தினசரி இலக்குகள்
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <MissionItem
                  label="Master 2 New Sentences"
                  tamil="2 புதிய வாக்கியங்கள்"
                  xp={50}
                  done={false}
                />
                <MissionItem
                  label="Maintain 3-Day Streak"
                  tamil="3 நாள் தொடர்ச்சி"
                  xp={100}
                  done={auth?.user?.daily_streak >= 3}
                />
                <MissionItem
                  label="Check Leaderboard"
                  tamil="முன்னணிப் பட்டியல்"
                  xp={20}
                  done={true}
                />
              </div>

              <div className="mt-8 pt-6 border-t border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Total Daily XP
                </p>
                <p className="text-2xl font-black text-indigo-600">+170 XP</p>
              </div>
            </div>
          </aside>

          <div className="mt-10 pt-6 border-t border-slate-50">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Potential Rewards
            </p>
            <p className="text-3xl font-black text-indigo-600">+300 XP</p>
          </div>
        </div>
      </aside>
      {/* 🏆 XP Leaderboard Mini-Widget */}
      <div className="mt-8 pt-6 border-t border-slate-50">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Top Learners
          </h4>
          <button
            onClick={() => navigate("/leaderboard")}
            className="text-[9px] font-black text-indigo-500 uppercase hover:underline"
          >
            View All
          </button>
        </div>

        <div className="space-y-3">
          {/* 🛡️ Defensive Guard: Prevents 'map is not a function' crash */}
          {Array.isArray(topLearners) && topLearners.length > 0 ? (
            topLearners.map((learner, index) => (
              <div
                key={learner.id || index}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  learner.id === auth?.user?.id
                    ? "bg-indigo-50 border-indigo-100"
                    : "bg-white border-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                      index === 0
                        ? "bg-yellow-400 text-white"
                        : index === 1
                          ? "bg-slate-300 text-white"
                          : "bg-orange-300 text-white"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[80px]">
                    {learner.username}
                  </span>
                </div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">
                  {learner.total_xp || 0} XP
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                Finding champions...
              </p>
            </div>
          )}
        </div>
      </div>
      {/* 👑 SUNDAY GRAND PRIZE BADGE */}
      {weeklyProgress.every(Boolean) && (
        <div className="mb-6 p-6 rounded-[2rem] bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 shadow-lg shadow-yellow-200 animate-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-4">
            <span className="text-4xl animate-bounce">👑</span>
            <div>
              <h3 className="text-white font-black uppercase tracking-tighter text-sm">
                Perfect Week!
              </h3>
              <p className="text-white/80 font-bold text-[10px] uppercase tracking-widest">
                +500 XP BONUS
              </p>
            </div>
          </div>
        </div>
      )}
      {showReward && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-500">
            <div className="text-7xl mb-6">✨</div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">
              Daily Mastery!
            </h2>
            <p className="text-indigo-600 font-bold uppercase tracking-widest text-xs mb-8">
              தினசரி சாதனை!
            </p>

            <div className="bg-slate-50 rounded-3xl p-6 mb-8 border border-slate-100">
              <span className="text-4xl font-black text-indigo-600">
                +170 XP
              </span>
            </div>

            <button
              onClick={() => {
                // 🎯 1. Fire the Golden Cannon
                confetti({
                  particleCount: 150,
                  spread: 70,
                  origin: { y: 0.6 },
                  colors: ["#fbbf24", "#f59e0b", "#6366f1"], // Gold, Amber, and Indigo
                  zIndex: 999,
                });

                // 🎯 2. Close the modal after a short delay so they enjoy the stars
                setTimeout(() => setShowReward(false), 500);
              }}
              className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-95"
            >
              Claim Rewards 🏆
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 🎯 Dopamine-friendly Skeleton Screen
const LessonSkeleton = () => (
  <div className="max-w-2xl mx-auto px-4 py-10 animate-pulse space-y-12">
    {[1, 2].map((i) => (
      <div key={i}>
        <div className="h-24 w-full bg-slate-200 rounded-3xl mb-8" />
        <div className="flex flex-col items-center gap-8">
          {[1, 2, 3].map((j) => (
            <div key={j} className="h-20 w-20 rounded-full bg-slate-100" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

function MissionItem({ label, tamil, xp, done, isStreak }) {
  // 🎯 Pulse only if it's a streak mission and NOT done yet
  const shouldPulse = isStreak && !done;

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-500 ${
        done
          ? "bg-emerald-50 border-emerald-100 opacity-60"
          : shouldPulse
            ? "bg-orange-50 border-orange-200 shadow-[0_0_15px_rgba(251,146,60,0.3)] animate-pulse"
            : "bg-slate-50 border-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            done
              ? "bg-emerald-500 border-emerald-500"
              : "border-slate-200 bg-white"
          }`}
        >
          {done ? (
            <span className="text-white text-xs">✓</span>
          ) : // 🎯 The flame now uses the CSS class we added to index.css
          isStreak ? (
            <span className="text-[10px] animate-flame">🔥</span>
          ) : (
            <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
          )}
        </div>
        <div>
          <span
            className={`block text-xs font-black leading-tight ${
              isStreak && !done ? "text-orange-700" : "text-slate-800"
            }`}
          >
            {label}
          </span>
          <span className="block text-[9px] font-bold text-slate-400 uppercase mt-0.5">
            {tamil}
          </span>
        </div>        
      </div>      
      <span className="text-[10px] font-black text-indigo-500">+{xp}XP</span>      
      </div>        
    );
  }
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-indigo-950/80 backdrop-blur-md animate-in fade-in duration-500">
          <div className="text-center p-10 bg-white rounded-[3rem] shadow-2xl scale-110 animate-in zoom-in-75 duration-500 max-w-sm mx-4">
            <div className="w-24 h-24 bg-gradient-to-tr from-orange-400 to-yellow-300 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <span className="text-5xl">🛡️</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 leading-tight">
              BRONZE MASTER
            </h2>
            <p className="text-indigo-600 font-black text-xs uppercase tracking-[0.2em] mt-2">
              1,000 XP Milestone
            </p>

            <p className="mt-6 text-slate-500 text-sm font-medium leading-relaxed">
              You've officially mastered the basics! You're now a top-tier
              competitor in the Bronze League.
            </p>

            <button
              onClick={() => setShowMilestone(false)}
              className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
            >
              Continue My Reign
            </button>            
          </div>          
        </div>
      )}        
    </div>
  );
}
