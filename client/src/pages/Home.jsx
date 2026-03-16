//client/src/pages/Home.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

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
