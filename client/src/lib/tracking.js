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
      w.fbq("track", "PageView", {
        page_path: pagePath,
      });
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
