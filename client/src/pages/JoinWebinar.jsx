// client/src/pages/JoinWebinar.jsx
import { useEffect } from "react";

const CURRENT_WEBINAR_WHATSAPP_URL =
  "https://chat.whatsapp.com/LiptxBQVUdq3bFxNkBiF5k";

export default function JoinWebinar() {
  useEffect(() => {
    window.location.replace(CURRENT_WEBINAR_WHATSAPP_URL);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <section className="max-w-md w-full rounded-3xl bg-white border border-slate-200 shadow-sm p-8 text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />

        <h1 className="text-2xl font-extrabold text-slate-900">
          Taking you to the FluencyJet Webinar Group...
        </h1>

        <p className="mt-3 text-sm font-medium text-slate-500">
          Please wait. You will be redirected to WhatsApp automatically.
        </p>

        <a
          href={CURRENT_WEBINAR_WHATSAPP_URL}
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-green-500 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-green-600"
        >
          Join WhatsApp Group
        </a>
      </section>
    </main>
  );
}
