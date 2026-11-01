const ALLOWED_TRACKS = new Set([
  "school_foundation",
  "school_advanced",
  "advanced",
]);

function validScore(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

/*
 * One authoritative frontend response shape for:
 *
 * 1. Before/After results
 * 2. Form B-only results with an explicit null baseline
 *
 * Do not convert a missing baseline to zero.
 */
export function isValidMemoryRetestResult(payload) {
  if (
    payload?.ok !== true ||
    !ALLOWED_TRACKS.has(payload.trackId) ||
    !validScore(payload.formBScore) ||
    typeof payload.formBCompletedAt !== "string" ||
    !Number.isFinite(
      Date.parse(payload.formBCompletedAt)
    )
  ) {
    return false;
  }

  const formBOnly =
    payload.formAScore === null &&
    payload.improvementPoints === null;

  const withBaseline =
    validScore(payload.formAScore) &&
    typeof payload.improvementPoints === "number" &&
    Number.isFinite(payload.improvementPoints) &&
    payload.improvementPoints >= -100 &&
    payload.improvementPoints <= 100;

  return formBOnly || withBaseline;
}
