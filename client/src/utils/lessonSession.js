// client/src/utils/lessonSession.js

const KEY = "fj:lastLessonSession";

export function getLastSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);

    // minimal validation
    if (!s || typeof s !== "object") return null;
    if (!s.lessonId || !s.mode) return null;

    return s;
  } catch {
    return null;
  }
}

export function setLastSession({ lessonId, mode, questionIndex }) {
  try {
    const payload = {
      lessonId,
      mode,
      questionIndex: Number.isFinite(questionIndex) ? questionIndex : 0,
      timestamp: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function clearLastSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function getLastSessionForLesson(lessonId) {
  const s = getLastSession();
  if (!s) return null;
  return String(s.lessonId) === String(lessonId) ? s : null;
}
