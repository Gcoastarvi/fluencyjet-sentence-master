const FUNNEL_SHEET_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbzOBVbSDnZj07DUn3fZjlqozs7ll7AbeqTuwA50t1wgxDN9R66Bm4l_f9x7Q1-qR8LzEg/exec";

function safeWindow() {
  return typeof window !== "undefined" ? window : null;
}

export function getStoredFunnelContext() {
  const w = safeWindow();

  let user = null;
  try {
    const raw = localStorage.getItem("user");
    user = raw ? JSON.parse(raw) : null;
  } catch {}

  let level = null;
  try {
    const raw = sessionStorage.getItem("fj_level_result");
    level = raw ? JSON.parse(raw) : null;
  } catch {}

  return {
    user,
    level,
    page_url: w?.location?.href || "",
    segment:
      user?.segment ||
      level?.segment ||
      localStorage.getItem("fj_level_segment") ||
      "general",
    main_goal:
      user?.main_goal ||
      level?.main_goal ||
      localStorage.getItem("fj_main_goal") ||
      "",
    track:
      user?.track ||
      level?.track ||
      localStorage.getItem("fj_track") ||
      "",
  };
}

export async function sendToFunnelSheet(payload = {}) {
  try {
    await fetch(FUNNEL_SHEET_WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("[Funnel Sheet] Failed:", error);
  }
}
