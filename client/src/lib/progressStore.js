// client/src/lib/progressStore.js

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw || "null");
  } catch {
    return null;
  }
}

export function normalizeLessonId(lessonId) {
  const n = Number(lessonId) || 0;
  return n > 0 ? n : 0;
}

export function normalizeUserId(userId) {
  if (userId === null || userId === undefined) return "anon";
  const s = String(userId).trim();
  return s || "anon";
}

export function progressKey(userId, lessonId, mode) {
  const uid = normalizeUserId(userId);
  const lid = normalizeLessonId(lessonId);
  const safeMode = String(mode || "")
    .trim()
    .toLowerCase();
  return `fj_progress:${uid}:${lid}:${safeMode}`;
}

export function readProgress(userId, lessonId, mode) {
  const lid = normalizeLessonId(lessonId);
  if (!lid) return null;

  return safeJsonParse(
    localStorage.getItem(progressKey(userId, lid, mode)) || "null",
  );
}

export function writeProgress(userId, lessonId, mode, patch = {}) {
  const lid = normalizeLessonId(lessonId);
  if (!lid) return;

  const safeMode = String(mode || "")
    .trim()
    .toLowerCase();
  const prev = readProgress(userId, lid, safeMode) || {};

  const prevCompleted = Number(prev.completed || 0);
  const prevTotal = Number(prev.total || 0);

  const patchCompletedRaw = Number(patch?.completed);
  const patchTotalRaw = Number(patch?.total);

  const nextCompleted = Number.isFinite(patchCompletedRaw)
    ? Math.max(prevCompleted, patchCompletedRaw)
    : prevCompleted;

  const nextTotal =
    Number.isFinite(patchTotalRaw) && patchTotalRaw > 0
      ? Math.max(prevTotal, patchTotalRaw)
      : prevTotal;

  const next = {
    userId: normalizeUserId(userId),
    lessonId: lid,
    mode: safeMode,
    completed: nextCompleted,
    total: nextTotal,
    updatedAt: Date.now(),
    ...patch,
  };

  next.completed = nextCompleted;
  next.total = nextTotal;
  next.updatedAt = Date.now();

  localStorage.setItem(
    progressKey(userId, lid, safeMode),
    JSON.stringify(next),
  );
}

export function pct(progress) {
  const total = Number(progress?.total || 0);
  const done = Number(progress?.completed || 0);
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

export function overallLessonPct(userId, lessonId) {
  const typingPct = pct(readProgress(userId, lessonId, "typing"));
  const reorderPct = pct(readProgress(userId, lessonId, "reorder"));
  const audioPct = pct(readProgress(userId, lessonId, "audio"));
  return Math.round((typingPct + reorderPct + audioPct) / 3);
}

export function hydrateProgressSummary(userId, items = []) {
  for (const item of items) {
    if (!item) continue;
    writeProgress(userId, item.lessonId, item.mode, {
      completed: Number(item.completed || 0),
      total: Number(item.total || 0),
      updatedAt: Date.now(),
    });
  }
}
