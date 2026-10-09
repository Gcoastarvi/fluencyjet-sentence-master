import { useEffect, useState } from "react";
import { trackEvent } from "../../lib/tracking";
import { api } from "../../api/apiClient";
import { MEMORY_MASTERCLASS_CONFIG, getMemoryVslId } from "../../data/memory/masterclassConfig";
import { useMemoryMasterclassEvent } from "../../hooks/useMemoryMasterclassEvent";
import MemoryPurchaserDetails from "./MemoryPurchaserDetails";

const MEMORY_VISITOR_ID_KEY = "fj_memory_visitor_id";
const MEMORY_FBC_KEY = "fj_memory_fbc";

function readCookie(name) {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  const parts = document.cookie ? document.cookie.split(";") : [];

  for (const rawPart of parts) {
    const part = rawPart.trim();

    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return part.slice(prefix.length);
      }
    }
  }

  return null;
}

function getMemoryVisitorId() {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.localStorage.getItem(
      MEMORY_VISITOR_ID_KEY,
    );

    if (existing) return existing;

    const id =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `memory_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 12)}`;

    window.localStorage.setItem(MEMORY_VISITOR_ID_KEY, id);

    return id;
  } catch {
    return `memory_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 12)}`;
  }
}

function getMemoryFbc(searchParams) {
  const cookieFbc = readCookie("_fbc");

  if (cookieFbc) {
    try {
      window.localStorage.setItem(
        MEMORY_FBC_KEY,
        cookieFbc,
      );
    } catch {
      // Cookie value is still usable.
    }

    return cookieFbc;
  }

  const fbclid = searchParams.get("fbclid");

  if (fbclid) {
    const generated = `fb.1.${Date.now()}.${fbclid}`;

    try {
      window.localStorage.setItem(
        MEMORY_FBC_KEY,
        generated,
      );
    } catch {
      // Ignore storage failures.
    }

    return generated;
  }

  try {
    return (
      window.localStorage.getItem(MEMORY_FBC_KEY) ||
      null
    );
  } catch {
    return null;
  }
}

function buildMemoryCheckoutAttribution() {
  if (typeof window === "undefined") {
    return {};
  }

  const searchParams = new URLSearchParams(
    window.location.search,
  );

  return {
    visitorId: getMemoryVisitorId(),

    fbclid: searchParams.get("fbclid") || null,
    fbc: getMemoryFbc(searchParams),
    fbp: readCookie("_fbp"),

    utmSource: searchParams.get("utm_source") || null,
    utmMedium: searchParams.get("utm_medium") || null,
    utmCampaign: searchParams.get("utm_campaign") || null,
    utmContent: searchParams.get("utm_content") || null,
    utmTerm: searchParams.get("utm_term") || null,

    source:
      searchParams.get("source") ||
      searchParams.get("utm_source") ||
      "memory-challenge-result",

    landingPage: window.location.href,
  };
}

let razorpayScriptPromise = null;

function loadRazorpayCheckout() {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Razorpay requires a browser"),
    );
  }

  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise;
  }

  razorpayScriptPromise = new Promise(
    (resolve, reject) => {
      const existing = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
      );

      if (existing) {
        existing.addEventListener(
          "load",
          () => resolve(true),
          { once: true },
        );

        existing.addEventListener(
          "error",
          () =>
            reject(
              new Error(
                "Unable to load Razorpay checkout",
              ),
            ),
          { once: true },
        );

        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;

      script.onload = () => resolve(true);

      script.onerror = () => {
        razorpayScriptPromise = null;
        reject(
          new Error("Unable to load Razorpay checkout"),
        );
      };

      document.body.appendChild(script);
    },
  );

  return razorpayScriptPromise;
}

export default function MemoryMasterclassOffer({
  trackId,
  score,
  ownerToken,
  leadDetails,
  savedScoreRef,
  onWatchVideo,
}) {
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [isCheckoutStarting, setIsCheckoutStarting] =
    useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [checkoutPlacement, setCheckoutPlacement] = useState(null);
  const [purchaserDetails, setPurchaserDetails] = useState(null);

  const isAdvanced = trackId === "advanced";

  const {
    name,
    price,
  } = MEMORY_MASTERCLASS_CONFIG;

  const { event, error: eventError, retry: retryEvent } = useMemoryMasterclassEvent();
  const dateLabel = event?.dateLabel || (eventError ? "Class schedule unavailable" : "Loading class schedule…");
  const timeRange = event ? `${event.startTime}–${event.endTime} ${event.timezoneLabel}` : "";
  const scheduleSummary = event
    ? `${event.dateLabel} · ${event.startTime} ${event.timezoneLabel} · ₹${price}`
    : dateLabel;
  const vimeoId = getMemoryVslId(trackId);

  const ctaText = isAdvanced
    ? `Book My Seat — ₹${price}`
    : `Book My Child's Seat — ₹${price}`;

  useEffect(() => {
    if (!event) return;
    trackEvent("memory_offer_view", {
      funnel: "amaze_memory",
      track: trackId,
      score,
      event_date: event.dateISO,
      price,
    });
  }, [trackId, score, price, event]);

  async function handleCheckout(placement) {
    if (isCheckoutStarting) return;
    if (!event) {
      setCheckoutMessage("Please wait for the class schedule to load before opening checkout.");
      return;
    }

    trackEvent("memory_offer_click", {
      funnel: "amaze_memory",
      track: trackId,
      score,
      event_date: event.dateISO,
      price,
      placement,
    });

    if (!ownerToken) {
      setCheckoutMessage(
        "Your saved Study Memory Test session could not be found. Please reopen your result and try again.",
      );
      return;
    }

    setCheckoutMessage("");
    setCheckoutPlacement(placement);
  }

  async function startCheckout(purchaser) {
    if (isCheckoutStarting || !ownerToken || !event) return;
    if (!purchaser.name || !purchaser.email || !purchaser.phone) return;
    const placement = checkoutPlacement;
    setPurchaserDetails(purchaser);
    setCheckoutMessage("");
    setIsCheckoutStarting(true);

    try {
      const attribution =
        buildMemoryCheckoutAttribution();

      const result = await api.post(
        "/memory-masterclass/create-order",
        {
          ownerToken,
          ...attribution,
          purchaserName: purchaser.name,
          purchaserEmail: purchaser.email,
          purchaserPhone: purchaser.phone,
        },
      );

      if (!result.ok || !result.data?.orderId) {
        throw new Error(
          result.error ||
            "Unable to create Razorpay order",
        );
      }

      await loadRazorpayCheckout();

      if (typeof window.Razorpay !== "function") {
        throw new Error(
          "Razorpay Checkout unavailable",
        );
      }

      const {
        keyId,
        orderId,
        amount,
        currency,
      } = result.data;

      const checkout = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        order_id: orderId,

        name: "Amaze Memory",
        description: `${name} — ${event.dateLabel}, ${event.startTime} ${event.timezoneLabel}`,
        prefill: {
          name: purchaser.name,
          email: purchaser.email,
          contact: purchaser.phone,
        },

        handler(response) {
          const params = new URLSearchParams();

          if (response?.razorpay_payment_id) {
            params.set(
              "razorpay_payment_id",
              response.razorpay_payment_id,
            );
          }

          if (response?.razorpay_order_id) {
            params.set(
              "razorpay_order_id",
              response.razorpay_order_id,
            );
          }

          const query = params.toString();

          window.location.href = query
            ? `/memory-masterclass/thank-you?${query}`
            : "/memory-masterclass/thank-you";
        },

        modal: {
          ondismiss() {
            setIsCheckoutStarting(false);
          },
        },

        theme: {
          color: "#4f46e5",
        },
      });

      checkout.on("payment.failed", (response) => {
        console.warn(
          "[memory-masterclass/checkout] Razorpay payment failed",
          response?.error?.code || "unknown",
        );

        setCheckoutMessage(
          "Payment was not completed. Please try again.",
        );

        setIsCheckoutStarting(false);
      });

      trackEvent("memory_checkout_open", {
        funnel: "amaze_memory",
        track: trackId,
        score,
        event_date: event.dateISO,
        price,
        placement,
      });

      checkout.open();
      setCheckoutPlacement(null);
    } catch (error) {
      console.error(
        "[memory-masterclass/checkout] Unable to open checkout:",
        error?.message || error,
      );

      setCheckoutMessage(
        "Secure checkout could not be opened. Please try again.",
      );

      setIsCheckoutStarting(false);
    }
  }

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-indigo-200 bg-white shadow-xl">
      {checkoutPlacement && (
        <MemoryPurchaserDetails
          ownerToken={ownerToken}
          initialDetails={purchaserDetails || leadDetails}
          hasEditedDetails={Boolean(purchaserDetails)}
          busy={isCheckoutStarting}
          message={checkoutMessage}
          onClose={(details) => {
            setPurchaserDetails(details);
            setCheckoutPlacement(null);
          }}
          onSubmit={startCheckout}
        />
      )}
      <div className="bg-emerald-50 px-6 py-7 text-center sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
          Report saved ✓
        </p>

        <h2
          id="memory-masterclass-saved-score"
          ref={savedScoreRef}
          tabIndex={-1}
          className="mt-3 scroll-mt-24 text-2xl font-black text-slate-950 outline-none sm:text-3xl"
        >
          {isAdvanced
            ? "Your Study Memory Score is saved"
            : "Your child’s Study Memory Score is saved"}
        </h2>

        <p className="mx-auto mt-3 max-w-2xl font-medium leading-7 text-slate-600">
          {isAdvanced
            ? "Now see how you can learn a better way to remember what you study."
            : "Now see how your child can learn a better way to remember what they study."}
        </p>
      </div>

      <div className="border-y border-indigo-100 bg-indigo-950 px-6 py-7 text-center text-white sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">
          Next Live Study Memory Class
        </p>

        <h3 className="mt-3 text-2xl font-black sm:text-3xl">
          {dateLabel}
        </h3>

        <p className="mt-2 text-lg font-bold text-white/90">
          {timeRange}
        </p>
        {eventError && (
          <div className="mt-3 text-sm" role="alert">
            <p>{eventError}</p>
            <button type="button" onClick={retryEvent} className="mt-2 font-bold underline underline-offset-4">
              Retry class details
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm font-bold">
          <span className="rounded-full bg-white/10 px-4 py-2">
            Live online
          </span>

          <span className="rounded-full bg-white/10 px-4 py-2">
            Second Study Memory Test included
          </span>
        </div>

        <p className="mt-5 text-3xl font-black">
          ₹{price}
        </p>
      </div>

      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
            Watch before you decide
          </p>

          <h3 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">
            {isAdvanced
              ? "See how changing the way you study can change what you remember."
              : "Why do students study for hours — and still forget?"}
          </h3>
        </div>

        {vimeoId && onWatchVideo && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={onWatchVideo}
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-black text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              Watch the 4-minute video again
            </button>
          </div>
        )}

        <div className="mx-auto mt-8 max-w-xl text-center">
          <button
            type="button"
            onClick={() => handleCheckout("vsl_cta")}
            disabled={isCheckoutStarting}
            className="w-full rounded-2xl bg-indigo-600 px-6 py-4 text-lg font-black text-white shadow-lg transition hover:bg-indigo-700"
          >
            {isCheckoutStarting ? "Opening secure checkout…" : ctaText}
          </button>

          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm font-bold text-slate-600">
            <span>✓ Live 2-hour class</span>
            <span>✓ Second Study Memory Test</span>
          </div>

          {checkoutMessage && (
            <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
              {checkoutMessage}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-6 py-10 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
              Practical study skills
            </p>

            <h3 className="mt-3 text-3xl font-black text-slate-950">
              {isAdvanced
                ? "What will you learn?"
                : "What will your child learn?"}
            </h3>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "🧠",
                title: "Remember better",
                text: "Learn simple techniques that can make information easier to remember.",
              },
              {
                icon: "📚",
                title: "Use it for studies",
                text: "See how memory methods can be applied to lessons and study information.",
              },
              {
                icon: "🔁",
                title: "Revise smarter",
                text: "Understand why only rereading is not enough and learn a better way to revise.",
              },
              {
                icon: "🎯",
                title: "Focus with purpose",
                text: "Learn a practical way to study with better attention and a clear purpose.",
              },
              {
                icon: "📖",
                title: "Close the book and check",
                text: "Learn to check what actually stayed in memory instead of only continuing to read.",
              },
              {
                icon: "📊",
                title: "Take a second test",
                text: "Take a new Study Memory Test after the training and compare the performance.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="text-3xl">{item.icon}</div>

                <h4 className="mt-4 text-xl font-black text-slate-950">
                  {item.title}
                </h4>

                <p className="mt-2 font-medium leading-7 text-slate-600">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-indigo-100 bg-white px-6 py-10 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
              A practical class — not just a lecture
            </p>

            <h3 className="mt-3 text-3xl font-black text-slate-950">
              What happens inside the class?
            </h3>
          </div>

          <div className="mt-8 space-y-4">
            {[
              ["1", "Test", "Experience a live memory challenge."],
              ["2", "Learn", "Learn practical memory and study methods."],
              ["3", "Practise", "Try the methods during the live class."],
              ["4", "Apply", "See how the methods connect to real study material, revision, recall and focus."],
              ["5", "Test again", "Take a new Study Memory Test after the training and compare the performance."],
            ].map(([number, title, description]) => (
              <div
                key={number}
                className="flex gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 sm:items-center"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-black text-white">
                  {number}
                </div>

                <div>
                  <h4 className="text-lg font-black text-slate-950">
                    {title}
                  </h4>

                  <p className="mt-1 font-medium leading-7 text-slate-600">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-xl text-center">
            <button
              type="button"
              onClick={() => handleCheckout("class_steps_cta")}
            disabled={isCheckoutStarting}
              className="w-full rounded-2xl bg-indigo-600 px-6 py-4 text-lg font-black text-white shadow-lg transition hover:bg-indigo-700"
            >
              {isCheckoutStarting ? "Opening secure checkout…" : ctaText}
            </button>

            <p className="mt-3 text-sm font-bold text-slate-500">
              {scheduleSummary}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-950 px-6 py-12 text-white sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-300">
              Real feedback
            </p>

            <h3 className="mt-3 text-3xl font-black sm:text-4xl">
              Hear from learners and families
            </h3>

            <p className="mx-auto mt-4 max-w-2xl font-medium leading-7 text-white/70">
              See what people say after experiencing the memory-training approach.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {[
              {
                id: "905848237",
                title: "Memory Training Feedback",
              },
              {
                id: "905847136",
                title: "Memory Training Feedback",
              },
              {
                id: "813939002",
                title: "Memory Training Feedback",
              },
            ].map((testimonial, index) => (
              <article
                key={testimonial.id}
                className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 shadow-2xl"
              >
                <div className="relative w-full pb-[56.25%]">
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src={`https://player.vimeo.com/video/${testimonial.id}?title=0&byline=0&portrait=0`}
                    title={`${testimonial.title} ${index + 1}`}
                    loading="lazy"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                <p className="p-4 text-center font-bold text-white/80">
                  {testimonial.title}
                </p>
              </article>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-xl text-center">
            <button
              type="button"
              onClick={() => handleCheckout("testimonials_cta")}
            disabled={isCheckoutStarting}
              className="w-full rounded-2xl bg-indigo-500 px-6 py-4 text-lg font-black text-white shadow-lg transition hover:bg-indigo-400"
            >
              {isCheckoutStarting ? "Opening secure checkout…" : ctaText}
            </button>

            <p className="mt-3 text-sm font-bold text-white/60">
              {scheduleSummary}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-indigo-100 bg-indigo-50 px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div className="rounded-[2rem] bg-indigo-950 p-8 text-center text-white shadow-xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-300">
                Your trainer
              </p>

              <h3 className="mt-4 text-3xl font-black">
                Aravind Pasupathy
              </h3>

              <p className="mt-2 font-bold text-indigo-200">
                Memory Coach &amp; Guinness World Record Holder
              </p>

              <div className="mt-6 border-t border-white/10 pt-6">
                <p className="text-4xl font-black">
                  270
                </p>

                <p className="mt-2 font-medium leading-7 text-white/70">
                  Binary numbers memorised in one minute.
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
                Experience matters
              </p>

              <h3 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">
                Training students in memory and learning techniques since 2011
              </h3>

              <p className="mt-5 text-lg font-medium leading-8 text-slate-600">
                But this class is not about watching my memory. It is about
                helping you experience what can happen when the way you learn
                changes.
              </p>

              <p className="mt-4 font-medium leading-7 text-slate-600">
                {isAdvanced
                  ? "You will learn the methods, practise them live and see how they can be applied to your own studies."
                  : "Your child will learn the methods, practise them live and see how they can be applied to real study material."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[2rem] border-2 border-indigo-200 bg-gradient-to-b from-indigo-50 to-white p-7 text-center shadow-xl sm:p-10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
              Live Study Memory Class
            </p>

            <h3 className="mt-4 text-3xl font-black text-slate-950 sm:text-4xl">
              {isAdvanced
                ? "Learn a smarter way to remember what you study."
                : "Help your child learn a smarter way to remember what they study."}
            </h3>

            <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 font-bold text-slate-700 shadow-sm">
                📅 {dateLabel}
              </div>

              <div className="rounded-2xl bg-white p-4 font-bold text-slate-700 shadow-sm">
                🕔 {timeRange || dateLabel}
              </div>

              <div className="rounded-2xl bg-white p-4 font-bold text-slate-700 shadow-sm">
                💻 Live online
              </div>

              <div className="rounded-2xl bg-white p-4 font-bold text-slate-700 shadow-sm">
                📊 Second Study Memory Test included
              </div>
            </div>

            {!isAdvanced && (
              <p className="mt-5 rounded-2xl bg-amber-50 p-4 font-bold leading-7 text-amber-900">
                Parents are welcome, but they do not need to attend the full class.
              </p>
            )}

            <div className="mt-8">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                One-time registration fee
              </p>

              <p className="mt-2 text-5xl font-black text-slate-950">
                ₹{price}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleCheckout("final_offer_cta")}
            disabled={isCheckoutStarting}
              className="mt-8 w-full rounded-2xl bg-indigo-600 px-6 py-5 text-xl font-black text-white shadow-lg transition hover:bg-indigo-700"
            >
              {isCheckoutStarting ? "Opening secure checkout…" : ctaText}
            </button>

            <p className="mt-4 text-sm font-bold text-slate-500">
              Secure checkout will open after you click the button.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
              Frequently asked questions
            </p>

            <h3 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">
              Questions before you join?
            </h3>
          </div>

          <div className="mt-8 space-y-3">
            {[
              {
                question: "Who should attend the class?",
                answer: isAdvanced
                  ? "You should attend the full live class so you can take part in the challenges, learn the methods and practise them yourself."
                  : "The student should attend the class. Parents are welcome, but they do not need to stay for the full two hours.",
              },
              {
                question: "Is this just a motivational class?",
                answer:
                  "No. This is a practical training session. You will experience memory challenges, learn techniques and practise how to use them.",
              },
              {
                question: isAdvanced
                  ? "Do I need to already have a good memory?"
                  : "Does my child need to already have a good memory?",
                answer:
                  "No. The class is designed to teach a better learning approach. The Study Memory Score is a starting point, not a judgement of intelligence or ability.",
              },
              {
                question: "Will there be another Study Memory Test?",
                answer:
                  "Yes. After the training, a new Study Memory Test with different information will be provided so the before-and-after performance can be compared.",
              },
              {
                question: "Is ₹99 the full registration fee?",
                answer:
                  "Yes. ₹99 is the one-time registration fee for this Live Study Memory Class.",
              },
              {
                question: "Does this guarantee better exam marks?",
                answer:
                  "No. The class teaches practical memory and study methods. Exam results depend on many factors, including understanding, practice, preparation and consistent application.",
              },
            ].map((item, index) => {
              const isOpen = openFaq === index;

              return (
                <div
                  key={item.question}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
                  >
                    <span className="font-black text-slate-950">
                      {item.question}
                    </span>

                    <span className="text-2xl font-black text-indigo-600">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 py-5">
                      <p className="font-medium leading-7 text-slate-600">
                        {item.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mx-auto mt-10 max-w-xl text-center">
            <button
              type="button"
              onClick={() => handleCheckout("faq_cta")}
            disabled={isCheckoutStarting}
              className="w-full rounded-2xl bg-indigo-600 px-6 py-5 text-xl font-black text-white shadow-lg transition hover:bg-indigo-700"
            >
              {isCheckoutStarting ? "Opening secure checkout…" : ctaText}
            </button>

            <p className="mt-3 text-sm font-bold text-slate-500">
              {scheduleSummary}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
