// server/controllers/diagnosticController.js
import prisma from "../db/client.js";

/**
 * GET /api/diagnostic/quiz
 * Public endpoint – no auth
 * Returns diagnostic questions stored in Quiz table (type = "DIAGNOSTIC")
 */
export async function getDiagnosticQuiz(req, res) {
  try {
    const rows = await prisma.quiz.findMany({
      where: { type: "DIAGNOSTIC" }, // ✅ no isActive (it doesn't exist)
      orderBy: { id: "asc" },
      select: {
        id: true,
        type: true,
        question: true,
        prompt: true,
        data: true,
        xpReward: true,
      },
    });

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message:
          "No diagnostic questions seeded (Quiz.type='DIAGNOSTIC' is empty)",
      });
    }

    const questions = rows.map((q) => ({
      questionId: q.id,
      type: q.type,
      question: q.question,
      prompt: q.prompt,
      // optional fields if you store them inside `data`
      options: q.data?.options || null,
      tag: q.data?.tag || null,
      difficulty: q.data?.difficulty || null,
    }));

    return res.json({ ok: true, questions });
  } catch (err) {
    console.error("❌ getDiagnosticQuiz error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to load questions",
      error: err.message,
    });
  }
}

/**
 * POST /api/diagnostic/submit
 * body: { answers: [{ questionId, answer }], anonId? }
 * Public endpoint – no auth
 */
export async function submitDiagnostic(req, res) {
  try {
    const { answers } = req.body || {};
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ ok: false, message: "Invalid payload" });
    }

    const ids = answers.map((a) => a.questionId).filter(Boolean);

    const rows = await prisma.quiz.findMany({
      where: { id: { in: ids } },
      select: { id: true, data: true },
    });

    // Build lookup
    const byId = new Map(rows.map((r) => [r.id, r]));

    let score = 0;
    const weaknesses = new Set();

    for (const a of answers) {
      const row = byId.get(a.questionId);
      if (!row) continue;

      const correct =
        row.data?.correctAnswer ??
        row.data?.answer ??
        row.data?.correct ??
        null;

      if (a.answer === correct) score++;
      else weaknesses.add(row.data?.tag || "sentence_flow");
    }

    let level = "BEGINNER";
    if (score >= 5) level = "INTERMEDIATE";
    if (score >= 8) level = "ADVANCED";

    return res.json({
      ok: true,
      score,
      level,
      weaknesses: Array.from(weaknesses),
    });
  } catch (err) {
    console.error("❌ submitDiagnostic error:", err);
    return res.status(500).json({
      ok: false,
      message: "Submission failed",
      error: err.message,
    });
  }
}
