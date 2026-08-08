import { Link } from "react-router-dom";

const SUPPORT_URL =
  "https://wa.me/919487070761?text=" +
  encodeURIComponent(
    "Hi FluencyJet, I completed the ₹799 Vocabulary Challenge payment and need help with course access.",
  );

const WHATSAPP_GROUP_URL =
  "https://chat.whatsapp.com/Fq0KaBNW1gy9rxiwhxnzyA?s=cl&p=a&ilr=0";

export default function VocabularyThankYou() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950 px-4 py-10 text-white sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-6 text-center shadow-2xl backdrop-blur sm:p-10 lg:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-lime-300 text-4xl font-black text-emerald-950 shadow-lg">
            ✓
          </div>

          <p className="mt-7 text-xs font-black uppercase tracking-[0.24em] text-lime-300">
            Payment Completed
          </p>

          <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Welcome to the English Vocabulary Challenge!
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
            Thank you for joining FluencyJet. Your ₹799 payment has been
            completed, and your course-access instructions will be sent using
            the contact details entered during payment.
          </p>

          <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-2xl">🎓</p>
              <h2 className="mt-3 font-black">Complete Course</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                More than 11 hours of vocabulary training.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-2xl">🎁</p>
              <h2 className="mt-3 font-black">All 9 Bonuses</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Practical guides for grammar, speaking and writing.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-2xl">📅</p>
              <h2 className="mt-3 font-black">1-Year Access</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Learn at your own pace on mobile or computer.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-lime-300/25 bg-lime-300/10 p-5 text-left sm:p-6">
            <h2 className="text-lg font-black text-lime-300">
              What happens next?
            </h2>

            <ol className="mt-4 space-y-3 text-sm leading-6 text-white/75 sm:text-base">
              <li>
                <strong className="text-white">1.</strong> Check the email and
                phone number used during payment.
              </li>

              <li>
                <strong className="text-white">2.</strong> Follow the course
                access instructions sent by FluencyJet.
              </li>

              <li>
                <strong className="text-white">3.</strong> Save the support
                number so you can contact us if you need assistance.
              </li>
            </ol>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-base font-bold text-white">
            Next Step: Join the private WhatsApp group for course updates and
            daily vocabulary practice.
          </p>

          <a
            href={WHATSAPP_GROUP_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#25D366] px-6 py-4 text-base font-black text-white shadow-lg transition hover:brightness-95 sm:w-auto"
          >
            Join the Vocabulary WhatsApp Group
          </a>

          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-emerald-500 px-6 py-4 text-base font-black text-white shadow-lg transition hover:bg-emerald-600 sm:w-auto"
          >
            Get Help on WhatsApp: 9487070761
          </a>

          <p className="mt-4 text-sm leading-6 text-white/55">
            Please keep your Razorpay payment confirmation or payment ID for
            reference.
          </p>

          <div className="mt-8 border-t border-white/10 pt-6">
            <Link
              to="/vocabulary-course"
              className="text-sm font-bold text-lime-300 underline underline-offset-4 hover:text-lime-200"
            >
              Return to the Vocabulary Course Page
            </Link>
          </div>
        </section>

        <footer className="px-4 py-8 text-center text-xs leading-6 text-white/40">
          © {new Date().getFullYear()} FluencyJet. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
