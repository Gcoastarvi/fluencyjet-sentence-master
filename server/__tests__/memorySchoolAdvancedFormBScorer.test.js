import {
  scoreSchoolAdvancedFormB,
} from "../services/memorySchoolAdvancedFormBScorer.js";

const WORDS = [
  "globe", "orange", "eagle", "scissors",
  "necklace", "window", "bridge", "blanket",
  "candle", "coin", "castle", "scooter",
];

const ORDER = [
  "star", "bottle", "lion", "bell",
  "boat", "flower", "pencil", "hat",
];

const ASSOCIATIONS = {
  camera: "47",
  coconut: "62",
  ladder: "29",
  drum: "54",
  rocket: "38",
  peacock: "76",
};

const ACADEMIC = {
  zones: "three",
  restricted_zone: "core zone",
  inspection_frequency: "every two months",
  watch_months: "January to March",
  smoke_reporting: "15 minutes",
  scientific_review: "every four years",
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

describe("Classes 9-12 Form B authoritative scoring", () => {
  test("perfect answers score 100/100", () => {
    const result = scoreSchoolAdvancedFormB(
      perfectAnswers(),
    );

    expect(result.trackId).toBe("school_advanced");
    expect(result.form).toBe("B");
    expect(result.totalScore).toBe(100);
    expect(result.maxScore).toBe(100);
    expect(result.retentionRatio).toBe(1);

    expect(
      Object.values(result.modules).map(
        (module) => module.weightedScore,
      ),
    ).toEqual([20, 15, 20, 25, 20]);
  });

  test("empty answers score zero", () => {
    const result = scoreSchoolAdvancedFormB({});

    expect(result.totalScore).toBe(0);
    expect(result.retentionRatio).toBeNull();

    for (const module of Object.values(result.modules)) {
      expect(module.correct).toBe(0);
    }
  });

  test("partial answers receive proportional credit", () => {
    const result = scoreSchoolAdvancedFormB({
      immediateAnswers: [
        "globe", "orange", "eagle",
      ],
      orderedAnswers: ORDER.slice(0, 4),
      associationAnswers: {
        camera: "47",
        coconut: "62",
        ladder: "29",
      },
      academicAnswers: {
        zones: "three",
        restricted_zone: "core zone",
      },
      delayedAnswers: ["globe"],
    });

    expect(result.modules.immediate.weightedScore).toBe(5);
    expect(result.modules.ordered.weightedScore).toBe(7.5);
    expect(result.modules.association.weightedScore).toBe(10);
    expect(result.modules.academic.weightedScore).toBe(8.33);
    expect(result.modules.delayed.weightedScore).toBe(1.67);

    expect(result.totalScore).toBe(32.5);
    expect(result.retentionRatio).toBe(0.333);
  });

  test("duplicate words earn credit only once", () => {
    const result = scoreSchoolAdvancedFormB({
      immediateAnswers: Array(12).fill("globe"),
      delayedAnswers: Array(12).fill("orange"),
    });

    expect(result.modules.immediate.correct).toBe(1);
    expect(result.modules.delayed.correct).toBe(1);
  });

  test("minor spelling mistakes are tolerated", () => {
    const result = scoreSchoolAdvancedFormB({
      immediateAnswers: ["glob", "ornge"],
    });

    expect(result.modules.immediate.correct).toBe(2);
  });

  test("ordered recall requires correct positions", () => {
    const result = scoreSchoolAdvancedFormB({
      orderedAnswers: [...ORDER].reverse(),
    });

    expect(result.modules.ordered.correct).toBe(0);
    expect(result.modules.ordered.weightedScore).toBe(0);
  });

  test("association numbers must match their words", () => {
    const result = scoreSchoolAdvancedFormB({
      associationAnswers: {
        camera: "62",
        coconut: "47",
        ladder: "29",
      },
    });

    expect(result.modules.association.correct).toBe(1);
  });

  test("academic answers accept natural wording", () => {
    const result = scoreSchoolAdvancedFormB({
      academicAnswers: {
        zones: "There are three zones.",
        restricted_zone: "The core zone.",
        inspection_frequency: "Every two months.",
        watch_months: "From January to March.",
        smoke_reporting: "Within fifteen minutes.",
        scientific_review: "Once every four years.",
      },
    });

    expect(result.modules.academic.correct).toBe(6);
    expect(result.modules.academic.weightedScore).toBe(25);
  });

  test("Form A answers do not earn Form B credit", () => {
    const result = scoreSchoolAdvancedFormB({
      immediateAnswers: [
        "lantern", "falcon", "anchor", "helmet",
        "violin", "ladder", "compass", "marble",
        "jacket", "river", "camera", "walnut",
      ],
      orderedAnswers: [
        "moon", "chair", "drum", "train",
        "orange", "ring", "horse", "shell",
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
        reed: "mavin",
        bird_species: "42",
        reeds_planted: "600",
        water_depth_frequency: "twice a month",
      },
      delayedAnswers: [
        "lantern", "falcon", "anchor", "helmet",
        "violin", "ladder", "compass", "marble",
        "jacket", "river", "camera", "walnut",
      ],
    });

    expect(result.totalScore).toBe(0);
  });

  test("delayed recall uses the Form B word list", () => {
    const result = scoreSchoolAdvancedFormB({
      immediateAnswers: ["globe", "orange"],
      delayedAnswers: [
        "globe", "orange", "eagle",
      ],
    });

    expect(result.modules.delayed.correct).toBe(3);
    expect(result.retentionRatio).toBe(1.5);
  });

  test("retention is null when immediate recall is zero", () => {
    const result = scoreSchoolAdvancedFormB({
      delayedAnswers: ["globe"],
    });

    expect(result.retentionRatio).toBeNull();
  });

  test("malformed answer types score zero", () => {
    const result = scoreSchoolAdvancedFormB({
      immediateAnswers: "globe",
      orderedAnswers: { 0: "star" },
      associationAnswers: [],
      academicAnswers: [],
      delayedAnswers: 123,
    });

    expect(result.totalScore).toBe(0);
  });

  test("scoring does not mutate submitted answers", () => {
    const answers = perfectAnswers();
    const original = structuredClone(answers);

    scoreSchoolAdvancedFormB(answers);

    expect(answers).toEqual(original);
  });
});
