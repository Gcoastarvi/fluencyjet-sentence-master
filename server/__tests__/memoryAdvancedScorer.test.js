import { scoreAdvancedFormA } from "../services/memoryAssessmentScorer.js";

const PERFECT = {
  immediateAnswers: [
    "telescope",
    "glacier",
    "kettle",
    "sparrow",
    "velvet",
    "tractor",
    "needle",
    "pyramid",
    "coconut",
    "magnet",
    "pillow",
    "desert",
    "mirror",
    "hammer",
  ],

  orderedAnswers: [
    "desk",
    "lemon",
    "bell",
    "ship",
    "coin",
    "zebra",
    "window",
    "brush",
    "pearl",
    "eagle",
  ],

  associationAnswers: {
    library: "84",
    volcano: "27",
    ribbon: "65",
    temple: "39",
    diamond: "72",
    coffee: "46",
    forest: "91",
  },

  academicAnswers: {
    homes_served: "180 homes",
    battery_capacity: "2.4 megawatt-hours",
    diesel_reduction: "38 percent",
    network_zones: "four zones",
    sensor_frequency: "every 15 minutes",
    physical_inspection: "each Friday",
    future_plan: "a second microgrid for the eastern valley",
  },

  delayedAnswers: [
    "telescope",
    "glacier",
    "kettle",
    "sparrow",
    "velvet",
    "tractor",
    "needle",
    "pyramid",
    "coconut",
    "magnet",
    "pillow",
    "desert",
    "mirror",
    "hammer",
  ],
};

describe("Advanced Form A scorer", () => {
  test("perfect responses score 100", () => {
    const result = scoreAdvancedFormA(PERFECT);

    expect(result.trackId).toBe("advanced");
    expect(result.form).toBe("A");
    expect(result.totalScore).toBe(100);
    expect(result.maxScore).toBe(100);
    expect(result.retentionRatio).toBe(1);

    expect(result.modules.immediate.correct).toBe(14);
    expect(result.modules.immediate.maxRaw).toBe(14);

    expect(result.modules.ordered.correct).toBe(10);
    expect(result.modules.ordered.maxRaw).toBe(10);

    expect(result.modules.association.correct).toBe(7);
    expect(result.modules.association.maxRaw).toBe(7);

    expect(result.modules.academic.correct).toBe(7);
    expect(result.modules.academic.maxRaw).toBe(7);

    expect(result.modules.delayed.correct).toBe(14);
    expect(result.modules.delayed.maxRaw).toBe(14);
  });

  test("mixed responses preserve weighted scoring", () => {
    const result = scoreAdvancedFormA({
      immediateAnswers: [
        "telescope",
        "glacier",
        "kettle",
        "sparrow",
        "velvet",
        "tractor",
        "needle",
      ],

      orderedAnswers: [
        "desk",
        "lemon",
        "bell",
        "ship",
        "coin",
        "wrong",
        "wrong",
        "wrong",
        "wrong",
        "wrong",
      ],

      associationAnswers: {
        library: "84",
        volcano: "27",
        ribbon: "65",
      },

      academicAnswers: {
        homes_served: "180",
        battery_capacity: "2.4 mwh",
        diesel_reduction: "38",
        network_zones: "4",
      },

      delayedAnswers: [
        "telescope",
        "glacier",
        "kettle",
        "sparrow",
        "velvet",
        "tractor",
        "needle",
      ],
    });

    expect(result.modules.immediate.correct).toBe(7);
    expect(result.modules.ordered.correct).toBe(5);
    expect(result.modules.association.correct).toBe(3);
    expect(result.modules.academic.correct).toBe(4);
    expect(result.modules.delayed.correct).toBe(7);

    expect(result.totalScore).toBe(50.36);
    expect(result.retentionRatio).toBe(1);
  });

  test("minor typo is accepted but duplicate recall receives no extra credit", () => {
    const result = scoreAdvancedFormA({
      immediateAnswers: [
        "telescop",
        "telescope",
        "glacir",
      ],

      delayedAnswers: [
        "glacir",
        "glacier",
      ],
    });

    expect(result.modules.immediate.correct).toBe(2);
    expect(result.modules.delayed.correct).toBe(1);
    expect(result.retentionRatio).toBe(0.5);
  });

  test("retention ratio is null when immediate recall is zero", () => {
    const result = scoreAdvancedFormA({
      immediateAnswers: [],
      delayedAnswers: ["telescope"],
    });

    expect(result.modules.immediate.correct).toBe(0);
    expect(result.modules.delayed.correct).toBe(1);
    expect(result.retentionRatio).toBeNull();
  });

  test("malformed and missing answers are handled safely", () => {
    const result = scoreAdvancedFormA({
      immediateAnswers: "not-an-array",
      orderedAnswers: null,
      associationAnswers: [],
      academicAnswers: "invalid",
      delayedAnswers: undefined,
    });

    expect(result.totalScore).toBe(0);
    expect(result.retentionRatio).toBeNull();

    expect(result.modules.immediate.correct).toBe(0);
    expect(result.modules.ordered.correct).toBe(0);
    expect(result.modules.association.correct).toBe(0);
    expect(result.modules.academic.correct).toBe(0);
    expect(result.modules.delayed.correct).toBe(0);
  });
});
