import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/diagnostic/questions
 * Public endpoint – no auth
 */
export async function getDiagnosticQuestions(req, res) {
  try {
    const questions = await prisma.diagnosticQuestion.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        type: true,
        promptTa: true,
        structureEn: true,
        options: true,
      },
    });

    res.json({ ok: true, questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Failed to load questions" });
  }
}

/**
 * POST /api/diagnostic/submit
 * Accepts answers + returns level
 */
export async function submitDiagnostic(req, res) {
  try {
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ ok: false, message: "Invalid payload" });
    }

    // Fetch correct answers
    const questions = await prisma.diagnosticQuestion.findMany({
      where: { id: { in: answers.map((a) => a.questionId) } },
    });

    let score = 0;
    let weaknesses = new Set();

    for (const q of questions) {
      const userAnswer = answers.find((a) => a.questionId === q.id)?.answer;
      const correct = q.expected?.answer;

      if (userAnswer === correct) {
        score++;
      } else {
        weaknesses.add(q.tag || "sentence_flow");
      }
    }

    // 🔥 SIMPLE LEVEL LOGIC (launch-safe)
    let level = "BEGINNER";
    if (score >= 5) level = "INTERMEDIATE";
    if (score >= 8) level = "ADVANCED";

    // Save attempt (anonymous for now)
    await prisma.diagnosticAttempt.create({
      data: {
        score,
        level,
        weaknesses: Array.from(weaknesses),
      },
    });

    res.json({
      ok: true,
      score,
      level,
      weaknesses: Array.from(weaknesses),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Submission failed" });
  }
}
