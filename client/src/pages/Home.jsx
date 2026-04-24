//client/src/pages/Home.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const primaryCta = "/level-check";
  const lessonsPath = "/b/lessons";

  return (
    <main className="min-h-screen bg-white text-slate-950 overflow-hidden">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[22px] md:text-[24px] leading-none tracking-tight">
              <span className="font-extrabold text-purple-700">FluencyJet</span>
              <span className="ml-2 font-medium text-purple-700/90">
                Sentence Master
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-700 lg:flex">
            <a href="#how-it-works" className="hover:text-purple-700">
              How it works
            </a>
            <a href="#practice" className="hover:text-purple-700">
              Practice
            </a>
            <a href="#lessons" className="hover:text-purple-700">
              Lessons
            </a>
            <a href="#pricing" className="hover:text-purple-700">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden rounded-full px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 sm:inline-flex"
            >
              Login
            </Link>
            <Link
              to={primaryCta}
              className="rounded-full bg-yellow-400 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-yellow-300/30 transition hover:-translate-y-0.5 hover:bg-yellow-500"
            >
              Start Free
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(109,40,217,0.13),transparent_34%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.11),transparent_30%)]" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
              <span className="h-2 w-2 rounded-full bg-purple-600" />
              Daily sentence practice for spoken English
            </div>

            <h1 className="max-w-4xl text-5xl font-black tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl lg:leading-[0.95]">
              Build English sentences instantly.
              <span className="block text-purple-700">Speak confidently.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              Stop translating in your mind. Practice real sentence formation
              with guided lessons, reorder drills, typing practice, audio
              training, XP, and streaks — so English comes faster when you
              speak.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link
                to={primaryCta}
                className="inline-flex h-14 items-center justify-center rounded-full bg-yellow-400 px-8 text-base font-extrabold text-slate-950 shadow-xl shadow-yellow-300/30 transition hover:-translate-y-0.5 hover:bg-yellow-500"
              >
                Start Free Level Check
              </Link>
              <Link
                to={lessonsPath}
                className="inline-flex h-14 items-center justify-center rounded-full border border-purple-200 bg-white px-8 text-base font-extrabold text-purple-800 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:bg-purple-50"
              >
                Explore Lessons
              </Link>
            </div>

            <p className="mt-4 text-sm font-semibold text-slate-500">
              Free • Takes 2 minutes • Get your recommended starting level
            </p>

            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              <TrustStat number="Beginner" label="friendly" />
              <TrustStat number="Daily" label="practice" />
              <TrustStat number="XP" label="motivation" />
            </div>
          </div>

          <HeroMockup />
        </div>
      </section>

      {/* PROBLEM */}
      <section className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="The real problem"
            title="You know English… but sentences don’t come quickly?"
            subtitle="Many learners know words and grammar rules, but speaking becomes difficult because sentence formation is not automatic yet."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <ProblemCard
              title="I translate in my mind"
              text="You think in your mother tongue first, then try to convert it into English."
            />
            <ProblemCard
              title="I know words, but I freeze"
              text="The vocabulary is there, but the sentence does not come at the right time."
            />
            <ProblemCard
              title="My sentence order feels wrong"
              text="You are unsure whether your English sounds correct."
            />
            <ProblemCard
              title="I need practice, not more theory"
              text="You want to speak better through daily practical training."
            />
          </div>
        </div>
      </section>

      {/* DEMO PREVIEW */}
      <section id="practice" className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="See the product"
            title="See how sentence practice works."
            subtitle="You don’t just watch lessons. You build sentences, correct word order, type answers, speak aloud, and earn XP as you improve."
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            <AppScreen
              badge="Lesson"
              title="Choose your daily lesson"
              body="Start with simple patterns and move step by step."
            />
            <AppScreen
              badge="Practice"
              title="Build the sentence"
              body="Reorder, type, repeat, and train sentence recall."
              highlighted
            />
            <AppScreen
              badge="Progress"
              title="Earn XP and streaks"
              body="Get instant feedback and stay motivated daily."
            />
          </div>

          <div className="mt-10 text-center">
            <Link
              to={primaryCta}
              className="inline-flex h-14 items-center justify-center rounded-full bg-purple-700 px-8 text-base font-extrabold text-white shadow-xl shadow-purple-300/30 transition hover:-translate-y-0.5 hover:bg-purple-800"
            >
              Try a Practice Lesson
            </Link>
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="bg-gradient-to-b from-white to-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="The solution"
            title="Sentence Master trains the missing skill: sentence formation."
            subtitle="Fluency improves when your brain repeatedly builds correct sentence patterns. Every practice mode is designed to make sentence-making faster and more natural."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon="↔"
              title="Reorder Practice"
              text="Fix word order and understand sentence structure naturally."
            />
            <FeatureCard
              icon="⌨"
              title="Typing Practice"
              text="Build sentences from memory and improve recall speed."
            />
            <FeatureCard
              icon="🎙"
              title="Audio Practice"
              text="Repeat useful patterns and train your speaking confidence."
            />
            <FeatureCard
              icon="⚡"
              title="XP & Streaks"
              text="Stay consistent with rewards, progress, and daily momentum."
            />
          </div>
        </div>
      </section>

      {/* LEVEL CHECK */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-purple-950 via-purple-700 to-blue-600 p-8 text-white shadow-2xl shadow-purple-300/40 sm:p-12 lg:p-16">
            <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="mb-4 text-sm font-extrabold uppercase tracking-[0.25em] text-purple-100">
                  Free diagnosis
                </p>
                <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
                  Not sure where to start?
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-purple-50">
                  Take a quick level check and get your recommended practice
                  path — Beginner or Intermediate.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Link
                    to={primaryCta}
                    className="inline-flex h-14 items-center justify-center rounded-full bg-yellow-400 px-8 text-base font-extrabold text-slate-950 shadow-xl shadow-yellow-300/20 transition hover:-translate-y-0.5 hover:bg-yellow-500"
                  >
                    Find My Starting Level
                  </Link>
                  <span className="text-sm font-semibold text-purple-100">
                    Free • Quick • No pressure
                  </span>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/20 bg-white/12 p-6 backdrop-blur">
                <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
                  <p className="text-sm font-extrabold text-purple-700">
                    Level Check
                  </p>
                  <h3 className="mt-2 text-2xl font-black">
                    Get your practice path
                  </h3>
                  <div className="mt-5 space-y-3">
                    <MiniCheck text="10 simple questions" />
                    <MiniCheck text="Beginner / Intermediate result" />
                    <MiniCheck text="Recommended first lesson" />
                  </div>
                  <div className="mt-6 rounded-2xl bg-purple-50 p-4 text-sm font-bold text-purple-800">
                    Your path: Beginner Track → Lesson 1
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="How it works"
            title="Your daily path to sentence fluency"
            subtitle="A simple practice system that helps you start correctly, practice daily, and track real progress."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <StepCard
              number="01"
              title="Check your level"
              text="Start with a quick diagnosis and get the right track."
            />
            <StepCard
              number="02"
              title="Practice sentence patterns"
              text="Use guided exercises based on real spoken English."
            />
            <StepCard
              number="03"
              title="Build automatic recall"
              text="Repeat useful patterns until sentences come faster."
            />
            <StepCard
              number="04"
              title="Track progress"
              text="Earn XP, complete lessons, and build your streak."
            />
          </div>

          <div className="mt-10 text-center">
            <Link
              to={primaryCta}
              className="inline-flex h-14 items-center justify-center rounded-full bg-yellow-400 px-8 text-base font-extrabold text-slate-950 shadow-xl shadow-yellow-300/30 transition hover:-translate-y-0.5 hover:bg-yellow-500"
            >
              Start Free Level Check
            </Link>
          </div>
        </div>
      </section>

      {/* TRANSFORMATION */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Transformation"
            title="From slow translation to confident speaking"
            subtitle="Sentence Master is designed to move you from “I know English but I can’t speak” to “I can form sentences faster and respond with confidence.”"
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <BeforeAfterCard
              type="Before"
              quote="I understand English, but I get stuck while speaking."
              points={[
                "Slow sentence formation",
                "Fear of wrong grammar",
                "Too much translation",
                "Low confidence",
              ]}
            />
            <BeforeAfterCard
              type="After"
              quote="I can build simple sentences quickly and speak with more confidence."
              points={[
                "Faster sentence recall",
                "Better word order",
                "More daily practice",
                "Stronger speaking confidence",
              ]}
              positive
            />
          </div>
        </div>
      </section>

      {/* WHY IT WORKS */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.25em] text-purple-700">
              Why it works
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Fluency comes from active sentence practice.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Grammar knowledge is useful, but speaking needs speed. Sentence
              Master trains you to recall patterns, arrange words, and produce
              sentences actively — the same skill you need in real
              conversations.
            </p>
          </div>

          <div className="grid gap-4">
            <MethodCard
              title="Active recall"
              text="You produce answers instead of passively watching."
            />
            <MethodCard
              title="Pattern repetition"
              text="You repeat useful sentence structures until they feel natural."
            />
            <MethodCard
              title="Real-life usage"
              text="Lessons are based on daily speaking situations."
            />
            <MethodCard
              title="Daily consistency"
              text="XP, streaks, and progress make practice easier to continue."
            />
          </div>
        </div>
      </section>

      {/* LESSON PATH */}
      <section id="lessons" className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Lesson path"
            title="Start simple. Grow into real communication."
            subtitle="Begin with basic sentence patterns, then progress into daily situations, questions, answers, and real conversations."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <LessonCard title="Identity" text="I am… / You are… / He is…" />
            <LessonCard
              title="Daily Life"
              text="I wake up… / I go… / I need…"
            />
            <LessonCard
              title="Questions"
              text="What is…? / Where is…? / Can I…?"
            />
            <LessonCard
              title="Real Situations"
              text="Shopping, travel, work, study, and daily conversation"
            />
          </div>

          <div className="mt-10 text-center">
            <Link
              to={lessonsPath}
              className="inline-flex h-14 items-center justify-center rounded-full border border-purple-200 bg-white px-8 text-base font-extrabold text-purple-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-purple-50"
            >
              Explore Lessons
            </Link>
          </div>
        </div>
      </section>

      {/* GAMIFICATION */}
      <section className="bg-slate-950 py-20 text-white sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionHeaderDark
            eyebrow="Motivation system"
            title="Stay motivated every day."
            subtitle="Earn XP, protect your streak, complete lessons, and see your progress grow — one practice session at a time."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <GameCard
              title="XP rewards"
              text="Get instant feedback and points for correct practice."
            />
            <GameCard
              title="Daily streaks"
              text="Build a habit with small wins every day."
            />
            <GameCard
              title="Progress tracking"
              text="Know exactly how far you have improved."
            />
            <GameCard
              title="Leaderboard"
              text="Stay inspired by friendly competition."
            />
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.25em] text-purple-700">
                Trust
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                Built by a language coach who understands learning speed.
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                FluencyJet is created by an experienced language teacher, memory
                trainer, and coach who has trained thousands of learners to
                learn faster and communicate better.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <CredCard
                  title="Guinness World Record"
                  text="Memory training credibility"
                />
                <CredCard
                  title="35,000+ students"
                  text="Trained through learning programs"
                />
                <CredCard
                  title="Language coach"
                  text="Practical English and fluency focus"
                />
                <CredCard
                  title="Memory method"
                  text="Designed for faster learning"
                />
              </div>
            </div>

            <div className="grid gap-5">
              <Testimonial text="Before this, I knew words but struggled to speak. Sentence practice helped me form sentences faster." />
              <Testimonial text="This is not like a normal grammar class. I actually practice making sentences." />
              <Testimonial text="The XP and daily lessons helped me stay consistent." />
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Pricing"
            title="Start free. Upgrade when you are ready."
            subtitle="Take your level check and try your first lessons free. Unlock more practice, advanced lessons, and full progress features when you are ready."
          />

          <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2">
            <PricingCard
              title="Free"
              description="Start your journey and discover your level."
              features={[
                "Level check",
                "Starter lessons",
                "Basic practice",
                "Progress preview",
              ]}
              cta="Start Free"
              to={primaryCta}
            />
            <PricingCard
              title="Pro"
              description="Unlock the complete sentence practice system."
              features={[
                "Full lesson access",
                "All practice modes",
                "XP, streaks, leaderboard",
                "Beginner + Intermediate tracks",
              ]}
              cta="Upgrade to Pro"
              to="/pricing"
              featured
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="FAQ"
            title="Questions learners ask before starting"
            subtitle="Simple answers to help you begin with confidence."
          />

          <div className="mt-10 divide-y divide-slate-200 rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
            <FaqItem
              q="Is this a grammar course?"
              a="No. Grammar is included, but the main focus is sentence formation and spoken English practice."
            />
            <FaqItem
              q="Is this useful for beginners?"
              a="Yes. The level check helps you start with the right track."
            />
            <FaqItem
              q="Will this improve speaking?"
              a="It helps you practice the sentence-building skill needed for speaking. With daily practice, you can reduce hesitation and improve confidence."
            />
            <FaqItem
              q="How long should I practice daily?"
              a="Start with 10–15 minutes a day. Consistency is more important than long sessions."
            />
            <FaqItem
              q="Can I use it on mobile?"
              a="Yes. The experience is designed for mobile-first practice."
            />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 pb-20 sm:px-6 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-gradient-to-br from-purple-950 via-purple-700 to-blue-600 px-6 py-16 text-center text-white shadow-2xl shadow-purple-300/40 sm:px-12 lg:px-20">
          <h2 className="mx-auto max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
            Ready to speak English with more confidence?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-purple-50">
            Start with a quick level check and get your recommended practice
            path.
          </p>
          <div className="mt-8">
            <Link
              to={primaryCta}
              className="inline-flex h-14 items-center justify-center rounded-full bg-yellow-400 px-8 text-base font-extrabold text-slate-950 shadow-xl shadow-yellow-300/20 transition hover:-translate-y-0.5 hover:bg-yellow-500"
            >
              Start Free Level Check
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ---------------- SMALL COMPONENTS ---------------- */

function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-extrabold uppercase tracking-[0.25em] text-purple-700">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-lg leading-8 text-slate-600">{subtitle}</p>
    </div>
  );
}

function SectionHeaderDark({ eyebrow, title, subtitle }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-extrabold uppercase tracking-[0.25em] text-yellow-300">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-lg leading-8 text-slate-300">{subtitle}</p>
    </div>
  );
}

function TrustStat({ number, label }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-center shadow-sm">
      <div className="text-lg font-black text-slate-950">{number}</div>
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
      <div className="absolute -left-6 top-10 hidden rounded-2xl bg-white p-4 shadow-xl shadow-purple-200/50 lg:block">
        <p className="text-xs font-extrabold text-slate-500">Today</p>
        <p className="text-lg font-black text-purple-700">+150 XP</p>
      </div>

      <div className="absolute -right-4 bottom-14 hidden rounded-2xl bg-white p-4 shadow-xl shadow-blue-200/50 lg:block">
        <p className="text-xs font-extrabold text-slate-500">Streak</p>
        <p className="text-lg font-black text-blue-700">3 days</p>
      </div>

      <div className="rounded-[2.25rem] border border-slate-200 bg-white p-4 shadow-2xl shadow-purple-200/50">
        <div className="rounded-[1.75rem] bg-slate-950 p-4">
          <div className="rounded-[1.4rem] bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-purple-700">
                  Lesson 1
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  I am… Jobs & Roles
                </h3>
              </div>
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black text-purple-700">
                Beginner
              </span>
            </div>

            <div className="mt-6 rounded-2xl bg-purple-50 p-4">
              <p className="text-sm font-bold text-slate-500">Tamil prompt</p>
              <p className="mt-1 text-lg font-black text-slate-950">
                நான் ஒரு ஆசிரியர்.
              </p>
            </div>

            <div className="mt-5">
              <p className="text-sm font-bold text-slate-500">
                Build the sentence
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["I", "am", "a", "teacher"].map((word) => (
                  <span
                    key={word}
                    className="rounded-xl border border-purple-200 bg-white px-4 py-2 text-sm font-black text-purple-800 shadow-sm"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-black text-green-700">
                Correct answer
              </p>
              <p className="mt-1 text-lg font-black text-slate-950">
                I am a teacher.
              </p>
            </div>

            <button className="mt-6 h-12 w-full rounded-full bg-yellow-400 text-sm font-black text-slate-950">
              Continue Practice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProblemCard({ title, text }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-100/50">
      <h3 className="text-xl font-black text-slate-950">“{title}”</h3>
      <p className="mt-3 leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function AppScreen({ badge, title, body, highlighted }) {
  return (
    <div
      className={`rounded-[1.75rem] border p-5 shadow-sm transition hover:-translate-y-1 ${
        highlighted
          ? "border-purple-200 bg-purple-50 shadow-purple-100"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="rounded-[1.25rem] bg-slate-950 p-3">
        <div className="rounded-2xl bg-white p-5">
          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black text-purple-700">
            {badge}
          </span>
          <div className="mt-5 space-y-3">
            <div className="h-3 w-3/4 rounded-full bg-slate-200" />
            <div className="h-3 w-full rounded-full bg-slate-100" />
            <div className="h-3 w-2/3 rounded-full bg-slate-100" />
          </div>
          <div className="mt-5 rounded-2xl bg-purple-50 p-4">
            <div className="h-3 w-1/2 rounded-full bg-purple-200" />
            <div className="mt-3 h-10 rounded-xl bg-white shadow-sm" />
          </div>
        </div>
      </div>
      <h3 className="mt-5 text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-2 leading-7 text-slate-600">{body}</p>
    </div>
  );
}

function FeatureCard({ icon, title, text }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-100/50">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-2xl">
        {icon}
      </div>
      <h3 className="mt-5 text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-3 leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function MiniCheck({ text }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-sm font-black text-green-700">
        ✓
      </span>
      <span className="text-sm font-bold text-slate-700">{text}</span>
    </div>
  );
}

function StepCard({ number, title, text }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-sm font-black text-purple-700">{number}</div>
      <h3 className="mt-4 text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-3 leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function BeforeAfterCard({ type, quote, points, positive }) {
  return (
    <div
      className={`rounded-[1.75rem] border p-7 ${
        positive
          ? "border-purple-200 bg-purple-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <span
        className={`rounded-full px-4 py-2 text-sm font-black ${
          positive ? "bg-purple-700 text-white" : "bg-white text-slate-700"
        }`}
      >
        {type}
      </span>
      <h3 className="mt-6 text-2xl font-black text-slate-950">“{quote}”</h3>
      <ul className="mt-6 space-y-3">
        {points.map((point) => (
          <li key={point} className="flex gap-3 text-slate-700">
            <span className="font-black text-purple-700">✓</span>
            <span className="font-semibold">{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MethodCard({ title, text }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-2 leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function LessonCard({ title, text }) {
  return (
    <div className="rounded-[1.5rem] border border-purple-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:bg-purple-50">
      <h3 className="text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-3 leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function GameCard({ title, text }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
      <h3 className="text-xl font-black text-white">{title}</h3>
      <p className="mt-3 leading-7 text-slate-300">{text}</p>
    </div>
  );
}

function CredCard({ title, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-black text-slate-950">{title}</h3>
      <p className="mt-1 text-sm font-semibold text-slate-500">{text}</p>
    </div>
  );
}

function Testimonial({ text }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-lg font-bold leading-8 text-slate-800">“{text}”</p>
      <div className="mt-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-sm font-black text-purple-700">
          FJ
        </div>
        <div>
          <p className="text-sm font-black text-slate-950">
            FluencyJet Learner
          </p>
          <p className="text-xs font-bold text-slate-500">
            Spoken English practice
          </p>
        </div>
      </div>
    </div>
  );
}

function PricingCard({ title, description, features, cta, to, featured }) {
  return (
    <div
      className={`rounded-[1.75rem] border p-7 shadow-sm ${
        featured
          ? "border-purple-300 bg-white shadow-xl shadow-purple-100"
          : "border-slate-200 bg-white"
      }`}
    >
      {featured && (
        <span className="rounded-full bg-purple-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-purple-700">
          Best value
        </span>
      )}
      <h3 className="mt-5 text-3xl font-black text-slate-950">{title}</h3>
      <p className="mt-3 leading-7 text-slate-600">{description}</p>
      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3 font-semibold text-slate-700">
            <span className="font-black text-purple-700">✓</span>
            {feature}
          </li>
        ))}
      </ul>
      <Link
        to={to}
        className={`mt-8 inline-flex h-13 w-full items-center justify-center rounded-full px-6 py-4 text-center font-extrabold transition hover:-translate-y-0.5 ${
          featured
            ? "bg-yellow-400 text-slate-950 hover:bg-yellow-500"
            : "bg-purple-700 text-white hover:bg-purple-800"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function FaqItem({ q, a }) {
  return (
    <details className="group p-6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-lg font-black text-slate-950">
        {q}
        <span className="text-2xl text-purple-700 transition group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-4 leading-7 text-slate-600">{a}</p>
    </details>
  );
}
