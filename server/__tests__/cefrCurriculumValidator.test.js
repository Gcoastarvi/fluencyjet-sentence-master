import { describe, expect, test } from "@jest/globals";

import { DAYS } from "../prisma/seed/cefrGermanA1Seed.js";
import {
  validateCefrCurriculum,
} from "../services/cefrCurriculumValidator.js";

function cloneDays() {
  return structuredClone(DAYS);
}

function findActivity(days, activityType) {
  for (const day of days) {
    const activity = day.activities.find(
      (candidate) => candidate.activityType === activityType,
    );

    if (activity) {
      return activity;
    }
  }

  throw new Error(`Activity type not found in fixture: ${activityType}`);
}

describe("validateCefrCurriculum", () => {
  test("accepts the current German A1 curriculum", () => {
    const result = validateCefrCurriculum({
      days: cloneDays(),
    });

    expect(result).toEqual({
      ok: true,
      errors: [],
    });
  });

  test("rejects duplicate dayNumber values", () => {
    const days = cloneDays();

    days[1].dayNumber = days[0].dayNumber;

    const result = validateCefrCurriculum({ days });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      `duplicate dayNumber "${days[0].dayNumber}"`,
    );
  });

  test("rejects duplicate activity keys within the same day", () => {
    const days = cloneDays();

    days[0].activities[1].key =
      days[0].activities[0].key;

    const result = validateCefrCurriculum({ days });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      `days[0]: duplicate activity key "${days[0].activities[0].key}"`,
    );
  });

  test("allows the same activity key on different days", () => {
    const days = cloneDays();

    days[1].activities[0].key =
      days[0].activities[0].key;

    const result = validateCefrCurriculum({ days });

    expect(result.ok).toBe(true);
  });

  test("rejects duplicate item keys within the same activity", () => {
    const days = cloneDays();

    const activity = days
      .flatMap((day) => day.activities)
      .find((candidate) => candidate.items.length >= 2);

    activity.items[1].itemKey =
      activity.items[0].itemKey;

    const result = validateCefrCurriculum({ days });

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.includes(
          `duplicate itemKey "${activity.items[0].itemKey}"`,
        ),
      ),
    ).toBe(true);
  });

  test("rejects unsupported activity types", () => {
    const days = cloneDays();

    days[0].activities[0].activityType =
      "UNKNOWN_ACTIVITY";

    const result = validateCefrCurriculum({ days });

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.includes(
          'activityType "UNKNOWN_ACTIVITY" is unsupported',
        ),
      ),
    ).toBe(true);
  });

  test("rejects an evaluation mode that conflicts with the activity contract", () => {
    const days = cloneDays();
    const activity = findActivity(days, "MCQ");

    activity.evaluationMode = "SELF_ATTESTED";

    const result = validateCefrCurriculum({ days });

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.includes(
          'MCQ requires evaluationMode "AUTO"',
        ),
      ),
    ).toBe(true);
  });

  test("rejects an MCQ whose correct option does not exist", () => {
    const days = cloneDays();
    const activity = findActivity(days, "MCQ");

    activity.items[0].answerKey.correctOptionId =
      "missing-option";

    const result = validateCefrCurriculum({ days });

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.includes(
          'answerKey.correctOptionId "missing-option" does not exist in payload.options',
        ),
      ),
    ).toBe(true);
  });

  test("rejects REORDER payload and answer tokens that do not match", () => {
    const days = cloneDays();
    const activity = findActivity(days, "REORDER");

    activity.items[0].answerKey.tokens[0] =
      "__BROKEN_TOKEN__";

    const result = validateCefrCurriculum({ days });

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.includes(
          "payload.tokens and answerKey.tokens must contain the same tokens",
        ),
      ),
    ).toBe(true);
  });

  test("rejects TYPING without accepted answers", () => {
    const days = cloneDays();
    const activity = findActivity(days, "TYPING");

    activity.items[0].answerKey.acceptedAnswers = [];

    const result = validateCefrCurriculum({ days });

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.includes(
          "TEXT requires at least one non-empty accepted answer",
        ),
      ),
    ).toBe(true);
  });

  test("rejects AUDIO_REPEAT without an audio asset", () => {
    const days = cloneDays();
    const activity = findActivity(
      days,
      "AUDIO_REPEAT",
    );

    delete activity.items[0].payload.audioAssetKey;

    const result = validateCefrCurriculum({ days });

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.includes(
          "AUDIO_REPEAT requires payload.audioAssetKey",
        ),
      ),
    ).toBe(true);
  });

  test("rejects LISTENING_MCQ without an audio asset", () => {
    const days = cloneDays();
    const activity = findActivity(
      days,
      "LISTENING_MCQ",
    );

    delete activity.items[0].payload.audioAssetKey;

    const result = validateCefrCurriculum({ days });

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.includes(
          "LISTENING_MCQ requires payload.audioAssetKey",
        ),
      ),
    ).toBe(true);
  });
});
