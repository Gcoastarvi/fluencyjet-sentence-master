// client/src/lib/xpTracker.js
import { API_BASE } from "@/lib/api";
import { getToken } from "@/utils/tokenStore";

function makeAttemptId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildProgressUrl(path) {
  // If API_BASE exists and is set, use it. Otherwise use same-origin (monolith safe).
  if (API_BASE && typeof API_BASE === "string") {
    const base = API_BASE.replace(/\/+$/, "");
    return `${base}${path}`;
  }
  return path; // same-origin
}

// Award XP for an action (typing/reorder/etc).
// This MUST send attemptId for idempotency on the server.
export async function awardXP({
  xpEarned = 0, // send 0 if you want server-side compute later
  event = "typing_correct", // backend expects 'event' (string)
  attemptNo = 1, // default attempt count
  lessonId = null, // optional, but strongly recommended
  meta = {}, // extra metadata to store
} = {}) {
  const token = getToken();
  if (!token) {
    console.warn("[XP] No auth token — skipping XP update.");
    return null;
  }

  const payload = {
    attemptId: makeAttemptId(),
    attemptNo,
    xp: Number(xpEarned) || 0,
    event,
    meta: {
      ...(meta || {}),
      ...(lessonId != null ? { lessonId } : {}),
    },
  };

  try {
    const res = await fetch(buildProgressUrl("/api/progress/update"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[XP] /progress/update failed", res.status, data);
      throw new Error(data?.message || data?.error || res.statusText);
    }

    console.log("✅ XP updated:", data);
    return data;
  } catch (err) {
    console.error("❌ XP update failed:", err);
    throw err;
  }
}

// Fetch the current user's progress (xp, streak, badges)
export async function fetchMyProgress() {
  const token = getToken();
  if (!token) return null;

  const res = await fetch(buildProgressUrl("/api/progress/me"), {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(data?.message || data?.error || "Could not load progress");
  return data;
}
