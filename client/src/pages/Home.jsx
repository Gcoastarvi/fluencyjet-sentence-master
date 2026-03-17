//client/src/pages/Home.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const [demoWords, setDemoWords] = useState([
  "are",
  "We",
  "planning",
  "a",
  "strategy",
]);
const [selected, setSelected] = useState([]);

const handleWordClick = (word) => {
  setSelected([...selected, word]);
  setDemoWords(demoWords.filter((w) => w !== word));
  if (selected.length === 4) confetti(); // 🎉 Reward them for trying!
};

export default function Home() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // 🎯 Use the login check from your old student/Home.jsx
    const token = localStorage.getItem("token");
    if (token) setUser({ token });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    alert("Logged out successfully!");
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-indigo-100">
      {/* 1. NAVIGATION */}
      <nav className="flex items-center justify-between px-6 py-8 max-w-7xl mx-auto">
        <div className="text-2xl font-black tracking-tighter text-slate-900">
          FLUENCY<span className="text-indigo-600">JET</span>
        </div>
        <div className="flex items-center gap-6">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="text-sm font-black text-indigo-600 uppercase tracking-widest"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm font-bold text-slate-400"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="text-sm font-bold text-slate-600"
            >
              Sign In
            </button>
          )}
        </div>
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

          <div className="flex flex-col sm:flex-row gap-4">
            {user ? (
              <button
                onClick={() => navigate("/dashboard")}
                className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl shadow-indigo-200 hover:scale-105 transition-all"
              >
                Continue Learning →
              </button>
            ) : (
              <button
                onClick={() => navigate("/signup")}
                className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl shadow-slate-200 hover:scale-105 transition-all"
              >
                Start Free Lesson →
              </button>
            )}
          </div>
        </div>

        {/* 3. VISUAL PREVIEW */}
        <div className="relative">
          <div className="absolute -inset-4 bg-indigo-500/10 blur-3xl rounded-[3rem]" />
          <div className="relative bg-slate-50 border border-slate-100 rounded-[3rem] p-4 shadow-2xl">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Live Preview
              </p>
              <h3 className="text-xl font-bold text-slate-900 mb-6">
                நாங்கள் தற்போது ஒரு புதிய உத்தியைத் திட்டமிட்டு வருகிறோம்.
              </h3>
              <div className="flex justify-center gap-2">
                <span className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-indigo-100">
                  We
                </span>
                <span className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-indigo-100">
                  are
                </span>
                <span className="bg-slate-100 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold italic">
                  ...
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 4. THE ROADMAP (As designed before) */}
      <section className="py-24 bg-slate-50 rounded-t-[4rem]">
        {/* ... Paste the Roadmap code from the previous chat here ... */}
      </section>
    </div>
  );
}

<section className="py-24 bg-white">
  <div className="max-w-7xl mx-auto px-6">
    <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
      <div className="max-w-xl">
        <h2 className="text-4xl font-black text-slate-900 mb-4 leading-tight">
          Joined by <span className="text-indigo-600">Masters</span> across the
          globe.
        </h2>
        <p className="text-slate-500 font-medium italic">
          "The fastest way I've found to bridge the gap between thinking in
          Tamil and speaking in English."
        </p>
      </div>
      <div className="flex gap-2">
        <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black">
          4.9
        </div>
        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
          Average Rating <br /> <span className="text-indigo-600">★★★★★</span>
        </div>
      </div>
    </div>

    <div className="grid md:grid-cols-3 gap-8">
      {/* Testimonial 1 */}
      <div className="p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 flex flex-col justify-between">
        <p className="text-slate-600 leading-relaxed mb-8">
          "I tried many apps, but most just teach words. FluencyJet teaches me
          how to build <strong>real sentences</strong>. The typing mode is a
          game changer for my speed."
        </p>
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600">
            A
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">Arun K.</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Software Engineer
            </p>
          </div>
        </div>
      </div>

      {/* Testimonial 2 */}
      <div className="p-8 rounded-[2.5rem] bg-indigo-600 text-white flex flex-col justify-between shadow-2xl shadow-indigo-200">
        <p className="leading-relaxed mb-8 opacity-90">
          "Using Tamil prompts to build English sentences is exactly how my
          brain works. I reached 100% mastery on the Beginner track in just 3
          weeks!"
        </p>
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
            P
          </div>
          <div>
            <p className="text-sm font-black">Priya M.</p>
            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">
              College Student
            </p>
          </div>
        </div>
      </div>

      {/* Testimonial 3 */}
      <div className="p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 flex flex-col justify-between">
        <p className="text-slate-600 leading-relaxed mb-8">
          "The audio repeat mode helped me fix my pronunciation. Now I'm not
          afraid to speak in English meetings at work anymore."
        </p>
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600">
            S
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">Suresh R.</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Business Owner
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>;

<footer className="bg-slate-900 py-20">
  <div className="max-w-4xl mx-auto px-6 text-center">
    <h2 className="text-4xl font-black text-white mb-6">
      Ready to master your first 10 sentences?
    </h2>
    <p className="text-slate-400 mb-10 text-lg">
      Join our community of Tamil learners and start your journey to fluency
      today.
    </p>
    <button
      onClick={() => navigate("/signup")}
      className="bg-indigo-600 text-white px-12 py-5 rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-2xl shadow-indigo-500/20"
    >
      Create My Free Account →
    </button>
    <div className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
      <div className="text-white font-black tracking-tighter text-xl">
        FLUENCY<span className="text-indigo-500">JET</span>
      </div>
      <p className="text-slate-500 text-xs">
        © 2026 FluencyJet. All rights reserved.
      </p>
    </div>
  </div>
</footer>;
