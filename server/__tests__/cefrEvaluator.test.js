import { describe, expect, test } from "@jest/globals";

import { evaluateCefrSubmission } from "../services/cefrEvaluator.js";

describe("evaluateCefrSubmission", () => {
  test("accepts an exact TOKEN_SEQUENCE", () => {
    const result = evaluateCefrSubmission({
      evaluationMode: "AUTO",
      answerKey: {
        type: "TOKEN_SEQUENCE",
        tokens: ["Guten", "Morgen."],
      },
      submittedAnswer: {
        tokens: ["Guten", "Morgen."],
      },
    });

    expect(result).toEqual({
      ok: true,
      isCorrect: true,
      evaluationCode: "CORRECT",
      score: 1,
    });
  });

  test("fails closed when TOKEN_SEQUENCE answerKey configuration is invalid", () => {
    const result = evaluateCefrSubmission({
      evaluationMode: "AUTO",
      answerKey: {
        type: "TOKEN_SEQUENCE",
      },
      submittedAnswer: {
        tokens: ["Guten", "Morgen."],
      },
    });

    expect(result.ok).toBe(false);
    expect(result.evaluationCode).toBe("EVALUATOR_CONFIG_ERROR");
  });

  test("rejects a TOKEN_SEQUENCE in the wrong order", () => {
    const result = evaluateCefrSubmission({
      evaluationMode: "AUTO",
      answerKey: {
        type: "TOKEN_SEQUENCE",
        tokens: ["Ich", "heiße", "Aravind."],
      },
      submittedAnswer: {
        tokens: ["Aravind.", "heiße", "Ich"],
      },
    });

    expect(result).toEqual({
      ok: true,
      isCorrect: false,
      evaluationCode: "INCORRECT",
      score: 0,
    });
  });

  test("TEXT can use configured case-insensitive whitespace normalization", () => {
    const result = evaluateCefrSubmission({
      evaluationMode: "AUTO",
      answerKey: {
        type: "TEXT",
        acceptedAnswers: ["Guten Morgen."],
        normalization: {
          trim: true,
          collapseWhitespace: true,
          caseSensitive: false,
        },
      },
      submittedAnswer: {
        text: "   guten   morgen.  ",
      },
    });

    expect(result).toEqual({
      ok: true,
      isCorrect: true,
      evaluationCode: "CORRECT",
      score: 1,
    });
  });

  test("TEXT remains case-sensitive unless configuration says otherwise", () => {
    const result = evaluateCefrSubmission({
      evaluationMode: "AUTO",
      answerKey: {
        type: "TEXT",
        acceptedAnswers: ["Sie sind hier."],
      },
      submittedAnswer: {
        text: "sie sind hier.",
      },
    });

    expect(result).toEqual({
      ok: true,
      isCorrect: false,
      evaluationCode: "INCORRECT",
      score: 0,
    });
  });

  test("TEXT accepts explicitly configured answer variants", () => {
    const result = evaluateCefrSubmission({
      evaluationMode: "AUTO",
      answerKey: {
        type: "TEXT",
        acceptedAnswers: ["Ich heiße Anna.", "Ich heisse Anna."],
        normalization: {
          trim: true,
          collapseWhitespace: true,
          caseSensitive: false,
        },
      },
      submittedAnswer: {
        text: "ich heisse anna.",
      },
    });

    expect(result.isCorrect).toBe(true);
    expect(result.evaluationCode).toBe("CORRECT");
  });

  test("evaluates SINGLE_CHOICE by stable option id", () => {
    const correct = evaluateCefrSubmission({
      evaluationMode: "AUTO",
      answerKey: {
        type: "SINGLE_CHOICE",
        correctOptionId: "option-b",
      },
      submittedAnswer: {
        optionId: "option-b",
      },
    });

    const wrong = evaluateCefrSubmission({
      evaluationMode: "AUTO",
      answerKey: {
        type: "SINGLE_CHOICE",
        correctOptionId: "option-b",
      },
      submittedAnswer: {
        optionId: "option-a",
      },
    });

    expect(correct.isCorrect).toBe(true);
    expect(wrong.isCorrect).toBe(false);
  });

  test("SELF_ATTESTED completion is not represented as objective correctness", () => {
    const result = evaluateCefrSubmission({
      evaluationMode: "SELF_ATTESTED",
      answerKey: null,
      submittedAnswer: {
        completed: true,
      },
    });

    expect(result).toEqual({
      ok: true,
      isCorrect: null,
      evaluationCode: "SELF_ATTESTED_COMPLETE",
      score: null,
    });
  });

  test("rejects an invalid submitted-answer shape", () => {
    const result = evaluateCefrSubmission({
      evaluationMode: "AUTO",
      answerKey: {
        type: "TEXT",
        acceptedAnswers: ["Hallo."],
      },
      submittedAnswer: {},
    });

    expect(result.ok).toBe(false);
    expect(result.evaluationCode).toBe("INVALID_SUBMISSION");
  });

  test("fails closed for an unsupported evaluator configuration", () => {
    const result = evaluateCefrSubmission({
      evaluationMode: "AUTO",
      answerKey: {
        type: "UNKNOWN_TYPE",
      },
      submittedAnswer: {
        text: "Hallo.",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.evaluationCode).toBe("EVALUATOR_CONFIG_ERROR");
  });
});
