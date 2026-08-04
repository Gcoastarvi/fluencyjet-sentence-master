// client/src/pages/marketing/VocabularyVSL.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Player from "@vimeo/player";

import {
  trackVocabularyVSLView,
  trackVocabularyVSLVideoStarted,
  trackVocabularyVSLThreeMinuteReached,
  trackVocabularyVSLCTAVisible,
  trackVocabularyVSLCTAClick,
  trackVocabularyVSLWhatsAppClick,
} from "../../lib/tracking";

const VIMEO_VIDEO_ID = "1130094804";

const VIDEO_DURATION_SECONDS = 9 * 60 + 48; // 588 seconds
const CTA_REVEAL_SECONDS = 3 * 60; // 180 seconds

const VIDEO_DURATION_MS = VIDEO_DURATION_SECONDS * 1000; // 588 000 ms — progress bar max
const REQUIRED_WATCH_TIME_MS = CTA_REVEAL_SECONDS * 1000; // 180 000 ms — CTA reveal threshold

const COURSE_PAGE_PATH = "/vocabulary-course";

const WATCH_PROGRESS_STORAGE_KEY = "fj_vocabulary_vsl_active_watch_time_ms";

const ALLOWED_FORWARD_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
  "fbclid",
  "campaign_id",
  "adset_id",
  "ad_id",
  "placement",
  "source",
];

const WHATSAPP_URL =
  "https://wa.me/919487070761?text=" +
  encodeURIComponent(
    "Hi FluencyJet, I watched the English Vocabulary Masterclass video. I need more information about the course.",
  );

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

function getStoredWatchTime() {
  try {
    const storedValue = Number(
      window.sessionStorage.getItem(WATCH_PROGRESS_STORAGE_KEY),
    );

    if (!Number.isFinite(storedValue) || storedValue < 0) {
      return 0;
    }

    return Math.min(storedValue, VIDEO_DURATION_MS);
  } catch {
    return 0;
  }
}

function saveWatchTime(milliseconds) {
  try {
    window.sessionStorage.setItem(
      WATCH_PROGRESS_STORAGE_KEY,
      String(Math.min(milliseconds, VIDEO_DURATION_MS)),
    );
  } catch {
    // The funnel should continue even if storage is unavailable.
  }
}

function buildCourseDestination() {
  const currentParams = new URLSearchParams(window.location.search);
  const destinationParams = new URLSearchParams();

  ALLOWED_FORWARD_PARAMS.forEach((key) => {
    const value = currentParams.get(key);

    if (value) {
      destinationParams.set(key, value);
    }
  });

  destinationParams.set("source", "vocabulary-vsl");

  const query = destinationParams.toString();

  return query ? `${COURSE_PAGE_PATH}?${query}` : COURSE_PAGE_PATH;
}

export default function VocabularyVSL() {
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const ctaTrackedRef = useRef(false);

  const isPlayingRef = useRef(false);
  const isBufferingRef = useRef(false);
  const accumulatedWatchTimeRef = useRef(0);
  const lastTimerTickRef = useRef(Date.now());

  const videoStartedTrackedRef = useRef(false);
  const threeMinutesTrackedRef = useRef(false);
  const ctaVisibleTrackedRef = useRef(false);

  const [showCta, setShowCta] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [watchProgress, setWatchProgress] = useState(0);

  const courseDestination = useMemo(() => {
    if (typeof window === "undefined") {
      return COURSE_PAGE_PATH;
    }

    return buildCourseDestination();
  }, []);

  useEffect(() => {
    document.title = "Free English Vocabulary Masterclass | FluencyJet";

    document.body.classList.add("marketing-no-nav");

    trackVocabularyVSLView();

    accumulatedWatchTimeRef.current = getStoredWatchTime();

    const savedProgress =
      accumulatedWatchTimeRef.current / VIDEO_DURATION_MS;

    setWatchProgress(Math.min(savedProgress, 1));

    if (accumulatedWatchTimeRef.current >= REQUIRED_WATCH_TIME_MS) {
      setShowCta(true);
    }

    return () => {
      document.body.classList.remove("marketing-no-nav");
    };
  }, []);

  useEffect(() => {
    if (!iframeRef.current) {
      return undefined;
    }

    const player = new Player(iframeRef.current);
    playerRef.current = player;

    const handlePlay = () => {
      isPlayingRef.current = true;
      isBufferingRef.current = false;
      lastTimerTickRef.current = Date.now();

      if (!videoStartedTrackedRef.current) {
        videoStartedTrackedRef.current = true;
        trackVocabularyVSLVideoStarted();
      }
    };

    const handlePause = () => {
      isPlayingRef.current = false;
    };

    const handleEnded = () => {
      isPlayingRef.current = false;
    };

    const handleBufferStart = () => {
      isBufferingRef.current = true;
    };

    const handleBufferEnd = () => {
      isBufferingRef.current = false;
      lastTimerTickRef.current = Date.now();
    };

    player.on("play", handlePlay);
    player.on("pause", handlePause);
    player.on("ended", handleEnded);
    player.on("bufferstart", handleBufferStart);
    player.on("bufferend", handleBufferEnd);

    return () => {
      player.off("play", handlePlay);
      player.off("pause", handlePause);
      player.off("ended", handleEnded);
      player.off("bufferstart", handleBufferStart);
      player.off("bufferend", handleBufferEnd);

      player.destroy().catch(() => {
        // Prevent cleanup errors from affecting navigation.
      });

      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsedSinceLastTick = Math.min(
        now - lastTimerTickRef.current,
        1500,
      );

      lastTimerTickRef.current = now;

      const shouldCountTime =
        isPlayingRef.current &&
        !isBufferingRef.current &&
        document.visibilityState === "visible";

      if (!shouldCountTime || showCta) {
        return;
      }

      const nextWatchTime = Math.min(
        accumulatedWatchTimeRef.current + elapsedSinceLastTick,
        VIDEO_DURATION_MS,
      );

      accumulatedWatchTimeRef.current = nextWatchTime;
      saveWatchTime(nextWatchTime);

      setWatchProgress(Math.min(nextWatchTime / VIDEO_DURATION_MS, 1));

      if (nextWatchTime >= REQUIRED_WATCH_TIME_MS) {
        setShowCta(true);

        if (!threeMinutesTrackedRef.current) {
          threeMinutesTrackedRef.current = true;
          trackVocabularyVSLThreeMinuteReached();
        }

        if (!ctaVisibleTrackedRef.current) {
          ctaVisibleTrackedRef.current = true;
          trackVocabularyVSLCTAVisible();
        }
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [showCta]);

  useEffect(() => {
    if (!showCta || ctaVisibleTrackedRef.current) {
      return;
    }

    ctaVisibleTrackedRef.current = true;
    trackVocabularyVSLCTAVisible();
  }, [showCta]);

  const handleCourseClick = () => {
    trackVocabularyVSLCTAClick();

    window.setTimeout(() => {
      window.location.href = courseDestination;
    }, 200);
  };

  const handleWhatsAppClick = () => {
    trackVocabularyVSLWhatsAppClick();
  };

  return (
    <>
      <MarketingNavHider />

      <main className="min-h-screen overflow-x-hidden bg-gradient-to-b from-[#031832] via-[#043a3b] to-[#052912] text-white">
        <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center px-4 py-8 text-center sm:px-6 sm:py-12 lg:px-8">
          <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-40 top-80 h-96 w-96 rounded-full bg-lime-400/10 blur-3xl" />

          <div className="relative w-full">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-300 sm:text-sm">
              Free 9-Minute English Vocabulary Masterclass
            </p>

            <h1 className="mx-auto mt-4 max-w-5xl text-3xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              A Smarter Way to Build Your{" "}
              <span className="text-yellow-300">English Vocabulary</span>
            </h1>

            <p className="mx-auto mt-5 max-w-4xl text-lg font-semibold leading-8 text-white/85 sm:text-2xl">
              Discover how source words and word families can help you decode,
              understand and remember difficult English words.
            </p>

            <div className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
              {[
                "Easy English explanation",
                "Source-word method",
                "Practical examples",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white/90"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-8 w-full overflow-hidden rounded-[1.75rem] border border-white/20 bg-black shadow-2xl shadow-black/40 sm:mt-10">
              <div className="relative aspect-video w-full">
                <iframe
                  ref={iframeRef}
                  className="absolute inset-0 h-full w-full"
                  src={`https://player.vimeo.com/video/${VIMEO_VIDEO_ID}?title=0&byline=0&portrait=0&badge=0&autopause=0`}
                  title="FluencyJet English Vocabulary Masterclass"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>

            {!showCta && (
              <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-sm font-bold text-white/80 sm:text-base">
                  Continue watching.
                </p>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-lime-400 transition-all duration-700"
                    style={{
                      width: `${Math.min(watchProgress * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="mt-6">
              <a
                href={WHATSAPP_URL}
                onClick={handleWhatsAppClick}
                className="text-base font-bold text-white/90 underline decoration-lime-300 decoration-2 underline-offset-4 transition hover:text-lime-300 sm:text-lg"
              >
                Questions? WhatsApp Support: 9487070761
              </a>
            </div>

            {showCta && (
              <div className="mx-auto mt-8 max-w-2xl rounded-[2rem] border border-lime-300/30 bg-white/10 p-5 shadow-2xl shadow-lime-500/10 backdrop-blur sm:p-7">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-lime-300">
                  Your Course Invitation Is Ready
                </p>

                <h2 className="mt-3 text-2xl font-black sm:text-3xl">
                  Continue to the Vocabulary Course
                </h2>

                <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-white/75">
                  See the complete course, lessons, bonuses, learner feedback
                  and current ₹799 access offer.
                </p>

                <button
                  type="button"
                  onClick={handleCourseClick}
                  className="mt-6 w-full rounded-2xl bg-gradient-to-r from-yellow-300 to-lime-400 px-6 py-5 text-lg font-black text-slate-950 shadow-xl shadow-lime-500/20 transition hover:-translate-y-0.5 hover:shadow-lime-500/30 active:scale-[0.99] sm:text-2xl"
                  data-testid="vocabulary-vsl-course-cta"
                >
                  Yes, Show Me the Vocabulary Course
                </button>

                <p className="mt-3 text-xs font-semibold text-white/50">
                  Clicking the button does not make a payment.
                </p>
              </div>
            )}
          </div>

          <footer className="relative mt-auto w-full pt-12 text-center">
            <p className="mx-auto max-w-4xl text-xs leading-relaxed text-white/45 sm:text-sm">
              This site is not part of Facebook or Meta. This site is not
              endorsed by Facebook or Meta in any way. Facebook is a trademark
              of Meta Platforms, Inc.
            </p>
          </footer>
        </section>
      </main>
    </>
  );
}
