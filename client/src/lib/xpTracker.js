export async function awardXP({
  type,
  completedQuiz = false,
  dailyBonus = false,
}) {
  const token = localStorage.getItem("fj_token");
  if (!token) return;

  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/progress/update`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, completedQuiz, dailyBonus }),
      },
    );
    const data = await res.json();
    console.log("✅ XP updated:", data);
  } catch (err) {
    console.error("❌ XP update failed:", err);
  }
}
