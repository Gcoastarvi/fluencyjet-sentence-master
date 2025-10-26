// client/src/lib/xpTracker.js
import { API_BASE } from "@/lib/api";

// Award XP for a quiz action.
// You can pass nothing and let the server decide based on type/flags.
export async function awardXP({
  xpEarned, // optional (server can compute)
  type = "typing",
  completedQuiz = false,
  dailyBonus = false,
} = {}) {
  const token = localStorage.getItem("fj_token");
  if (!token) {
    console.warn("No auth token — skipping XP update.");
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/api/progress/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ xpEarned, type, completedQuiz, dailyBonus }),
    });

    // If the server ever returns HTML (like a 404 page), this will throw;
    // that's a clue your URL/base is wrong.
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || res.statusText);

    console.log("✅ XP updated:", data);
    return data; // the updated progress row
  } catch (err) {
    console.error("❌ XP update failed:", err);
    throw err;
  }
}

// Fetch the current user's progress (xp, streak, badges)
export async function fetchMyProgress() {
  const token = localStorage.getItem("fj_token");
  if (!token) return null;

  const res = await fetch(`${API_BASE}/api/progress/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Could not load progress");
  return data;
}
