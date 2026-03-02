import React, { useEffect, useState } from "react";
import { api } from "@/api/apiClient";
import Certificate from "@/components/student/Certificate";
import { toPng } from "html-to-image";

export default function HallOfFame() {
  const [mastered, setMastered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, hallRes] = await Promise.all([
          api.get("/auth/me"),
          api.get("/quizzes/hall-of-fame"),
        ]);
        if (meRes.ok) setUser(meRes.data?.user || meRes.user);
        if (hallRes.ok) setMastered(hallRes.lessons || []);
      } catch (err) {
        console.error("Hall of Fame load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const downloadCert = async (dayNumber) => {
    const node = document.getElementById(`cert-${dayNumber}`);
    if (!node) return;
    const dataUrl = await toPng(node, { quality: 1.0, pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = `FluencyJet-Certificate-Lesson-${dayNumber}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-20">
      <div className="max-w-xl mx-auto">
        <header className="mb-10 text-center pt-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-[10px] font-black uppercase tracking-widest mb-4">
            🏆 Hall of Fame
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Your Mastery Wall
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium">
            Download your earned certificates below.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
          </div>
        ) : mastered.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800">
              The wall is empty... for now
            </h2>
            <p className="text-slate-500 text-sm mt-2">
              Complete a lesson to 100% to earn your first entry.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {mastered.map((lesson) => (
              <div
                key={lesson.id}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center justify-between group"
              >
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Lesson {lesson.dayNumber}
                  </h3>
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mt-1">
                    Verified Mastery
                  </p>
                </div>
                <button
                  onClick={() => downloadCert(lesson.dayNumber)}
                  className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg"
                >
                  Get Certificate
                </button>

                {/* Hidden Canvas for Certificate Generation */}
                <div
                  style={{
                    position: "absolute",
                    top: "-10000px",
                    left: "-10000px",
                    pointerEvents: "none",
                  }}
                >
                  <div id={`cert-${lesson.dayNumber}`}>
                    <Certificate
                      userName={user?.name || user?.email || "Student"}
                      trackName={`${lesson.level} Track - Lesson ${lesson.dayNumber}`}
                      date={new Date(
                        lesson.createdAt || Date.now(),
                      ).toLocaleDateString()}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
