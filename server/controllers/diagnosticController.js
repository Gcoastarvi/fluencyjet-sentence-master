// server/controllers/diagnosticController.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/diagnostic/quiz
 * Returns the active diagnostic quiz + questions
 */
export async function getDiagnosticQuiz(req, res) {
  try {
    const quiz = await prisma.quiz.findFirst({
      where: { type: "DIAGNOSTIC", isActive: true },
    });

    if (!quiz) {
      return res
        .status(404)
        .json({ ok: false, message: "No active diagnostic quiz found" });
    }

    const questions = await prisma.diagnosticQuestion.findMany({
      where: { quizId: quiz.id },
      // no orderBy unless your schema has a field for it
      select: {
        id: true,
        questionText: true,
        level: true,
        skillTag: true,
      },
    });

    return res.json({
      ok: true,
      quiz: { id: quiz.id, title: quiz.title },
      questions,
    });
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
 * Body: { quizId, answers: [{ questionId, answer }] }
 */
export async function submitDiagnostic(req, res) {
  try {
    const { quizId, answers } = req.body;

    if (!quizId || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ ok: false, message: "Invalid payload" });
    }

    const questionIds = answers.map((a) => a.questionId);

    const questions = await prisma.diagnosticQuestion.findMany({
      where: { id: { in: questionIds }, quizId },
      select: { id: true, correctAnswer: true, skillTag: true },
    });

    // map for quick lookup
    const qMap = new Map(questions.map((q) => [q.id, q]));

    let score = 0;
    const weaknessCount = {}; // { grammar: 2, tense: 1, ... }

    for (const a of answers) {
      const q = qMap.get(a.questionId);
      if (!q) continue;

      const userAns = String(a.answer ?? "").trim();
      const correct = String(q.correctAnswer ?? "").trim();

      if (userAns.toLowerCase() === correct.toLowerCase()) {
        score += 1;
      } else {
        const tag = q.skillTag || "unknown";
        weaknessCount[tag] = (weaknessCount[tag] || 0) + 1;
      }
    }

    // 6 questions launch default (tweak anytime)
    let level = "BEGINNER";
    if (score >= 4) level = "INTERMEDIATE";
    if (score >= 5) level = "ADVANCED";

    const weaknesses = Object.entries(weaknessCount)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);

    return res.json({ ok: true, score, level, weaknesses });
  } catch (err) {
    console.error("❌ submitDiagnostic error:", err);
    return res.status(500).json({
      ok: false,
      message: "Submission failed",
      error: err.message,
    });
  }
}
