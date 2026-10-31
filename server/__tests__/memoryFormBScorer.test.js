import {
  scoreSchoolFoundationFormB,
} from "../services/memoryFormBScorer.js";

const WORDS = [
  "camera", "banana", "elephant", "fork", "balloon",
  "ladder", "river", "helmet", "ring", "bell",
];

const ORDER = [
  "chair", "moon", "train", "flower", "shoe", "pencil",
];

const ASSOCIATIONS = {
  drum: "46",
  butterfly: "73",
  coconut: "28",
  ship: "61",
  glove: "35",
};

const ACADEMIC = {
  habitat: "dry hills",
  insects: "noris",
  flowers: "four",
  rain_month: "november",
  root_duration: "six months",
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

describe("Class 6-8 Form B authoritative scoring", () => {
  test("perfect answers score 100 out of 100", () => {
    const result = scoreSchoolFoundationFormB(
      perfectAnswers(),
    );

    expect(result.trackId).toBe("school_foundation");
    expect(result.form).toBe("B");
    expect(result.maxScore).toBe(100);
    expect(result.totalScore).toBe(100);
    expect(result.retentionRatio).toBe(1);

    expect(
      Object.values(result.modules).map(
        (module) => module.weightedScore
      )
    ).toEqual([20, 15, 20, 25, 20]);
  });

  test("empty submission scores zero", () => {
    const result = scoreSchoolFoundationFormB({});

    expect(result.totalScore).toBe(0);
    expect(result.retentionRatio).toBeNull();

    for (const module of Object.values(result.modules)) {
      expect(module.correct).toBe(0);
    }
  });

  test("partial answers receive proportional credit", () => {
    const result = scoreSchoolFoundationFormB({
      immediateAnswers: [
        "camera", "banana", "camera", "wrong",
      ],
      orderedAnswers: [
        "chair", "moon", "wrong",
      ],
      associationAnswers: {
        drum: "46",
        ship: "61",
        coconut: "99",
      },
      academicAnswers: {
        habitat: "dry hills",
        flowers: "four",
      },
      delayedAnswers: ["banana"],
    });

    expect(result.modules.immediate.weightedScore).toBe(4);
    expect(result.modules.ordered.weightedScore).toBe(5);
    expect(result.modules.association.weightedScore).toBe(8);
    expect(result.modules.academic.weightedScore).toBe(10);
    expect(result.modules.delayed.weightedScore).toBe(2);

    expect(result.totalScore).toBe(29);
    expect(result.retentionRatio).toBe(0.5);
  });

  test("duplicate words cannot earn duplicate credit", () => {
    const result = scoreSchoolFoundationFormB({
      immediateAnswers: Array(10).fill("camera"),
      delayedAnswers: Array(10).fill("banana"),
    });

    expect(result.modules.immediate.correct).toBe(1);
    expect(result.modules.delayed.correct).toBe(1);
    expect(result.totalScore).toBe(4);
  });

  test("minor spelling errors retain Form A tolerance", () => {
    const result = scoreSchoolFoundationFormB({
      immediateAnswers: ["camra", "banana"],
    });

    expect(result.modules.immediate.correct).toBe(2);
    expect(result.modules.immediate.weightedScore).toBe(4);
  });

  test("ordered recall requires correct positions", () => {
    const result = scoreSchoolFoundationFormB({
      orderedAnswers: [...ORDER].reverse(),
    });

    expect(result.modules.ordered.correct).toBe(0);
    expect(result.modules.ordered.weightedScore).toBe(0);
  });

  test("association answers must match the correct pair", () => {
    const result = scoreSchoolFoundationFormB({
      associationAnswers: {
        drum: "73",
        butterfly: "46",
        coconut: "28",
      },
    });

    expect(result.modules.association.correct).toBe(1);
    expect(result.modules.association.weightedScore).toBe(4);
  });

  test("academic answers accept reasonable wording", () => {
    const result = scoreSchoolFoundationFormB({
      academicAnswers: {
        habitat: "It grows on dry hills.",
        insects: "Noris!",
        flowers: "Four yellow flowers",
        rain_month: "In November",
        root_duration: "About six months",
      },
    });

    expect(result.modules.academic.correct).toBe(5);
    expect(result.modules.academic.weightedScore).toBe(25);
  });

  test("Form A answers do not earn Form B credit", () => {
    const result = scoreSchoolFoundationFormB({
      immediateAnswers: [
        "bicycle", "candle", "tiger", "spoon", "kite",
        "key", "mountain", "bottle", "crown", "clock",
      ],
      orderedAnswers: [
        "book", "fish", "star", "bus", "leaf", "cup",
      ],
      associationAnswers: {
        rocket: "24",
        umbrella: "57",
        guitar: "31",
        apple: "68",
        boat: "42",
      },
      academicAnswers: {
        habitat: "near cool mountain lakes",
        grass: "velin",
        eggs: "three",
        leave_month: "october",
        parent_duration: "four months",
      },
      delayedAnswers: [
        "bicycle", "candle", "tiger", "spoon", "kite",
        "key", "mountain", "bottle", "crown", "clock",
      ],
    });

    expect(result.totalScore).toBe(0);
  });

  test("delayed recall uses Form B words", () => {
    const result = scoreSchoolFoundationFormB({
      immediateAnswers: ["camera", "banana"],
      delayedAnswers: ["camera", "banana", "elephant"],
    });

    expect(result.modules.delayed.correct).toBe(3);
    expect(result.modules.delayed.weightedScore).toBe(6);
    expect(result.retentionRatio).toBe(1.5);
  });

  test("retention is null when immediate recall is zero", () => {
    const result = scoreSchoolFoundationFormB({
      delayedAnswers: ["camera"],
    });

    expect(result.modules.delayed.correct).toBe(1);
    expect(result.retentionRatio).toBeNull();
  });

  test("malformed answer types do not earn credit", () => {
    const result = scoreSchoolFoundationFormB({
      immediateAnswers: "camera",
      orderedAnswers: { 0: "chair" },
      associationAnswers: [],
      academicAnswers: [],
      delayedAnswers: 123,
    });

    expect(result.totalScore).toBe(0);
  });

  test("scoring does not modify submitted answers", () => {
    const answers = perfectAnswers();
    const original = structuredClone(answers);

    scoreSchoolFoundationFormB(answers);

    expect(answers).toEqual(original);
  });
});
