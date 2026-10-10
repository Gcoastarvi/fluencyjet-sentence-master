import { useEffect, useRef, useState } from "react";
import MemoryStandaloneCheckout from "../../components/memory/MemoryStandaloneCheckout";
import { getMemoryVslId } from "../../data/memory/masterclassConfig";
import { useMemoryMasterclassEvent } from "../../hooks/useMemoryMasterclassEvent";

const OUTCOMES = [
  {
    number: "01",
    title: "Remember more",
    detail: "Build a better way to make what you study stick.",
  },
  {
    number: "02",
    title: "Recall faster",
    detail: "Practise bringing information back when you need it.",
  },
  {
    number: "03",
    title: "Revise smarter",
    detail: "Make revision active, focused, and more useful.",
  },
];

function isValidEvent(event) {
  return Boolean(
    event?.dateISO &&
      event?.dateLabel &&
      event?.startTime &&
      event?.endTime &&
      event?.timezoneLabel,
  );
}

export default function MemoryChallengeVideo({ audience = "school" }) {
  const isAdvanced = audience === "advanced";
  const { event, error, retry } = useMemoryMasterclassEvent();
  const [coachImageAvailable, setCoachImageAvailable] = useState(true);
  const [pastVideo, setPastVideo] = useState(false);
  const videoRef = useRef(null);
  const eventReady = isValidEvent(event);
  const vimeoId = getMemoryVslId(
    isAdvanced ? "advanced" : "school_foundation",
  );
  const ctaLabel = isAdvanced
    ? "BOOK MY SEAT — ₹99 →"
    : "BOOK MY CHILD’S SEAT — ₹99 →";

  useEffect(() => {
    document.title = isAdvanced
      ? "Study Memory Class | Amaze Memory"
      : "Your Child’s Study Memory Class | Amaze Memory";
  }, [isAdvanced]);

  useEffect(() => {
    const updatePastVideo = () => {
      const video = videoRef.current;
      if (!video) return;
      setPastVideo(video.getBoundingClientRect().bottom <= 0);
    };

    window.addEventListener("scroll", updatePastVideo, { passive: true });
    updatePastVideo();
    return () => window.removeEventListener("scroll", updatePastVideo);
  }, []);

  const schedule = eventReady
    ? `${event.dateLabel} · ${event.startTime}–${event.endTime} ${event.timezoneLabel}`
    : "Loading the next live class time…";

  return (
    <MemoryStandaloneCheckout audience={audience} event={event}>
      {({ openCheckout, busy, dialogOpen }) => {
        const checkoutDisabled = !eventReady || busy;
        const checkoutButton = (placement) => (
          <button
            type="button"
            disabled={checkoutDisabled}
            onClick={openCheckout}
            data-placement={placement}
            className="group inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-4 text-center text-sm font-black tracking-[0.035em] text-white shadow-[0_12px_28px_rgba(67,56,202,0.23)] transition duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-[0_16px_32px_rgba(67,56,202,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:text-base"
          >
            <span>{busy ? "OPENING CHECKOUT…" : ctaLabel}</span>
          </button>
        );

        return (
          <>
            <main className="min-h-[100dvh] overflow-hidden bg-[#f4f5fb] text-slate-900">
              <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[30rem] bg-[radial-gradient(ellipse_at_50%_0%,rgba(99,102,241,0.15),transparent_68%)]" />
              <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-7 sm:pt-8 lg:px-10">
                <header className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-indigo-600 text-sm font-black tracking-tight text-white shadow-md shadow-indigo-200"
                    >
                      AM
                    </span>
                    <div className="leading-tight">
                      <p className="text-sm font-black tracking-tight text-slate-900">
                        Amaze Memory
                      </p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        by BrainoDad
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-indigo-100 bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.13em] text-indigo-700 shadow-sm sm:px-4 sm:text-xs">
                    Study Memory Class
                  </span>
                </header>

                <section className="mx-auto max-w-4xl pb-7 pt-10 text-center sm:pb-9 sm:pt-16">
                  <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700 sm:text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    A better way to learn starts here
                  </p>
                  <h1 className="mx-auto mt-4 max-w-4xl text-[2.2rem] font-black leading-[1.06] tracking-[-0.055em] text-[#171b3b] sm:text-5xl md:text-[3.65rem]">
                    {isAdvanced
                      ? "Your Study Memory Score is only the starting point."
                      : "Your child’s Study Memory Score is only the starting point."}
                  </h1>
                  <p className="mx-auto mt-4 max-w-2xl text-[15px] font-medium leading-7 text-slate-600 sm:mt-5 sm:text-lg sm:leading-8">
                    Watch this 4-minute video to see why{" "}
                    {isAdvanced ? "you forget" : "students forget"} — and how
                    memory can be trained.
                  </p>
                </section>

                <section
                  ref={videoRef}
                  aria-label="Four-minute memory training video"
                  className="mx-auto max-w-4xl"
                >
                  <div className="rounded-[1.65rem] bg-[#191d43] p-2 shadow-[0_26px_75px_rgba(37,42,92,0.2)] ring-1 ring-indigo-950/10 sm:rounded-[2rem] sm:p-3">
                    <div className="relative aspect-video overflow-hidden rounded-[1.2rem] bg-[#10132f] sm:rounded-[1.5rem]">
                      {vimeoId ? (
                        <iframe
                          src={`https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0`}
                          title="Why students forget and how memory can be trained"
                          className="absolute inset-0 h-full w-full"
                          allow="fullscreen; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-semibold text-indigo-100">
                          This video is not available right now.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-[0_8px_28px_rgba(36,42,82,0.05)] sm:mt-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700">
                        Next live class
                      </p>
                      <p className="mt-1 text-sm font-bold leading-6 text-slate-800 sm:text-base">
                        {schedule}
                      </p>
                    </div>
                    {error ? (
                      <div
                        role="alert"
                        className="flex flex-col gap-2 text-sm font-semibold text-rose-700 sm:items-end"
                      >
                        <span>{error}</span>
                        <button
                          type="button"
                          onClick={retry}
                          className="w-fit rounded-lg px-2 py-1 font-black text-indigo-700 underline decoration-indigo-300 underline-offset-4 transition hover:text-indigo-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                        >
                          Retry class details
                        </button>
                      </div>
                    ) : (
                      <span
                        aria-live="polite"
                        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500"
                      >
                        <span className="h-2 w-2 rounded-full bg-indigo-500" />
                        {eventReady ? "Schedule confirmed" : "Checking schedule"}
                      </span>
                    )}
                  </div>

                  <div className="mx-auto mt-5 max-w-xl text-center sm:mt-6">
                    {checkoutButton("below_video")}
                    <p className="mt-3 text-xs font-semibold text-slate-500">
                      {eventReady
                        ? `${event.dateLabel} · ${event.startTime} ${event.timezoneLabel}`
                        : "Checkout opens when the class schedule is available."}
                    </p>
                  </div>
                </section>

                <section className="mx-auto mt-14 max-w-4xl sm:mt-20">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700 sm:text-xs">
                        Practical memory training
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#171b3b] sm:text-3xl">
                        Turn study time into learning that lasts.
                      </h2>
                    </div>
                    <p className="max-w-sm text-sm font-medium leading-6 text-slate-500">
                      Small shifts in how you learn can change what you take
                      away from every study session.
                    </p>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {OUTCOMES.map((outcome) => (
                      <article
                        key={outcome.number}
                        className="group rounded-2xl border border-indigo-100/80 bg-white p-5 shadow-[0_8px_26px_rgba(36,42,82,0.04)] transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_14px_30px_rgba(36,42,82,0.09)] sm:min-h-40 sm:p-6"
                      >
                        <span className="font-mono text-xs font-bold tracking-wider text-indigo-500">
                          {outcome.number}
                        </span>
                        <h3 className="mt-4 text-lg font-black tracking-tight text-slate-900">
                          {outcome.title}
                        </h3>
                        <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                          {outcome.detail}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-[1.7rem] border border-indigo-100 bg-white shadow-[0_16px_45px_rgba(36,42,82,0.07)] sm:mt-16 sm:grid sm:grid-cols-[170px_1fr] sm:items-center sm:rounded-[2rem]">
                  <div className="flex items-center gap-4 border-b border-indigo-50 px-5 py-5 sm:h-full sm:flex-col sm:justify-center sm:border-b-0 sm:border-r sm:px-4 sm:py-7">
                    {coachImageAvailable && (
                      <img
                        src="/images/memory-challenge-hero.webp"
                        alt="Aravind Pasupathy"
                        onError={() => setCoachImageAvailable(false)}
                        className="h-[68px] w-[60px] shrink-0 rounded-xl object-cover object-top ring-1 ring-indigo-100 sm:h-36 sm:w-28 sm:rounded-2xl"
                      />
                    )}
                    <div className="sm:text-center">
                      <p className="text-sm font-black text-slate-900">
                        Aravind Pasupathy
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                        Memory Coach &amp; Guinness World Record Holder
                      </p>
                    </div>
                  </div>
                  <div className="px-5 py-5 sm:px-8 sm:py-7">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700">
                      Experience you can learn from
                    </p>
                    <p className="mt-2 text-xl font-black leading-snug tracking-[-0.03em] text-[#171b3b] sm:text-2xl">
                      Training students since 2011.
                    </p>
                    <p className="mt-4 border-l-2 border-indigo-300 pl-4 text-sm font-semibold leading-6 text-slate-600">
                      <span className="font-mono text-lg font-black text-indigo-700">
                        270
                      </span>{" "}
                      binary numbers memorised in one minute.
                    </p>
                  </div>
                </section>

                <section className="mx-auto mt-7 max-w-xl text-center sm:mt-9">
                  {checkoutButton("after_credibility")}
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    {eventReady
                      ? schedule
                      : "Checkout opens when the class schedule is available."}
                  </p>
                </section>

                <footer className="mx-auto mt-14 max-w-4xl border-t border-indigo-100 pt-5 text-center sm:mt-16">
                  <p className="text-xs font-semibold text-slate-500">
                    Amaze Memory <span className="px-1.5 text-indigo-300">/</span>{" "}
                    BrainoDad
                  </p>
                </footer>
              </div>
            </main>

            {pastVideo && !dialogOpen && !busy && (
              <>
                <div className="h-24 md:hidden" aria-hidden="true" />
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-indigo-100 bg-[#f8f8fc]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_28px_rgba(36,42,82,0.12)] backdrop-blur md:hidden">
                  <div className="mx-auto max-w-lg">
                    {checkoutButton("sticky_mobile")}
                  </div>
                </div>
              </>
            )}
          </>
        );
      }}
    </MemoryStandaloneCheckout>
  );
}
