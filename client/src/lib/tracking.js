// client/src/lib/tracking.js
const GA_MEASUREMENT_ID = "G-3PFCRYL9TC";

function safeWindow() {
  return typeof window !== "undefined" ? window : null;
}

export function trackPageView(path) {
  const w = safeWindow();
  if (!w) return;

  const pagePath = path || w.location.pathname + w.location.search;

  try {
    if (w.gtag) {
      w.gtag("event", "page_view", {
        page_title: document.title,
        page_location: w.location.href,
        page_path: pagePath,
        send_to: GA_MEASUREMENT_ID,
      });
    }

    if (w.fbq) {
      w.fbq("track", "PageView");
    }
  } catch (error) {
    console.warn("[tracking] page_view failed:", error);
  }
}

export function trackEvent(eventName, params = {}) {
  const w = safeWindow();
  if (!w || !eventName) return;

  try {
    if (w.gtag) {
      w.gtag("event", eventName, params);
    }

    if (w.fbq) {
      w.fbq("trackCustom", eventName, params);
    }
  } catch (error) {
    console.warn("[tracking] custom event failed:", eventName, error);
  }
}

export function trackMetaStandard(eventName, params = {}) {
  const w = safeWindow();
  if (!w || !eventName) return;

  try {
    if (w.fbq) {
      w.fbq("track", eventName, params);
    }
  } catch (error) {
    console.warn("[tracking] meta standard event failed:", eventName, error);
  }
}

/* Funnel-specific helpers */

export function trackLevelCheckClick(source = "unknown") {
  trackEvent("level_check_click", { source });
  trackEvent("LevelCheckClick", { source });
}

function normalizeTrackingArgs(input, fallbackSource = "unknown") {
  if (input && typeof input === "object") return input;
  return { source: input || fallbackSource };
}

export function trackLevelCheckView(input = {}) {
  const params = normalizeTrackingArgs(input, "level_check_page");

  trackEvent("ViewLevelCheck", params);

  trackMetaStandard("ViewContent", {
    content_name: "FluencyJet Level Check",
    content_category: params.segment || "general",
    source: params.source || "level_check_page",
    segment: params.segment || "general",
  });
}

export function trackLevelCheckStart(input = "level_check_page") {
  const params = normalizeTrackingArgs(input, "level_check_page");

  trackEvent("level_check_start", params);
  trackEvent("StartLevelCheck", params);
}

export function trackLevelCheckComplete({
  score,
  track,
  segment = "general",
  main_goal,
  source = "level_check_page",
} = {}) {
  const params = {
    score,
    track,
    segment,
    main_goal,
    source,
  };

  trackEvent("level_check_complete", params);
  trackEvent("CompleteLevelCheck", params);

  trackMetaStandard("Lead", {
    content_name: "FluencyJet Level Check Completed",
    content_category: segment || "general",
    source,
    segment,
    main_goal,
    track,
    score,
  });
}

export function trackSignupComplete({ method = "email", track } = {}) {
  trackEvent("sign_up", { method, track });
  trackMetaStandard("CompleteRegistration", { method, track });
}

export function trackLessonView({ lessonId, difficulty } = {}) {
  trackEvent("lesson_view", { lessonId, difficulty });
  trackMetaStandard("ViewContent", {
    content_name: "Lesson",
    content_category: difficulty || "unknown",
    content_ids: lessonId ? [String(lessonId)] : undefined,
  });
}

export function trackPracticeStart({ lessonId, mode, difficulty } = {}) {
  trackEvent("practice_start", { lessonId, mode, difficulty });
  trackEvent("PracticeStart", { lessonId, mode, difficulty });
}

export function trackPracticeComplete({ lessonId, mode, difficulty, xp } = {}) {
  trackEvent("practice_complete", { lessonId, mode, difficulty, xp });
  trackEvent("PracticeComplete", { lessonId, mode, difficulty, xp });
}

export function trackDashboardView({ track } = {}) {
  trackEvent("dashboard_view", { track });
  trackEvent("DashboardView", { track });
}

export function trackWebinarInviteView({ source = "dashboard" } = {}) {
  trackEvent("webinar_invite_view", { source });
  trackEvent("WebinarInviteView", { source });
}

export function trackWebinarRegisterClick({ source = "dashboard" } = {}) {
  trackEvent("webinar_register_click", { source });
  trackMetaStandard("Lead", {
    content_name: "Sentence Fluency Webinar",
    source,
  });
}

export function trackPaywallView({ plan, from } = {}) {
  trackEvent("paywall_view", { plan, from });
  trackMetaStandard("ViewContent", {
    content_name: "Paywall",
    content_category: plan || "unknown",
  });
}

export function trackUpgradeClick({ plan, from } = {}) {
  trackEvent("upgrade_click", { plan, from });
  trackMetaStandard("InitiateCheckout", {
    content_name: "Sentence Master Upgrade",
    content_category: plan || "unknown",
    source: from || "unknown",
  });
}

export function trackPurchase({ value, currency = "INR", plan } = {}) {
  trackEvent("purchase", {
    value,
    currency,
    plan,
  });

  trackMetaStandard("Purchase", {
    value,
    currency,
    content_name: "Sentence Master",
    content_category: plan || "unknown",
  });
}

export function trackSmartSignupView({
  track,
  segment = "general",
  main_goal,
  source = "smart_signup",
} = {}) {
  trackEvent("ViewSmartSignup", { track, segment, main_goal, source });

  trackMetaStandard("ViewContent", {
    content_name: "FluencyJet Smart Signup",
    content_category: segment || "general",
    source,
    segment,
    main_goal,
    track,
  });
}

export function trackSmartSignupCompleted({
  track,
  segment = "general",
  main_goal,
  source = "smart_signup",
} = {}) {
  const params = { track, segment, main_goal, source };

  trackEvent("SignupCompleted", params);
  trackEvent("WebinarRegistered", params);

  trackMetaStandard("CompleteRegistration", {
    content_name: "FluencyJet Smart Signup",
    content_category: "webinar_registration",
    source,
    segment,
    main_goal,
    track,
  });
}

export function trackActivationView({
  track,
  segment = "general",
  source = "activation",
} = {}) {
  trackEvent("ViewActivation", { track, segment, source });
}

export function trackWhatsAppJoinClicked({
  source = "activation",
  track,
  segment = "general",
} = {}) {
  trackEvent("WhatsAppJoinClicked", { source, track, segment });

  trackMetaStandard("Contact", {
    content_name: "WhatsApp Group Join",
    source,
    track,
    segment,
  });
}

export function trackAppTrialStarted({
  source = "activation",
  track,
  segment = "general",
} = {}) {
  trackEvent("AppTrialStarted", { source, track, segment });
}

export function trackDemoVideoViewed({ source = "lesson_onboarding" } = {}) {
  trackEvent("DemoVideoViewed", { source });
}

/* ============================================================
   SPOKEN-ENGLISH VSL FUNNEL HELPERS
   Pixel / Dataset: 1246171816816642 (FJ Sentence Master)
   ============================================================ */

/**
 * Fire once on /spoken-english-vsl mount.
 * Standard ViewContent feeds Meta purchase-optimisation audiences.
 * Custom event preserves existing reporting.
 */
export function trackSpokenEnglishVSLView() {
  trackMetaStandard("ViewContent", {
    content_name: "Spoken English VSL",
    content_category: "spoken_english",
  });
  trackEvent("spoken_english_vsl_page_view", {});
}

/**
 * Fire when the 3-minute CTA becomes visible.
 * Custom event only — not InitiateCheckout (user has not shown purchase intent yet).
 */
export function trackVSLCTAVisible() {
  trackEvent("spoken_english_vsl_cta_revealed", {});
}

/**
 * Fire when the VSL CTA is clicked (navigates to offer page).
 * Custom event only — InitiateCheckout is reserved for the offer-page payment CTA.
 */
export function trackVSLCTAClick() {
  trackEvent("spoken_english_vsl_offer_cta_click", {});
}

/** Fire when the WhatsApp link on the VSL page is clicked. */
export function trackVSLWhatsAppClick() {
  trackEvent("spoken_english_vsl_whatsapp_click", {});
}

/**
 * Fire once on /spoken-english-offer mount.
 * Standard ViewContent with product value signals purchase intent to Meta.
 */
export function trackSpokenEnglishOfferView() {
  trackMetaStandard("ViewContent", {
    content_name: "Spoken English Offer",
    content_category: "spoken_english",
    value: 1199,
    currency: "INR",
  });
  trackEvent("spoken_english_offer_page_view", {});
}

/**
 * Module-level cooldown guard.
 * Prevents accidental duplicate InitiateCheckout if multiple CTAs are visible
 * simultaneously or a button receives a rapid double-click.
 */
let _initiateCheckoutFiredAt = 0;
const INITIATE_CHECKOUT_COOLDOWN_MS = 2000;

/**
 * Fire when any Razorpay payment CTA on the offer page is clicked.
 * Fires standard Meta InitiateCheckout + GA4 begin_checkout + custom event.
 * Suppresses duplicate calls within the cooldown window.
 */
export function trackSpokenEnglishInitiateCheckout() {
  const now = Date.now();
  if (now - _initiateCheckoutFiredAt < INITIATE_CHECKOUT_COOLDOWN_MS) return;
  _initiateCheckoutFiredAt = now;

  trackMetaStandard("InitiateCheckout", {
    content_name: "Spoken English Gym",
    content_category: "spoken_english",
    value: 1199,
    currency: "INR",
  });

  const w = safeWindow();
  try {
    if (w?.gtag) {
      w.gtag("event", "begin_checkout", {
        currency: "INR",
        value: 1199,
        items: [
          {
            item_name: "Spoken English Gym 1-Year Access",
            price: 1199,
            quantity: 1,
          },
        ],
      });
    }
  } catch (error) {
    console.warn("[tracking] begin_checkout failed:", error);
  }

  trackEvent("spoken_english_offer_payment_cta_click", {});
}

/** Fire when the WhatsApp link on the offer page is clicked. */
export function trackOfferWhatsAppClick() {
  trackEvent("spoken_english_offer_whatsapp_click", {});
}
