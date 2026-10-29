// Application analytics only. Meta's browser policy withholds assessment events.
// The saved-session key is used locally for deduplication and is never emitted.
const sent = new WeakMap();
export function reportSavedMemoryCompletion({ savedSessionKey, track, form }, emit, w = window) {
  if (typeof savedSessionKey !== "string" || !savedSessionKey) return false;
  if (!sent.has(w)) sent.set(w, new Set());
  const keys = sent.get(w), key = `memory_completion_sent:${savedSessionKey}`;
  if (keys.has(key)) return false;
  try { if (w.sessionStorage.getItem(key)) return false; } catch {}
  emit("memory_test_completed", { funnel: "amaze_memory", track, form });
  keys.add(key);
  try { w.sessionStorage.setItem(key, "1"); } catch {}
  return true;
}
