import React from "react";
import { Link } from "react-router-dom";

function getWebinarCopy(lessonNumber) {
  const n = Number(lessonNumber);

  if (n === 1) {
    return {
      badge: "Free Live Class",
      title: "Want live guidance from Aravind?",
      body: "Great start! You completed your first sentence practice. Join the free English fluency class and learn the full practice roadmap.",
      bodyTa:
        "அருமையான தொடக்கம்! நீங்கள் உங்கள் முதல் sentence practice-ஐ முடித்துவிட்டீர்கள். Free English fluency class-ல் சேர்ந்து முழு practice roadmap-ஐ கற்றுக்கொள்ளுங்கள்.",
      cta: "Join Free Live Class",
      source: "lesson_1_complete",
    };
  }

  if (n === 2) {
    return {
      badge: "Free Live Class",
      title: "Build sentence confidence faster",
      body: "You’re building sentence confidence. In my free live class, I’ll show you how to speak English without translating in your mind.",
      bodyTa:
        "நீங்கள் sentence confidence-ஐ உருவாக்கிக் கொண்டிருக்கிறீர்கள். என் free live class-ல், தமிழில் நினைத்து English-க்கு translate செய்யாமல் பேசுவது எப்படி என்று காட்டுகிறேன்.",
      cta: "Reserve My Free Seat",
      source: "lesson_2_complete",
    };
  }

  if (n === 3) {
    return {
      badge: "Free Starter Path Complete",
      title: "Your full FluencyJet roadmap is waiting",
      body: "You completed the Free Starter Path 🎉 Now join my free live Zoom class and learn the full roadmap to speak English with confidence.",
      bodyTa:
        "நீங்கள் Free Starter Path-ஐ முடித்துவிட்டீர்கள் 🎉 இப்போது என் free live Zoom class-ல் சேர்ந்து, confidence உடன் English பேச முழு roadmap-ஐ கற்றுக்கொள்ளுங்கள்.",
      cta: "Join Free Live Class",
      source: "lesson_3_complete",
    };
  }

  return null;
}

export default function WebinarInviteCard({
  lessonNumber,
  track = "beginner",
  source,
  variant = "session",
}) {
  const copy =
    variant === "paywall"
      ? {
          badge: "Free Live Class",
          title: "Join the Free Live Class to Continue",
          body: "To continue beyond the free starter lessons, join my free live class and understand the complete English fluency roadmap.",
          bodyTa:
            "Free starter lessons-க்கு பிறகு தொடர, என் free live class-ல் சேர்ந்து முழு English fluency roadmap-ஐ புரிந்துகொள்ளுங்கள்.",
          cta: "Join Free Live Class",
          source: source || `paywall_lesson_${lessonNumber || 4}`,
        }
      : getWebinarCopy(lessonNumber);

  if (!copy) return null;

  const webinarUrl = `/webinar?source=${encodeURIComponent(
    source || copy.source,
  )}&track=${encodeURIComponent(track || "beginner")}&lesson=${encodeURIComponent(
    lessonNumber || "",
  )}`;

  return (
    <div className="mt-6 rounded-[2rem] border border-violet-100 bg-white p-5 shadow-xl shadow-violet-100/50">
      <div className="mb-3 inline-flex rounded-full bg-violet-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-violet-700">
        {copy.badge}
      </div>

      <h3 className="text-xl font-black leading-tight text-slate-950">
        {copy.title}
      </h3>

      <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
        {copy.body}
      </p>

      <p className="font-tamil mt-3 text-sm font-bold leading-relaxed text-slate-700">
        {copy.bodyTa}
      </p>

      <Link
        to={webinarUrl}
        className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-violet-600 px-6 py-4 text-base font-black text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-700"
      >
        {copy.cta} →
      </Link>
    </div>
  );
}
