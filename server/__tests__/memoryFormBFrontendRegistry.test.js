import {
  describe,
  expect,
  test,
} from "@jest/globals";

import {
  getMemoryAssessment,
} from "../../client/src/data/memory/assessmentRegistry.js";

const TRACKS = [
  "school_foundation",
  "school_advanced",
  "advanced",
];

const MODULE_IDS = [
  "immediate",
  "ordered",
  "association",
  "academic",
  "delayed",
];

describe("Form A and Form B assessment registry", () => {
  test.each(TRACKS)(
    "preserves default Form A for %s",
    (trackId) => {
      const defaultAssessment =
        getMemoryAssessment(trackId);

      const explicitFormA =
        getMemoryAssessment(trackId, "A");

      expect(defaultAssessment).toBe(explicitFormA);
      expect(defaultAssessment.trackId).toBe(trackId);
      expect(defaultAssessment.form).toBe("A");
      expect(defaultAssessment.config.form).toBe("A");
    },
  );

  test.each(TRACKS)(
    "loads the correct Form B for %s",
    (trackId) => {
      const assessment =
        getMemoryAssessment(trackId, "B");

      expect(assessment).not.toBeNull();
      expect(assessment.trackId).toBe(trackId);
      expect(assessment.form).toBe("B");

      expect(assessment.config.trackId).toBe(trackId);
      expect(assessment.config.form).toBe("B");

      expect(
        assessment.config.modules.map(
          (module) => module.id,
        ),
      ).toEqual(MODULE_IDS);
    },
  );

  test.each(TRACKS)(
    "keeps Form A and B question data separate for %s",
    (trackId) => {
      const formA =
        getMemoryAssessment(trackId, "A");

      const formB =
        getMemoryAssessment(trackId, "B");

      expect(formB.config).not.toBe(formA.config);

      expect(formB.config.modules)
        .not.toBe(formA.config.modules);

      const aImmediate =
        formA.config.modules.find(
          (module) => module.id === "immediate",
        );

      const bImmediate =
        formB.config.modules.find(
          (module) => module.id === "immediate",
        );

      expect(bImmediate).not.toBe(aImmediate);

      expect(bImmediate.items)
        .not.toBe(aImmediate.items);

      expect(bImmediate.items)
        .not.toEqual(aImmediate.items);
    },
  );

  test("rejects unknown tracks", () => {
    expect(
      getMemoryAssessment("unknown", "A"),
    ).toBeNull();

    expect(
      getMemoryAssessment("unknown", "B"),
    ).toBeNull();
  });

  test("rejects unsupported form names", () => {
    expect(
      getMemoryAssessment("school_foundation", "C"),
    ).toBeNull();

    expect(
      getMemoryAssessment("school_foundation", "b"),
    ).toBeNull();
  });
});
