import { Link } from "react-router-dom";
import { MEMORY_MASTERCLASS_CONFIG } from "../../data/memory/masterclassConfig";

export default function MemoryMasterclassThankYou() {
  const {
    name,
    dateLabel,
    startTime,
    endTime,
    timezone,
    price,
  } = MEMORY_MASTERCLASS_CONFIG;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 px-4 py-10 text-white sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-6 text-center shadow-2xl backdrop-blur sm:p-10 lg:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-300 text-4xl font-black text-emerald-950 shadow-lg">
            ✓
          </div>

          <p className="mt-7 text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
            Registration Received
          </p>

          <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Your seat for the {name} is being confirmed.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
            Thank you for joining. Keep the WhatsApp number you entered during
            the Study Memory Test available. We will use it for important class
            updates and joining instructions.
          </p>

          <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-2xl">📅</p>
              <h2 className="mt-3 font-black">{dateLabel}</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Keep this date free for the live class.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-2xl">⏰</p>
              <h2 className="mt-3 font-black">
                {startTime}–{endTime} {timezone}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Please join a few minutes early.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-2xl">🧠</p>
              <h2 className="mt-3 font-black">Come ready to participate</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                This is a practical class with memory challenges, techniques
                and study applications.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-2xl">📊</p>
              <h2 className="mt-3 font-black">Your score journey continues</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                After the class, you will take a new Study Memory Test and
                compare your performance.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-indigo-300/25 bg-indigo-300/10 p-5 text-left sm:p-6">
            <h2 className="text-lg font-black text-indigo-200">
              What happens next?
            </h2>

            <ol className="mt-4 space-y-3 text-sm leading-6 text-white/75 sm:text-base">
              <li>
                <strong className="text-white">1.</strong> Keep your Razorpay
                payment confirmation for reference.
              </li>

              <li>
                <strong className="text-white">2.</strong> Watch the WhatsApp
                number used in your Study Memory Test for class reminders and
                joining instructions.
              </li>

              <li>
                <strong className="text-white">3.</strong> The student should
                attend the live class with a notebook and pen.
              </li>

              <li>
                <strong className="text-white">4.</strong> Parents are welcome,
                but they do not need to attend the full class.
              </li>
            </ol>
          </div>

          <div className="mt-8 rounded-2xl bg-white p-6 text-slate-950 shadow-lg">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">
              Live Study Memory Class
            </p>

            <p className="mt-3 text-2xl font-black">
              {dateLabel} · {startTime}–{endTime} {timezone}
            </p>

            <p className="mt-2 font-bold text-slate-600">
              Registration fee: ₹{price}
            </p>
          </div>

          <p className="mx-auto mt-7 max-w-2xl text-sm leading-6 text-white/55">
            If you used a different family member&apos;s phone during the
            assessment, make sure the person receiving the WhatsApp updates can
            forward the class information to the student.
          </p>

          <div className="mt-8 border-t border-white/10 pt-6">
            <Link
              to="/memory-challenge/result"
              className="text-sm font-bold text-indigo-200 underline underline-offset-4 hover:text-white"
            >
              Return to my Study Memory Score
            </Link>
          </div>
        </section>

        <footer className="px-4 py-8 text-center text-xs leading-6 text-white/40">
          © {new Date().getFullYear()} Amaze Memory. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
