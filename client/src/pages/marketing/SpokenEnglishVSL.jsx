import { useEffect, useState } from "react";
import {
  trackSpokenEnglishVSLView,
  trackVSLCTAVisible,
  trackVSLCTAClick,
  trackVSLWhatsAppClick,
} from "../../lib/tracking";

const VIMEO_VIDEO_ID = "1210087375";
const CTA_DELAY_MS = 3 * 60 * 1000;

function MarketingNavHider() {
  return (
    <style>{`
      body.marketing-no-nav header,
      body.marketing-no-nav nav,
      body.marketing-no-nav [data-testid="navbar"],
      body.marketing-no-nav .navbar,
      body.marketing-no-nav .site-header {
        display: none !important;
      }

      body.marketing-no-nav {
        overflow-x: hidden;
      }
    `}</style>
  );
}

export default function SpokenEnglishVSL() {
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    document.title = "Spoken English Gym for Tamil Learners | FluencyJet";
    document.body.classList.add("marketing-no-nav");
    trackSpokenEnglishVSLView();

    const timer = window.setTimeout(() => {
      setShowCta(true);
      trackVSLCTAVisible();
    }, CTA_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove("marketing-no-nav");
    };
  }, []);

  const handleCtaClick = () => {
    trackVSLCTAClick();
    window.location.href = "/spoken-english-offer";
  };

  const handleWhatsAppClick = () => {
    trackVSLWhatsAppClick();
  };

  return (
    <>
      <MarketingNavHider />
      <main className="min-h-screen bg-gradient-to-b from-[#07031f] via-[#10053d] to-[#020617] text-white">
        <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-4 py-8 pb-10 text-center sm:px-6 lg:px-8">
          <h1 className="mx-auto max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            English பேசணும்… ஆனா{" "}
            <span className="text-yellow-300">Grammar Mistake</span> பயமா?
          </h1>

          <h2 className="mx-auto mt-4 max-w-3xl text-xl font-black text-lime-300 sm:text-3xl">
            Solution: Spoken English Gym for Tamil Learners
          </h2>

          <div className="mt-8 w-full overflow-hidden rounded-3xl border border-white/20 bg-black shadow-2xl shadow-lime-400/10 sm:mt-10">
            <div className="relative w-full pb-[56.25%]">
              <iframe
                className="absolute left-0 top-0 h-full w-full"
                src={`https://player.vimeo.com/video/${VIMEO_VIDEO_ID}?title=0&byline=0&portrait=0&badge=0&autopause=0`}
                title="FluencyJet Spoken English Gym VSL"
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
                allowFullScreen
              />
            </div>
          </div>

          <div className="mt-6 text-center">
            <a
              href="https://wa.me/919047122250?text=Hi%20FluencyJet%2C%20I%20watched%20the%20Spoken%20English%20Gym%20video.%20I%20need%20help."
              onClick={handleWhatsAppClick}
              className="text-lg font-semibold text-white/90 underline decoration-lime-300 underline-offset-4 hover:text-lime-300 sm:text-2xl"
            >
              Need help? WhatsApp Support: 9047122250
            </a>
          </div>

          {showCta && (
            <div className="mt-8 w-full max-w-2xl rounded-3xl border border-lime-300/30 bg-white/10 p-5 text-center shadow-2xl shadow-lime-400/10 backdrop-blur sm:p-7">
              <button
                type="button"
                onClick={handleCtaClick}
                className="w-full rounded-2xl bg-gradient-to-r from-yellow-300 to-lime-400 px-6 py-5 text-lg font-black text-slate-950 shadow-xl shadow-lime-500/20 transition hover:scale-[1.02] hover:shadow-lime-500/30 active:scale-[0.99] sm:text-2xl"
              >
                Yes, I want to Join the Spoken English Gym
              </button>
            </div>
          )}

          <footer className="mt-auto w-full pt-10 text-center">
            <p className="mx-auto max-w-3xl text-xs leading-relaxed text-white/55 sm:text-sm">
              This site is not part of Facebook or Meta. Additionally, this site
              is not endorsed by Facebook in any way. Facebook is a trademark of
              Meta Platforms, Inc.
            </p>
          </footer>
        </section>
      </main>
    </>
  );
}
