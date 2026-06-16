// client/src/pages/student/Activation.jsx
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  trackActivationView,
  trackAppTrialStarted,
  trackWhatsAppJoinClicked,
} from "@/lib/tracking";
import { sendToFunnelSheet, getStoredFunnelContext } from "@/lib/funnelSheet";

const WHATSAPP_GROUP_URL = "/join-webinar";

function getUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function Activation() {
  const navigate = useNavigate();
  const user = useMemo(() => getUser(), []);
  const track = String(
    user?.track || localStorage.getItem("fj_track") || "BEGINNER",
  ).toUpperCase();

  const segment = String(
    user?.segment || localStorage.getItem("fj_level_segment") || "general",
  );

  useEffect(() => {
    trackActivationView({
      track,
      segment,
      source: "activation",
    });

    sendActivationAction("Activation Viewed");
  }, [track, segment]);

  const practicePath = track === "INTERMEDIATE" ? "/i/lessons" : "/b/lessons";

  function sendActivationAction(action) {
    const context = getStoredFunnelContext();
    const user = context.user || {};

    sendToFunnelSheet({
      type: "activation_action",
      name: user.name || "",
      email: user.email || "",
      whatsapp_number: user.whatsapp_number || user.whatsapp || "",
      segment: context.segment,
      main_goal: context.main_goal,
      track: context.track || track,
      action,
      source: "activation",
      page_url: window.location.href,
    });
  }

  function joinWhatsApp() {
    trackWhatsAppJoinClicked({ source: "activation", track, segment });
    sendActivationAction("WhatsApp Clicked");
    window.open(WHATSAPP_GROUP_URL, "_blank", "noopener,noreferrer");
  }

  function startPractice() {
    trackAppTrialStarted({ source: "activation", track, segment });
    sendActivationAction("Start Practice Clicked");
    navigate(practicePath);
  }

  return (
    <div className="min-h-[80vh] bg-gradient-to-br from-indigo-50 via-white to-emerald-50 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[2rem] border border-indigo-100 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
            ✅
          </div>

          <h1 className="mt-5 text-3xl font-black text-slate-950 sm:text-5xl">
            Your Free FluencyJet Access Is Ready
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-600">
            Complete these 2 steps before the live class.
          </p>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="text-4xl">💬</div>
            <h2 className="mt-4 text-2xl font-black text-slate-950">
              Join Live Class WhatsApp Group
            </h2>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
              Class link, reminders, and practice tasks will be shared here.
            </p>
            <button
              onClick={joinWhatsApp}
              className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700"
            >
              Join WhatsApp Group
            </button>
          </div>

          <div className="rounded-[2rem] border border-indigo-100 bg-white p-6 shadow-sm">
            <div className="text-4xl">🚀</div>
            <h2 className="mt-4 text-2xl font-black text-slate-950">
              Start Your Free App Practice
            </h2>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
              Practise your first 10 sentences before the live class.
            </p>
            <button
              onClick={startPractice}
              className="mt-6 w-full rounded-2xl bg-indigo-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700"
            >
              Start Free Practice
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm font-bold text-slate-500">
          Best result: Join the WhatsApp group first, then complete your first
          practice.
        </p>
      </div>
    </div>
  );
}
