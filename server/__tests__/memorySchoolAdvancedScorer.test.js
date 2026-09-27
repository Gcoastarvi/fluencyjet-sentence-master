import { describe, expect, test } from "@jest/globals";
import { scoreSchoolAdvancedFormA } from "../services/memoryAssessmentScorer.js";

const PERFECT = {
  immediateAnswers: [
    "Lantern",
    "Falcon",
    "Anchor",
    "Helmet",
    "Violin",
    "Ladder",
    "Compass",
    "Marble",
    "Jacket",
    "River",
    "Camera",
    "Walnut",
  ],

  orderedAnswers: [
    "moon",
    "chair",
    "drum",
    "train",
    "orange",
    "ring",
    "horse",
    "shell",
  ],

  associationAnswers: {
    bridge: "63",
    planet: "28",
    feather: "74",
    orchid: "51",
    basket: "36",
    castle: "92",
  },

  academicAnswers: {
    location: "Beside a shallow freshwater lake in the northern hills",
    reed: "mavin",
    bird_species: "42",
    arrival_months: "November to January",
    reeds_planted: "600",
    water_depth_frequency: "twice each month",
  },

  delayedAnswers: [
    "Lantern",
    "Falcon",
    "Anchor",
    "Helmet",
    "Violin",
    "Ladder",
    "Compass",
    "Marble",
    "Jacket",
    "River",
    "Camera",
    "Walnut",
  ],
};

describe("Class 9–12 Form A Study Recall scoring", () => {
  test("returns 100/100 for a perfect submission", () => {
    const result = scoreSchoolAdvancedFormA(PERFECT);

    expect(result).toMatchObject({
      trackId: "school_advanced",
      form: "A",
      totalScore: 100,
      maxScore: 100,
      retentionRatio: 1,
    });

    expect(result.modules.immediate).toMatchObject({
      correct: 12,
      maxRaw: 12,
      weightedScore: 20,
      maxWeighted: 20,
      percentage: 100,
    });

    expect(result.modules.ordered).toMatchObject({
      correct: 8,
      maxRaw: 8,
      weightedScore: 15,
      percentage: 100,
    });

    expect(result.modules.association).toMatchObject({
      correct: 6,
      maxRaw: 6,
      weightedScore: 20,
      percentage: 100,
    });

    expect(result.modules.academic).toMatchObject({
      correct: 6,
      maxRaw: 6,
      weightedScore: 25,
      percentage: 100,
    });

    expect(result.modules.delayed).toMatchObject({
      correct: 12,
      maxRaw: 12,
      weightedScore: 20,
      percentage: 100,
    });
  });

  test("calculates weighted module scores correctly", () => {
    const result = scoreSchoolAdvancedFormA({
      immediateAnswers: [
        "lantern",
        "falcon",
        "anchor",
        "helmet",
        "violin",
        "ladder",
      ],

      orderedAnswers: [
        "moon",
        "wrong",
        "drum",
        "wrong",
        "orange",
        "wrong",
        "horse",
        "wrong",
      ],

      associationAnswers: {
        bridge: "63",
        planet: "28",
        feather: "999",
        orchid: "51",
        basket: "",
        castle: "92",
      },

      academicAnswers: {
        location: "It is in the northern hills.",
        reed: "mavin",
        bird_species: "wrong",
        arrival_months: "November through January",
        reeds_planted: "",
        water_depth_frequency: "twice a month",
      },

      delayedAnswers: [
        "lantern",
        "falcon",
        "anchor",
      ],
    });

    expect(result.modules.immediate).toMatchObject({
      correct: 6,
      percentage: 50,
      weightedScore: 10,
    });

    expect(result.modules.ordered).toMatchObject({
      correct: 4,
      percentage: 50,
      weightedScore: 7.5,
    });

    expect(result.modules.association).toMatchObject({
      correct: 4,
      percentage: 66.67,
      weightedScore: 13.33,
    });

    expect(result.modules.academic).toMatchObject({
      correct: 4,
      percentage: 66.67,
      weightedScore: 16.67,
    });

    expect(result.modules.delayed).toMatchObject({
      correct: 3,
      percentage: 25,
      weightedScore: 5,
    });

    expect(result.totalScore).toBe(52.5);
    expect(result.retentionRatio).toBe(0.5);
  });

  test("supports conservative spelling tolerance without duplicate credit", () => {
    const result = scoreSchoolAdvancedFormA({
      immediateAnswers: [
        "lanter",
        "falcn",
        "anchor",
        "anchor",
      ],
      delayedAnswers: [
        "lanter",
      ],
    });

    expect(result.modules.immediate.correct).toBe(3);
    expect(result.modules.delayed.correct).toBe(1);
  });

  test("returns null retention when immediate recall is zero", () => {
    const result = scoreSchoolAdvancedFormA({
      delayedAnswers: ["lantern"],
    });

    expect(result.modules.immediate.correct).toBe(0);
    expect(result.modules.delayed.correct).toBe(1);
    expect(result.retentionRatio).toBeNull();
  });

  test("handles malformed response shapes safely", () => {
    const result = scoreSchoolAdvancedFormA({
      immediateAnswers: "wrong-shape",
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
