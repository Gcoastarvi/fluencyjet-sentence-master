import { api } from "@/api/apiClient";

function encodeSegment(value) {
  return encodeURIComponent(String(value ?? "").trim());
}

function programBase(programSlug) {
  return `/cefr/programs/${encodeSegment(programSlug)}`;
}

export function getCefrProgram(programSlug) {
  return api.get(programBase(programSlug));
}

export function getCefrProgress(programSlug) {
  return api.get(`${programBase(programSlug)}/progress`);
}

export function getCefrDay(programSlug, dayNumber) {
  return api.get(
    `${programBase(programSlug)}/days/${encodeSegment(dayNumber)}`,
  );
}

export function startCefrActivityAttempt({
  programSlug,
  dayNumber,
  activityId,
}) {
  return api.post(
    `${programBase(programSlug)}/days/${encodeSegment(
      dayNumber,
    )}/activities/${encodeSegment(activityId)}/attempts`,
    {},
  );
}

export function submitCefrActivityResponse({
  programSlug,
  dayNumber,
  activityId,
  attemptId,
  activityItemId,
  submittedAnswer,
  hintUsed = false,
  answerRevealed = false,
  responseTimeMs = null,
  idempotencyKey,
}) {
  return api.post(
    `${programBase(programSlug)}/days/${encodeSegment(
      dayNumber,
    )}/activities/${encodeSegment(
      activityId,
    )}/attempts/${encodeSegment(
      attemptId,
    )}/items/${encodeSegment(activityItemId)}/responses`,
    {
      submittedAnswer,
      hintUsed,
      answerRevealed,
      responseTimeMs,
    },
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function completeCefrActivityAttempt({
  programSlug,
  dayNumber,
  activityId,
  attemptId,
}) {
  return api.post(
    `${programBase(programSlug)}/days/${encodeSegment(
      dayNumber,
    )}/activities/${encodeSegment(
      activityId,
    )}/attempts/${encodeSegment(attemptId)}/complete`,
    {},
  );
}
