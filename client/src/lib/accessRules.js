export function freeAllowsLesson(lessonId) {
  const n = Number(lessonId);
  return Number.isFinite(n) && n >= 1 && n <= 3;
}
