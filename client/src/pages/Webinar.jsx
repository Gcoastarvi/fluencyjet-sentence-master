// client/src/pages/Webinar.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

function trackGA(eventName, params = {}) {
  try {
    window.gtag?.("event", eventName, params);
  } catch {}
}

function trackMeta(eventName, params = {}) {
  try {
    window.fbq?.("trackCustom", eventName, params);
  } catch {}
}

export default function Webinar() {
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);

  const [showRest, setShowRest] = useState(false);
  const [formStarted, setFormStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowRest(true), 700);
    return () => clearTimeout(t);
  }, []);

  const source = searchParams.get("source") || "direct";
  const track = searchParams.get("track") || "";
  const lesson = searchParams.get("lesson") || "";

  const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/YOUR_GROUP_INVITE_LINK";

  const WEBINAR_DATE = "Sunday, 9 June";
  const WEBINAR_TIME = "7:00 PM to 8:30 PM IST";

  const contextLabel = useMemo(() => {
    if (source.includes("lesson_3")) return "Free Starter Path completed";
    if (source.includes("lesson_2")) return "Lesson 2 completed";
    if (source.includes("lesson_1")) return "Lesson 1 completed";
    if (source.includes("paywall")) return "From locked lesson";
    if (source.includes("signup")) return "From signup";
    return "FluencyJet learner";
  }, [source]);

  async function handleSubmit(e) {
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

    React.useEffect(() => {
      const params = {
        page: "webinar",
        source,
        track,
        lesson,
        context_label: contextLabel,
      };

      trackGA("webinar_page_view", params);
      trackMeta("WebinarPageView", params);
    }, [source, track, lesson, contextLabel]);

    try {
      await fetch(
        "https://script.google.com/macros/s/AKfycbwA3QURJ2X-D_Ww4GfhteuUxghA7PLfHuHf7hlrlWEKrCBiShAtqpPLgFwneJP2fn-V/exec",
        {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      setSubmitted(true);

      const submitParams = {
        source,
        track,
        lesson,
        context_label: contextLabel,
        goal: payload.goal || "not_selected",
      };

      trackGA("webinar_form_submit", submitParams);
      trackMeta("WebinarFormSubmit", submitParams);

      setTimeout(() => {
        const redirectParams = {
          source,
          track,
          lesson,
          context_label: contextLabel,
        };

        trackGA("webinar_whatsapp_redirect", redirectParams);
        trackMeta("WebinarWhatsAppRedirect", redirectParams);

        window.location.href = WHATSAPP_GROUP_URL;
      }, 1200);
    } catch (error) {
      console.error("Webinar registration failed:", error);
      alert("Something went wrong. Please try again.");
    }
  }

  function handleFormStart() {
    if (formStarted) return;

    setFormStarted(true);

    const params = {
      source,
      track,
      lesson,
      context_label: contextLabel,
    };

    trackGA("webinar_form_start", params);
    trackMeta("WebinarFormStart", params);
  }

  function handleCtaClick(location) {
    const params = {
      location,
      source,
      track,
      lesson,
      context_label: contextLabel,
    };

    trackGA("webinar_cta_click", params);
    trackMeta("WebinarCTAClick", params);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden bg-[#07111f] text-white">
        {/* Premium background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.42),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.22),transparent_34%)]" />
        <div className="absolute -right-28 top-10 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -left-28 bottom-0 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            {/* LEFT: Promise + credibility */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/30 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-100 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Free Live Zoom Class for Tamil Speakers
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                Speak English Without Fear, Hesitation, or Self-Doubt
              </h1>

              <p className="mt-5 max-w-3xl text-2xl font-black leading-tight text-emerald-300 sm:text-3xl">
                No Fear. No Confusion. Just Results.
              </p>

              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-200 sm:text-xl">
                Build sentences faster using my Ultimate Memory Method and the
                FluencyJet Sentence Master App.
              </p>

              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-300 sm:text-lg">
                A step-by-step live masterclass for learners who know English
                words but struggle to speak fluently.
              </p>

              <div className="mt-6 rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/10 p-5 backdrop-blur">
                <p className="font-tamil text-base font-bold leading-8 text-emerald-50 sm:text-lg">
                  English words தெரிந்தும் பேசும்போது பயம், தயக்கம், குழப்பம்
                  வருகிறதா? Simple sentence patterns மூலம் confident-ஆக பேசுவது
                  எப்படி என்று இந்த free live class-ல் கற்றுக்கொள்ளுங்கள்.
                </p>
              </div>

              {/* Coach credibility card */}
              <div className="mt-6 flex items-center gap-4 rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <img
                  src="/avatar-fallback.png"
                  alt="Aravind, FluencyJet English Coach"
                  width="72"
                  height="72"
                  loading="eager"
                  decoding="async"
                  className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/20 sm:h-[72px] sm:w-[72px]"
                />

                <div>
                  <p className="text-base font-black text-white sm:text-lg">
                    Aravind • English Coach & Memory Trainer
                  </p>
                  <p className="mt-1 text-sm font-bold leading-6 text-slate-300">
                    Guinness World Record holder • Founder of FluencyJet •
                    35,000+ students trained
                  </p>
                </div>
              </div>

              {/* Fast trust badges */}
              {/* Date and time block */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.25rem] border border-yellow-300/20 bg-yellow-300/10 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-200">
                    Live Class Date
                  </p>
                  <p className="mt-2 text-xl font-black text-white">
                    {WEBINAR_DATE}
                  </p>
                </div>

                <div className="rounded-[1.25rem] border border-emerald-300/20 bg-emerald-300/10 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
                    Class Time
                  </p>
                  <p className="mt-2 text-xl font-black text-white">
                    {WEBINAR_TIME}
                  </p>
                </div>
              </div>

              {/* Fast trust badges */}
              <div className="mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur">
                  <p className="text-lg font-black text-yellow-300">Free</p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">
                    Live Class
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur">
                  <p className="text-lg font-black text-emerald-300">Tamil</p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">
                    Explanation
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur">
                  <p className="text-lg font-black text-violet-200">Method</p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">
                    Sentence First
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur">
                  <p className="text-lg font-black text-blue-200">Zoom</p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">
                    Link on WhatsApp
                  </p>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#register"
                  onClick={() => handleCtaClick("hero")}
                  className="inline-flex h-14 items-center justify-center rounded-2xl bg-yellow-400 px-7 text-base font-black text-slate-950 shadow-xl shadow-yellow-500/20 transition hover:-translate-y-0.5 hover:bg-yellow-300"
                >
                  Reserve My Free Seat →
                </a>

                <Link
                  to={track === "intermediate" ? "/i/lessons" : "/b/lessons"}
                  className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-7 text-base font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"
                >
                  Continue Learning
                </Link>
              </div>
            </div>

            {/* RIGHT: Registration form */}
            <div
              id="register"
              className="rounded-[2rem] border border-white/10 bg-white p-5 text-slate-950 shadow-2xl shadow-violet-950/30 sm:p-6 lg:p-7"
            >
              {!submitted ? (
                <>
                  <div className="mb-5">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
                      Register Now
                    </p>
                    <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
                      Join the WhatsApp group to get the Zoom link
                    </h2>
                    <p className="mt-2 text-sm font-bold text-slate-600">
                      Source: {contextLabel}
                    </p>

                    <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
                        Upcoming Live Webinar
                      </p>
                      <p className="mt-2 text-base font-black text-slate-950">
                        {WEBINAR_DATE} • {WEBINAR_TIME}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl bg-violet-50 p-3">
                        <p className="text-lg font-black text-violet-700">
                          35K+
                        </p>
                        <p className="text-[11px] font-bold text-slate-600">
                          Students
                        </p>
                      </div>
                      <div className="rounded-2xl bg-emerald-50 p-3">
                        <p className="text-lg font-black text-emerald-700">
                          Live
                        </p>
                        <p className="text-[11px] font-bold text-slate-600">
                          Zoom
                        </p>
                      </div>
                      <div className="rounded-2xl bg-yellow-50 p-3">
                        <p className="text-lg font-black text-yellow-700">
                          Free
                        </p>
                        <p className="text-[11px] font-bold text-slate-600">
                          Seat
                        </p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label
                        htmlFor="webinar-name"
                        className="mb-1 block text-sm font-bold text-slate-800"
                      >
                        Name
                      </label>
                      <input
                        id="webinar-name"
                        name="name"
                        required
                        onFocus={handleFormStart}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                        placeholder="Your name"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="webinar-phone"
                        className="mb-1 block text-sm font-bold text-slate-800"
                      >
                        WhatsApp Number
                      </label>
                      <input
                        id="webinar-phone"
                        name="phone"
                        type="tel"
                        required
                        onFocus={handleFormStart}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                        placeholder="Your WhatsApp number"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="webinar-email"
                        className="mb-1 block text-sm font-bold text-slate-800"
                      >
                        Email <span className="text-slate-500">(optional)</span>
                      </label>
                      <input
                        id="webinar-email"
                        name="email"
                        type="email"
                        onFocus={handleFormStart}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                        placeholder="Your email"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="webinar-goal"
                        className="mb-1 block text-sm font-bold text-slate-800"
                      >
                        Main English Goal{" "}
                        <span className="text-slate-500">(optional)</span>
                      </label>
                      <select
                        id="webinar-goal"
                        name="goal"
                        onFocus={handleFormStart}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-950 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                      >
                        <option value="">Select your goal</option>
                        <option value="job_interview">
                          Job / Interview English
                        </option>
                        <option value="workplace">Workplace English</option>
                        <option value="daily_life">Daily Life English</option>
                        <option value="sentence_formation">
                          Grammar & Sentence Formation
                        </option>
                        <option value="confidence">Speaking Confidence</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-violet-700 px-8 py-4 text-lg font-black text-white shadow-xl shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-800"
                    >
                      Reserve My Free Seat & Join WhatsApp Group
                    </button>

                    <p className="text-center text-sm font-bold text-violet-700">
                      After registration, you’ll be redirected to our WhatsApp
                      group.
                    </p>

                    <p className="text-center text-xs font-semibold leading-relaxed text-slate-600">
                      The Zoom link and class reminders will be shared inside
                      the WhatsApp group.
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
                    Redirecting you to the WhatsApp group now. The Zoom link
                    will be shared inside the group before the class.
                  </p>
                  <p className="font-tamil mt-4 text-base font-bold leading-relaxed text-slate-700">
                    இப்போது உங்களை WhatsApp group-க்கு அழைத்துச் செல்கிறோம்.
                    Zoom link group-ல் share செய்யப்படும்.
                  </p>

                  <a
                    href={WHATSAPP_GROUP_URL}
                    onClick={() => {
                      const params = {
                        source,
                        track,
                        lesson,
                        context_label: contextLabel,
                      };

                      trackGA("webinar_whatsapp_manual_click", params);
                      trackMeta("WebinarWhatsAppManualClick", params);
                    }}
                    className="mt-6 inline-flex rounded-2xl bg-emerald-600 px-8 py-4 text-base font-black text-white shadow-xl shadow-emerald-200"
                  >
                    Join WhatsApp Group →
                  </a>

                  <Link
                    to={track === "intermediate" ? "/i/lessons" : "/b/lessons"}
                    className="mt-8 inline-flex rounded-2xl bg-violet-700 px-8 py-4 text-base font-black text-white shadow-xl shadow-violet-200"
                  >
                    Continue Learning →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {showRest && (
        <>
          <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-violet-700">
                What You’ll Learn
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                A simple method to build English sentences faster
              </h2>
              <p className="mt-5 text-lg font-semibold leading-8 text-slate-600">
                This free class is designed to help Tamil speakers understand
                why they hesitate and how to practise English sentence-making
                the right way.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Stop translating in your mind",
                  text: "Understand why Tamil-to-English translation slows your speaking.",
                  ta: "தமிழிலிருந்து English-க்கு translate செய்வதை எப்படி குறைப்பது.",
                },
                {
                  title: "Build sentences with simple patterns",
                  text: "Learn how to create many useful English sentences from one pattern.",
                  ta: "ஒரு simple pattern மூலம் பல sentences உருவாக்குவது எப்படி.",
                },
                {
                  title: "Speak without freezing",
                  text: "Train your brain to recall sentence structures faster while speaking.",
                  ta: "பேசும்போது sentence உடனே வர training செய்வது எப்படி.",
                },
                {
                  title: "Use grammar practically",
                  text: "Learn grammar as speaking patterns, not confusing rules.",
                  ta: "Grammar-ஐ rules போல இல்லாமல் speaking pattern போல கற்றுக்கொள்ளுங்கள்.",
                },
                {
                  title: "Practise daily with FluencyJet",
                  text: "See how reorder, typing, audio practice, XP, and streaks build fluency.",
                  ta: "FluencyJet app மூலம் தினமும் practice செய்வது எப்படி.",
                },
                {
                  title: "Create your fluency path",
                  text: "Know what to practise after the class so you don’t feel lost again.",
                  ta: "Class முடிந்த பிறகு என்ன practice செய்ய வேண்டும் என்று தெரிந்துகொள்ளுங்கள்.",
                },
              ].map((item, index) => (
                <div
                  key={item.title}
                  className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-100 transition hover:-translate-y-1 hover:shadow-2xl"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-lg font-black text-violet-700">
                    {index + 1}
                  </div>
                  <h3 className="text-xl font-black leading-snug text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-base font-semibold leading-7 text-slate-600">
                    {item.text}
                  </p>
                  <p className="font-tamil mt-4 text-base font-bold leading-7 text-slate-700">
                    {item.ta}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <a
                href="#register"
                onClick={() => handleCtaClick("what_youll_learn")}
                className="inline-flex h-14 items-center justify-center rounded-2xl bg-violet-700 px-8 text-base font-black text-white shadow-xl shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-800"
              >
                Reserve My Free Seat
              </a>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-6 pb-16">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-lg shadow-slate-100">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">
                  Who is this for?
                </p>
                <ul className="mt-5 space-y-3 text-base font-bold text-slate-700">
                  <li>
                    • Tamil speakers who understand English but struggle to
                    speak
                  </li>
                  <li>
                    • Students, job seekers, professionals, business owners, and
                    homemakers
                  </li>
                  <li>
                    • Anyone who wants to speak simple English confidently
                  </li>
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
                  Language teacher, memory trainer, FluencyJet founder, and
                  Guinness World Record holder in memory.
                </p>
                <p className="font-tamil mt-3 text-base font-bold leading-relaxed text-slate-700">
                  English Coach Aravind நடத்தும் live class.
                </p>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 lg:px-8">
            <div className="rounded-[2rem] bg-gradient-to-br from-violet-800 to-slate-950 px-6 py-10 text-center text-white shadow-2xl shadow-violet-200 sm:px-10">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-yellow-300">
                Free Live Zoom Class
              </p>

              <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
                Ready to speak English without fear, hesitation, or self-doubt?
              </h2>

              <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-300">
                Register for {WEBINAR_DATE} at {WEBINAR_TIME}, join the WhatsApp
                group, and learn how to build confident English sentences using
                my memory method.
              </p>

              <a
                href="#register"
                onClick={() => handleCtaClick("mid_page_cta")}
                className="mt-7 inline-flex h-14 items-center justify-center rounded-2xl bg-yellow-400 px-8 text-base font-black text-slate-950 shadow-xl shadow-yellow-500/20 hover:bg-yellow-300"
              >
                Reserve My Free Seat & Join the Group →
              </a>
            </div>
          </section>

          <section className="mx-auto max-w-4xl px-6 pb-20">
            <h2 className="mb-6 text-3xl font-black text-slate-950">FAQ</h2>
            <div className="space-y-4">
              {[
                ["Is this class free?", "Yes, this live class is free."],
                [
                  "Will the class be in Tamil or English?",
                  "The class will be in simple English with Tamil explanation.",
                ],
                [
                  "Will I get the Zoom link?",
                  "Yes, we will send the Zoom link on WhatsApp before the class.",
                ],
                [
                  "Do I need to join the WhatsApp group?",
                  "Yes. After registration, you will be redirected to the WhatsApp group. The Zoom link and class reminders will be shared inside the group.",
                ],
                [
                  "What happens after the free class?",
                  "You can continue practising English sentence formation inside the FluencyJet web app using guided lessons, reorder practice, typing practice, audio practice, XP, and streaks.",
                ],
              ].map(([q, a]) => (
                <div
                  key={q}
                  className="rounded-3xl border border-slate-100 bg-white p-6"
                >
                  <h3 className="font-black text-slate-950">{q}</h3>
                  <p className="mt-2 font-semibold text-slate-600">{a}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      <footer className="border-t border-slate-200 bg-white px-5 py-8 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold leading-6 text-slate-500">
            This site is not a part of the Facebook website or Meta Platforms,
            Inc. Additionally, this site is not endorsed by Facebook or Meta in
            any way. Facebook is a trademark of Meta Platforms, Inc.
          </p>

          <p className="mt-4 text-xs font-semibold leading-6 text-slate-500">
            Results from this class may vary from person to person. Fluency
            improvement depends on your current level, consistency, and daily
            practice.
          </p>

          <p className="mt-4 text-xs font-bold text-slate-600">
            © {new Date().getFullYear()} FluencyJet. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
