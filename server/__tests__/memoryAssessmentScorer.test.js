import { describe, expect, test } from "@jest/globals";
import {
  conceptMatches,
  scoreSchoolFoundationFormA,
} from "../services/memoryAssessmentScorer.js";

const PERFECT = {
  immediateAnswers: [
    "Bicycle",
    "Candle",
    "Tiger",
    "Spoon",
    "Kite",
    "Key",
    "Mountain",
    "Bottle",
    "Crown",
    "Clock",
  ],

  orderedAnswers: [
    "book",
    "fish",
    "star",
    "bus",
    "leaf",
    "cup",
  ],

  associationAnswers: {
    rocket: "24",
    umbrella: "57",
    guitar: "31",
    apple: "68",
    boat: "42",
  },

  academicAnswers: {
    habitat: "Near cool mountain lakes",
    grass: "velin",
    eggs: "3",
    leave_month: "October",
    parent_duration: "4 months",
  },

  delayedAnswers: [
    "Bicycle",
    "Candle",
    "Tiger",
    "Spoon",
    "Kite",
    "Key",
    "Mountain",
    "Bottle",
    "Crown",
    "Clock",
  ],
};

describe("Class 6–8 Form A Study Recall scoring", () => {
  test("returns 100/100 for a perfect Form A submission", () => {
    const result = scoreSchoolFoundationFormA(PERFECT);

    expect(result).toMatchObject({
      trackId: "school_foundation",
      form: "A",
      totalScore: 100,
      maxScore: 100,
      retentionRatio: 1,
    });

    expect(result.modules.immediate).toMatchObject({
      correct: 10,
      maxRaw: 10,
      weightedScore: 20,
      maxWeighted: 20,
      percentage: 100,
    });

    expect(result.modules.ordered.weightedScore).toBe(15);
    expect(result.modules.association.weightedScore).toBe(20);
    expect(result.modules.academic.weightedScore).toBe(25);
    expect(result.modules.delayed.weightedScore).toBe(20);
  });

  test("calculates a mixed score using the specified domain weights", () => {
    const result = scoreSchoolFoundationFormA({
      immediateAnswers: [
        "bicycle",
        "candle",
        "tiger",
        "spoon",
        "kite",
      ],

      orderedAnswers: [
        "book",
        "wrong",
        "star",
        "wrong",
        "leaf",
        "wrong",
      ],

      associationAnswers: {
        rocket: "24",
        umbrella: "57",
        guitar: "999",
        apple: "68",
        boat: "",
      },

      academicAnswers: {
        habitat: "They live near cool mountain lakes.",
        grass: "velin",
        eggs: "wrong",
        leave_month: "October",
        parent_duration: "",
      },

      delayedAnswers: [
        "bicycle",
        "candle",
        "tiger",
        "spoon",
      ],
    });

    expect(result.modules.immediate).toMatchObject({
      correct: 5,
      percentage: 50,
      weightedScore: 10,
    });

    expect(result.modules.ordered).toMatchObject({
      correct: 3,
      percentage: 50,
      weightedScore: 7.5,
    });

    expect(result.modules.association).toMatchObject({
      correct: 3,
      percentage: 60,
      weightedScore: 12,
    });

    expect(result.modules.academic).toMatchObject({
      correct: 3,
      percentage: 60,
      weightedScore: 15,
    });

    expect(result.modules.delayed).toMatchObject({
      correct: 4,
      percentage: 40,
      weightedScore: 8,
    });

    expect(result.totalScore).toBe(52.5);
    expect(result.retentionRatio).toBe(0.8);
  });

  test("allows conservative one-character spelling mistakes for recall concepts", () => {
    expect(conceptMatches("bicycl", "bicycle")).toBe(true);
    expect(conceptMatches("candl", "candle")).toBe(true);
    expect(conceptMatches("mountan", "mountain")).toBe(true);

    expect(conceptMatches("car", "crown")).toBe(false);
    expect(conceptMatches("ki", "key")).toBe(false);
  });

  test("does not award duplicate concept credit", () => {
    const result = scoreSchoolFoundationFormA({
      immediateAnswers: [
        "bicycle",
        "BICYCLE",
        "bicycl",
        "candle",
        "candl",
      ],
    });

    expect(result.modules.immediate.correct).toBe(2);
    expect(result.modules.immediate.weightedScore).toBe(4);
  });

  test("scores Ordered Recall only by exact position", () => {
    const result = scoreSchoolFoundationFormA({
      orderedAnswers: [
        "fish",
        "book",
        "star",
        "bus",
        "cup",
        "leaf",
      ],
    });

    expect(result.modules.ordered.correct).toBe(2);
    expect(result.modules.ordered.weightedScore).toBe(5);
  });

  test("accepts reasonable full-sentence Academic Recall responses", () => {
    const result = scoreSchoolFoundationFormA({
      academicAnswers: {
        habitat: "The bird lives near cool mountain lakes.",
        grass: "The special grass is velin.",
        eggs: "They usually lay three eggs.",
        leave_month: "They leave in October.",
        parent_duration:
          "Young birds remain with their parents for about four months.",
      },
    });

    expect(result.modules.academic.correct).toBe(5);
    expect(result.modules.academic.weightedScore).toBe(25);
  });

  test("returns null retention ratio when Immediate Recall is zero", () => {
    const result = scoreSchoolFoundationFormA({
      delayedAnswers: ["bicycle"],
    });

    expect(result.modules.immediate.correct).toBe(0);
    expect(result.modules.delayed.correct).toBe(1);
    expect(result.retentionRatio).toBeNull();
  });

  test("handles empty or malformed submission fields safely", () => {
    const result = scoreSchoolFoundationFormA({
      immediateAnswers: "not-an-array",
      orderedAnswers: null,
      associationAnswers: [],
      academicAnswers: "wrong-shape",
      delayedAnswers: {},
    });

    expect(result.totalScore).toBe(0);
    expect(result.modules.immediate.correct).toBe(0);
    expect(result.modules.ordered.correct).toBe(0);
    expect(result.modules.association.correct).toBe(0);
    expect(result.modules.academic.correct).toBe(0);
    expect(result.modules.delayed.correct).toBe(0);
  });
});
