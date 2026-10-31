import {
  scoreAdvancedFormB,
} from "../services/memoryAdvancedFormBScorer.js";

import advancedFormA from "../../client/src/data/memory/advancedFormA.js";

const WORDS = [
  "globe", "silver", "eagle", "cotton",
  "garden", "passport", "pebble", "palace",
  "basket", "necklace", "bridge", "jacket",
  "curtain", "sapphire",
];

const ORDER = [
  "crane", "olive", "gate", "peach", "wave",
  "mask", "branch", "radio", "moss", "mouse",
];

const ASSOCIATIONS = {
  peacock: "34",
  factory: "76",
  puzzle: "58",
  market: "43",
  kitchen: "89",
  bakery: "25",
  jungle: "61",
};

const ACADEMIC = {
  apartments: "240",
  daily_water: "3.6 million litres",
  leak_reduction: "29 percent",
  sections: "six",
  sensor_frequency: "every 12 minutes",
  inspection_day: "Tuesday",
  district: "western district",
};

function perfectAnswers() {
  return {
    immediateAnswers: [...WORDS],
    orderedAnswers: [...ORDER],
    associationAnswers: { ...ASSOCIATIONS },
    academicAnswers: { ...ACADEMIC },
    delayedAnswers: [...WORDS],
  };
}

describe("Advanced Form B authoritative scoring", () => {
  test("perfect answers score 100/100", () => {
    const result = scoreAdvancedFormB(perfectAnswers());

    expect(result.trackId).toBe("advanced");
    expect(result.form).toBe("B");
    expect(result.totalScore).toBe(100);
    expect(result.maxScore).toBe(100);
    expect(result.retentionRatio).toBe(1);

    expect(
      Object.values(result.modules).map(
        module => module.weightedScore,
      ),
    ).toEqual([20, 15, 20, 25, 20]);
  });

  test("empty answers score zero", () => {
    const result = scoreAdvancedFormB({});

    expect(result.totalScore).toBe(0);
    expect(result.retentionRatio).toBeNull();

    for (const module of Object.values(result.modules)) {
      expect(module.correct).toBe(0);
    }
  });

  test("partial answers receive proportional credit", () => {
    const result = scoreAdvancedFormB({
      immediateAnswers: WORDS.slice(0, 7),
      orderedAnswers: ORDER.slice(0, 4),
      associationAnswers: {
        peacock: "34",
        factory: "76",
        puzzle: "58",
      },
      academicAnswers: {
        apartments: "240",
        daily_water: "3.6 million litres",
      },
      delayedAnswers: ["globe", "silver"],
    });

    expect(result.modules.immediate.weightedScore).toBe(10);
    expect(result.modules.ordered.weightedScore).toBe(6);
    expect(result.modules.association.weightedScore).toBe(8.57);
    expect(result.modules.academic.weightedScore).toBe(7.14);
    expect(result.modules.delayed.weightedScore).toBe(2.86);

    expect(result.totalScore).toBe(34.57);
    expect(result.retentionRatio).toBe(0.286);
  });

  test("duplicate words earn credit only once", () => {
    const result = scoreAdvancedFormB({
      immediateAnswers: Array(14).fill("globe"),
      delayedAnswers: Array(14).fill("silver"),
    });

    expect(result.modules.immediate.correct).toBe(1);
    expect(result.modules.delayed.correct).toBe(1);
    expect(result.totalScore).toBe(2.86);
  });

  test("minor spelling errors are tolerated", () => {
    const result = scoreAdvancedFormB({
      immediateAnswers: ["glbe", "saphire"],
    });

    expect(result.modules.immediate.correct).toBe(2);
  });

  test("ordered recall requires correct positions", () => {
    const result = scoreAdvancedFormB({
      orderedAnswers: [...ORDER].reverse(),
    });

    expect(result.modules.ordered.correct).toBe(0);
    expect(result.modules.ordered.weightedScore).toBe(0);
  });

  test("association numbers must match their words", () => {
    const result = scoreAdvancedFormB({
      associationAnswers: {
        peacock: "76",
        factory: "34",
        kitchen: "89",
      },
    });

    expect(result.modules.association.correct).toBe(1);
    expect(result.modules.association.weightedScore).toBe(2.86);
  });

  test("academic answers accept natural wording", () => {
    const result = scoreAdvancedFormB({
      academicAnswers: {
        apartments: "It serves 240 apartment buildings.",
        daily_water: "About 3.6 million litres each day.",
        leak_reduction: "Water loss decreased by 29 percent.",
        sections: "The network has six sections.",
        sensor_frequency: "Every twelve minutes.",
        inspection_day: "Every Tuesday.",
        district: "It began in the western district.",
      },
    });

    expect(result.modules.academic.correct).toBe(7);
    expect(result.modules.academic.weightedScore).toBe(25);
  });

  test("Form A words earn no Form B recall credit", () => {
    const oldWords = advancedFormA.modules
      .find(module => module.id === "immediate")
      .items.map(item => item.id);

    const result = scoreAdvancedFormB({
      immediateAnswers: oldWords,
      delayedAnswers: oldWords,
    });

    expect(result.modules.immediate.correct).toBe(0);
    expect(result.modules.delayed.correct).toBe(0);
  });

  test("delayed recall uses Form B words", () => {
    const result = scoreAdvancedFormB({
      immediateAnswers: ["globe", "silver"],
      delayedAnswers: [
        "globe", "silver", "eagle",
      ],
    });

    expect(result.modules.delayed.correct).toBe(3);
    expect(result.retentionRatio).toBe(1.5);
  });

  test("retention is null when immediate recall is zero", () => {
    const result = scoreAdvancedFormB({
      delayedAnswers: ["globe"],
    });

    expect(result.modules.delayed.correct).toBe(1);
    expect(result.retentionRatio).toBeNull();
  });

  test("malformed answer types score zero", () => {
    const result = scoreAdvancedFormB({
      immediateAnswers: "globe",
      orderedAnswers: { 0: "crane" },
      associationAnswers: [],
      academicAnswers: [],
      delayedAnswers: 123,
    });

    expect(result.totalScore).toBe(0);
  });

  test("scoring does not mutate submitted answers", () => {
    const answers = perfectAnswers();
    const original = structuredClone(answers);

    scoreAdvancedFormB(answers);

    expect(answers).toEqual(original);
  });
});
