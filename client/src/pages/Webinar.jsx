import React, { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

export default function Webinar() {
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);

  const source = searchParams.get("source") || "direct";
  const track = searchParams.get("track") || "";
  const lesson = searchParams.get("lesson") || "";

  const contextLabel = useMemo(() => {
    if (source.includes("lesson_3")) return "Free Starter Path completed";
    if (source.includes("lesson_2")) return "Lesson 2 completed";
    if (source.includes("lesson_1")) return "Lesson 1 completed";
    if (source.includes("paywall")) return "From locked lesson";
    if (source.includes("signup")) return "From signup";
    return "FluencyJet learner";
  }, [source]);

  function handleSubmit(e) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      phone: form.get("phone"),
      email: form.get("email"),
      goal: form.get("goal"),
      source,
      track,
      lesson,
      contextLabel,
    };

    console.log("[webinar-registration-placeholder]", payload);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden bg-white">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="absolute top-40 -left-20 h-64 w-64 rounded-full bg-emerald-100/70 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 py-12 md:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-700">
                Free Live Zoom Class
              </div>

              <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-6xl">
                Join My Free Live English Fluency Class
              </h1>

              <p className="mt-5 text-lg font-semibold leading-relaxed text-slate-600 md:text-xl">
                Learn how to speak English without translating in your mind — using the FluencyJet sentence-building method.
              </p>

              <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                <p className="font-tamil text-lg font-bold leading-relaxed text-slate-800">
                  தமிழில் நினைத்து English-க்கு translate செய்யாமல் பேசுவது எப்படி என்று என் free live class-ல் கற்றுக்கொள்ளுங்கள்.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#register"
                  className="rounded-2xl bg-violet-600 px-8 py-4 text-base font-black text-white shadow-xl shadow-violet-200 transition hover:-translate-y-1 hover:bg-violet-700"
                >
                  Reserve My Free Seat →
                </a>

                <Link
                  to={track === "intermediate" ? "/i/lessons" : "/b/lessons"}
                  className="rounded-2xl border border-slate-200 bg-white px-8 py-4 text-base font-black text-slate-700 transition hover:bg-slate-50"
                >
                  Continue Learning
                </Link>
              </div>
            </div>

            <div id="register" className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-2xl shadow-slate-200/70">
              {!submitted ? (
                <>
                  <div className="mb-5">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">
                      Register Now
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      Get the Zoom link on WhatsApp
                    </h2>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      Source: {contextLabel}
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-bold text-slate-700">
                        Name
                      </label>
                      <input
                        name="name"
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none focus:border-violet-400 focus:bg-white"
                        placeholder="Your name"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-bold text-slate-700">
                        WhatsApp Number
                      </label>
                      <input
                        name="phone"
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none focus:border-violet-400 focus:bg-white"
                        placeholder="Your WhatsApp number"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-bold text-slate-700">
                        Email
                      </label>
                      <input
                        name="email"
                        type="email"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none focus:border-violet-400 focus:bg-white"
                        placeholder="Your email"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-bold text-slate-700">
                        Main English Goal
                      </label>
                      <select
                        name="goal"
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none focus:border-violet-400 focus:bg-white"
                      >
                        <option value="">Select your goal</option>
                        <option value="job_interview">Job / Interview English</option>
                        <option value="workplace">Workplace English</option>
                        <option value="daily_life">Daily Life English</option>
                        <option value="sentence_formation">Grammar & Sentence Formation</option>
                        <option value="confidence">Speaking Confidence</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-violet-600 px-8 py-4 text-lg font-black text-white shadow-xl shadow-violet-200 transition hover:bg-violet-700"
                    >
                      Reserve My Free Seat
                    </button>

                    <p className="text-center text-xs font-semibold text-slate-400">
                      We will send the class details on WhatsApp.
                    </p>
                  </form>
                </>
              ) : (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
                    🎉
                  </div>
                  <h2 className="text-3xl font-black text-slate-950">
                    You’re registered!
                  </h2>
                  <p className="mt-3 text-base font-semibold leading-relaxed text-slate-600">
                    We’ll send the Zoom link on WhatsApp before the live class.
                  </p>
                  <p className="font-tamil mt-4 text-base font-bold leading-relaxed text-slate-700">
                    நீங்கள் register செய்துவிட்டீர்கள். Zoom link-ஐ live class-க்கு முன் WhatsApp-ல் அனுப்புகிறோம்.
                  </p>

                  <Link
                    to={track === "intermediate" ? "/i/lessons" : "/b/lessons"}
                    className="mt-8 inline-flex rounded-2xl bg-violet-600 px-8 py-4 text-base font-black text-white shadow-xl shadow-violet-200"
                  >
                    Continue Learning →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Why grammar alone is not enough",
              ta: "Grammar தெரிந்தும் ஏன் பலரால் பேச முடியவில்லை",
            },
            {
              title: "How to build sentences automatically",
              ta: "English sentences-ஐ automatic-ஆக உருவாக்குவது எப்படி",
            },
            {
              title: "How to practice daily with FluencyJet",
              ta: "FluencyJet மூலம் தினமும் speaking confidence பெறுவது எப்படி",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-100">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-xl">
                ✓
              </div>
              <h3 className="text-xl font-black text-slate-950">{item.title}</h3>
              <p className="font-tamil mt-3 text-base font-bold leading-relaxed text-slate-600">
                {item.ta}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-lg shadow-slate-100">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">
              Who is this for?
            </p>
            <ul className="mt-5 space-y-3 text-base font-bold text-slate-700">
              <li>• Tamil speakers who understand English but struggle to speak</li>
              <li>• Students, job seekers, professionals, business owners, and homemakers</li>
              <li>• Anyone who wants to speak simple English confidently</li>
            </ul>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-lg shadow-slate-100">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">
              Your Coach
            </p>
            <h3 className="mt-4 text-2xl font-black text-slate-950">
              Aravind • English Coach
            </h3>
            <p className="mt-3 text-base font-semibold leading-relaxed text-slate-600">
              Language teacher, memory trainer, FluencyJet founder, and Guinness World Record holder in memory.
            </p>
            <p className="font-tamil mt-3 text-base font-bold leading-relaxed text-slate-700">
              English Coach Aravind நடத்தும் live class.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20">
        <h2 className="mb-6 text-3xl font-black text-slate-950">FAQ</h2>
        <div className="space-y-4">
          {[
            ["Is this class free?", "Yes, this live class is free."],
            ["Will the class be in Tamil or English?", "The class will be in simple English with Tamil explanation."],
            ["Will I get the Zoom link?", "Yes, we will send the Zoom link on WhatsApp before the class."],
          ].map(([q, a]) => (
            <div key={q} className="rounded-3xl border border-slate-100 bg-white p-6">
              <h3 className="font-black text-slate-950">{q}</h3>
              <p className="mt-2 font-semibold text-slate-600">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
