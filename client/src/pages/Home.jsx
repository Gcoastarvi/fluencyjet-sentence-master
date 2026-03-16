import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-indigo-100">
      {/* 1. NAVIGATION */}
      <nav className="flex items-center justify-between px-6 py-8 max-w-7xl mx-auto">
        <div className="text-2xl font-black tracking-tighter text-slate-900">
          FLUENCY<span className="text-indigo-600">JET</span>
        </div>
        <button
          onClick={() => navigate("/login")}
          className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          Sign In
        </button>
      </nav>

      {/* 2. HERO SECTION */}
      <main className="max-w-7xl mx-auto px-6 pt-16 pb-24 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <span className="inline-block px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 text-xs font-black uppercase tracking-widest mb-6">
            Tamil-to-English Mastery
          </span>
          <h1 className="text-6xl sm:text-7xl font-black text-slate-900 leading-[0.9] tracking-tight mb-8">
            Speak English <br />
            <span className="text-indigo-600">with Confidence.</span>
          </h1>
          <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-lg mb-10">
            Stop memorizing word lists. Master 270+ essential English sentence
            patterns through our interactive 3-step practice system.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => navigate("/signup")}
              className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl shadow-slate-200 hover:scale-105 active:scale-95 transition-all"
            >
              Start Free Lesson →
            </button>
            <button className="bg-white border-2 border-slate-100 text-slate-600 px-10 py-5 rounded-2xl font-black text-lg hover:bg-slate-50 transition-all">
              Watch Demo
            </button>
          </div>
        </div>

        {/* 3. VISUAL SHOWCASE (The "Teaser") */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500 to-purple-600 opacity-20 blur-3xl rounded-[3rem]" />
          <div className="relative bg-slate-50 border border-slate-100 rounded-[3rem] p-4 shadow-2xl">
            {/* Mock Practice UI */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="h-3 w-3 rounded-full bg-rose-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Current Sentence
              </p>
              <h3 className="text-xl font-bold text-slate-900 mb-6">
                நாங்கள் தற்போது ஒரு புதிய உத்தியைத் திட்டமிட்டு வருகிறோம்.
              </h3>
              <div className="space-y-3">
                <div className="h-14 w-full bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center px-4 text-slate-300 italic">
                  Type the English mastery goal...
                </div>
                <div className="flex gap-2">
                  <span className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold">
                    We
                  </span>
                  <span className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold">
                    are
                  </span>
                  <span className="bg-slate-100 text-slate-400 px-4 py-2 rounded-lg text-xs font-bold">
                    currently
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <section className="py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black text-slate-900 mb-4">
                The Mastery Roadmap
              </h2>
              <p className="text-slate-500 font-medium">
                A structured path from your first Tamil sentence to English
                fluency.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Beginner Phase */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">
                  🌱
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">
                  Beginner
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  120 Lessons • Core Structures
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />{" "}
                    Subject-Verb Basics
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />{" "}
                    Daily Conversations
                  </div>
                </div>
              </div>

              {/* Intermediate Phase */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border-2 border-indigo-100 relative overflow-hidden scale-105 z-10">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">
                  🚀
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">
                  Intermediate
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  150 Lessons • Complex Tenses
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs font-bold text-indigo-600">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />{" "}
                    Workplace Communication
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-indigo-600">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />{" "}
                    Advanced Grammar Logic
                  </div>
                </div>
              </div>

              {/* Mastery Phase */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">
                  🎓
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">
                  Mastery
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  Professional Certification
                </p>
                <div className="space-y-3 text-slate-300">
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="h-2 w-2 rounded-full bg-slate-200" />{" "}
                    Native-level Fluency
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
