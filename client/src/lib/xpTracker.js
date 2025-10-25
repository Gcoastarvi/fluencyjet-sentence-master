import { API_BASE } from "@/lib/api"; // ✅ use your centralized config

export async function awardXP({
  xpEarned,
  type = "typing",
  completedQuiz = false,
  dailyBonus = false,
}) {
  const token = localStorage.getItem("fj_token");
  if (!token) {
    console.warn("⚠️ No token found — user not logged in.");
    return;
  }

  try {
    // determine XP automatically if not passed
    let points = typeof xpEarned === "number" ? xpEarned : 0;
    if (!xpEarned) {
      if (type === "typing") points += 150;
      if (completedQuiz) points += 300;
      if (dailyBonus) points += 200;
    }

    const res = await fetch(`${API_BASE}/api/progress/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        xpEarned: points,
        type,
        completedQuiz,
        dailyBonus,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("❌ XP update failed:", data);
      throw new Error(data?.message || "XP update failed");
    }

    console.log("✅ XP updated successfully:", data);
    return data; // contains xp, streak, etc.
  } catch (err) {
    console.error("❌ XP update error:", err);
  }
}
