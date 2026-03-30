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
  if (userId === null || userId === undefined) return null;
  const s = String(userId).trim();
  return s || null;
}

export function normalizeMode(mode) {
  const safeMode = String(mode || "")
    .trim()
    .toLowerCase();
  return safeMode || null;
}

export function progressKey(userId, lessonId, mode) {
  const uid = normalizeUserId(userId);
  const lid = normalizeLessonId(lessonId);
  const safeMode = normalizeMode(mode);

  if (!uid || !lid || !safeMode) return null;

  return `fj_progress:${uid}:${lid}:${safeMode}`;
}

export function readProgress(userId, lessonId, mode) {
  const key = progressKey(userId, lessonId, mode);
  if (!key) return null;

  const parsed = safeJsonParse(localStorage.getItem(key) || "null");
  if (!parsed || typeof parsed !== "object") return null;

  const completed = Number(parsed.completed || 0);
  const total = Number(parsed.total || 0);

  return {
    userId: normalizeUserId(parsed.userId || userId),
    lessonId: normalizeLessonId(parsed.lessonId || lessonId),
    mode: normalizeMode(parsed.mode || mode),
    completed: Number.isFinite(completed) && completed > 0 ? completed : 0,
    total: Number.isFinite(total) && total > 0 ? total : 0,
    updatedAt: Number(parsed.updatedAt || 0) || 0,
  };
}

if (!uid || !lid || !safeMode) {
  console.warn("[progressStore] writeProgress skipped", {
    userId,
    lessonId,
    mode,
    patch,
  });
  return;
}

export function writeProgress(userId, lessonId, mode, patch = {}) {
  const uid = normalizeUserId(userId);
  const lid = normalizeLessonId(lessonId);
  const safeMode = normalizeMode(mode);

  if (!uid || !lid || !safeMode) return;

  const prev = readProgress(uid, lid, safeMode) || {};

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
    userId: uid,
    lessonId: lid,
    mode: safeMode,
    completed: nextCompleted,
    total: nextTotal,
    updatedAt: Date.now(),
  };

  localStorage.setItem(progressKey(uid, lid, safeMode), JSON.stringify(next));
}

export function clearProgress(userId, lessonId, mode) {
  const key = progressKey(userId, lessonId, mode);
  if (!key) return;
  localStorage.removeItem(key);
}

export function pct(progress) {
  const total = Number(progress?.total || 0);
  const done = Number(progress?.completed || 0);
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

export function overallLessonPct(userId, lessonId) {
  const uid = normalizeUserId(userId);
  const lid = normalizeLessonId(lessonId);
  if (!uid || !lid) return 0;

  const typingPct = pct(readProgress(uid, lid, "typing"));
  const reorderPct = pct(readProgress(uid, lid, "reorder"));
  const audioPct = pct(readProgress(uid, lid, "audio"));

  return Math.round((typingPct + reorderPct + audioPct) / 3);
}

export function hydrateProgressSummary(userId, items = []) {
  const uid = normalizeUserId(userId);
  if (!uid || !Array.isArray(items)) return;

  for (const item of items) {
    if (!item) continue;

    const lid = normalizeLessonId(item.lessonId);
    const safeMode = normalizeMode(item.mode);
    const completed = Number(item.completed || 0);
    const total = Number(item.total || 0);

    if (!lid || !safeMode || !total || total <= 0) continue;

    writeProgress(uid, lid, safeMode, {
      completed: Number.isFinite(completed) ? completed : 0,
      total,
      updatedAt: Date.now(),
    });
  }
}
