export function normalizeTrack(trackOrDifficulty) {
  const v = String(trackOrDifficulty || "").toLowerCase();

  if (v === "beginner" || v === "basic" || v === "b") return "beginner";
  if (v === "intermediate" || v === "i") return "intermediate";

  return "beginner";
}

export function difficultyForTrack(trackOrDifficulty) {
  const track = normalizeTrack(trackOrDifficulty);
  return track === "intermediate" ? "intermediate" : "beginner";
}

export function lessonsPathForTrack(trackOrDifficulty) {
  const track = normalizeTrack(trackOrDifficulty);
  return track === "intermediate" ? "/i/lessons" : "/b/lessons";
}

export function lessonPathForTrack(trackOrDifficulty, lessonId = 1) {
  const track = normalizeTrack(trackOrDifficulty);
  const difficulty = difficultyForTrack(track);

  return track === "intermediate"
    ? `/i/lesson/${lessonId}?difficulty=${difficulty}`
    : `/b/lesson/${lessonId}?difficulty=${difficulty}`;
}
