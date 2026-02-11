import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/api/apiClient";
import { useLocation, useNavigate } from "react-router-dom";

// ===== helpers (reorder/typing normalization) =====
const norm = (v) =>
  String(v ?? "")
    .trim()
    .replace(/\s+/g, " ");

const toTextArray = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .map((x) =>
      typeof x === "string"
        ? x
        : (x?.text ?? x?.word ?? x?.label ?? x?.value ?? ""),
    )
    .map(norm)
    .filter(Boolean);

const arraysEqualStrict = (a, b) => {
  const aa = toTextArray(a);
  const bb = toTextArray(b);
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  return true;
};

// Create stable tokens so duplicates are safe (e.g., "to", "to")
const makeTokens = (words, qid = "q") =>
  toTextArray(words).map((text, idx) => ({ id: `${qid}-${idx}`, text }));

function asArr(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const t = value.trim();
    return t ? t.split(/\s+/) : [];
  }
  return [];
}

function normalizeText(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const DEFAULT_PRACTICE_MODE = "reorder";
const SUPPORTED_PRACTICE_MODES = new Set([
  "reorder",
  "typing",
  "cloze",
  "audio",
]);
const MAX_ATTEMPTS = 3;

export default function SentencePractice() {
  const { mode: urlMode } = useParams();

  // robust fallback: extract mode from URL path if useParams fails
  const segments = window.location.pathname.split("/").filter(Boolean);
  const practiceIdx = segments.indexOf("practice");
  const pathMode = practiceIdx >= 0 ? segments[practiceIdx + 1] : null;

  const rawMode = String(
    urlMode || pathMode || DEFAULT_PRACTICE_MODE,
  ).toLowerCase();

  const activeMode = SUPPORTED_PRACTICE_MODES.has(rawMode)
    ? rawMode
    : DEFAULT_PRACTICE_MODE;

  // UI mode (what the user sees)
  const safeMode = SUPPORTED_PRACTICE_MODES.has(activeMode)
    ? activeMode
    : DEFAULT_PRACTICE_MODE;

  // Fetch mode (what we load from DB)
  // Cloze + Audio reuse Typing exercises for MVP
  const fetchMode = safeMode === "reorder" ? "reorder" : "typing";

  // XP mode (what we send to backend XP pipeline)
  // Backend currently supports only typing/reorder
  const xpMode = safeMode === "reorder" ? "reorder" : "typing";

  const search = new URLSearchParams(window.location.search);
  const lessonId = Number(search.get("lessonId") || 1);

  const navigate = useNavigate();

  const lessonIdNumSafe = lessonId || 1;
  const nextLessonId = lessonIdNumSafe + 1;

  function goLessons() {
    navigate("/lessons", { replace: true });
  }

  function goNextLesson() {
    if (!nextLessonId) return goLessons();
    navigate(`/lesson/${nextLessonId}?autostart=1`, { replace: true });
  }

  const asArr = (v) => (Array.isArray(v) ? v : []);
  const norm = (s) =>
    String(s || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  function goAudio(variant) {
    const lid = Number(new URLSearchParams(location.search).get("lessonId"));
    if (!lid) return;
    navigate(
      `/practice/audio?lessonId=${lid}&variant=${encodeURIComponent(variant)}`,
    );
  }

  // -------------------
  // Local progress store (LessonDetail summary)
  // -------------------
  const progressKey = (lid, mode) => `fj_progress:${lid}:${mode}`;

  function readProgress(lid, mode) {
    try {
      return JSON.parse(localStorage.getItem(progressKey(lid, mode)) || "null");
    } catch {
      return null;
    }
  }

  function writeProgress(lid, mode, patch) {
    try {
      const prev = readProgress(lid, mode) || {};
      const next = {
        lessonId: lid,
        mode,
        completed: Number(prev.completed || 0),
        total: Number(prev.total || 0),
        updatedAt: prev.updatedAt || Date.now(),
        ...patch,
      };
      localStorage.setItem(progressKey(lid, mode), JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function stopTTS() {
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch {}
    setIsSpeaking(false);
  }

  function speakTTS(text) {
    try {
      if (!("speechSynthesis" in window)) return;
      if (!text) return;

      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(String(text));

      // ✅ always latest values (no stale closure)
      u.rate = Number(ttsRateRef.current || 1.0);
      u.lang = String(ttsLangRef.current || "en-IN");

      setIsSpeaking(true);
      u.onend = () => setIsSpeaking(false);
      u.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(u);
      console.log("[TTS] rate/lang", u.rate, u.lang);
    } catch {
      setIsSpeaking(false);
    }
  }

  // -------------------
  // refs
  // -------------------
  const correctSoundRef = useRef(null);
  const wrongSoundRef = useRef(null);

  const xpInFlightKeysRef = useRef(new Set());

  const [ttsLang, setTtsLang] = useState("en-IN"); // default accent

  // -------------------
  // state
  // -------------------
  const [currentIndex, setCurrentIndex] = useState(0);

  const [tiles, setTiles] = useState([]);
  const [answer, setAnswer] = useState([]);

  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | wrong | correct | reveal
  const [showHint, setShowHint] = useState(false);
  const [wrongIndexes, setWrongIndexes] = useState([]);

  const [lessonExercises, setLessonExercises] = useState([]);
  const [loading, setLoading] = useState(false);

  const [isComplete, setIsComplete] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [sessionTarget] = useState(10); // MVP: 10 questions per session

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionXp, setCompletionXp] = useState(0);
  const [completionMode, setCompletionMode] = useState("typing");

  // typing/cloze shared input state
  const [selectedOption, setSelectedOption] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState("");

  // server-driven UI
  const [earnedXP, setEarnedXP] = useState(0);
  const [showXPToast, setShowXPToast] = useState(false);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState("");

  const totalQuestions = Math.min(lessonExercises.length || 0, sessionTarget);

  // 🔊 Audio (TTS)
  const [revealEnglish, setRevealEnglish] = useState(false);
  const [ttsRate, setTtsRate] = useState(1.0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const ttsRateRef = useRef(ttsRate);
  const ttsLangRef = useRef(ttsLang);

  const [audioVariant, setAudioVariant] = useState("repeat"); // "repeat" | "dictation"

  const [audioGateOpen, setAudioGateOpen] = useState(false);
  const audioGateTimerRef = useRef(null);

  const [completeModeAvail, setCompleteModeAvail] = useState({
    reorder: undefined,
    audio: undefined,
  });

  const location = useLocation();
  const lessonIdFromQuery = Number(
    new URLSearchParams(location.search).get("lessonId"),
  );

  const xpInFlightRef = useRef(false);

  const audioSubmitRef = useRef(new Set()); // per-question "already submitted"
  const [audioSubmitting, setAudioSubmitting] = useState(false); // UX: disable button while saving

  const nextIndex = currentIndex + 1;

  // ✅ Derived (must be AFTER useState declarations)
  const current =
    Array.isArray(lessonExercises) && typeof currentIndex === "number"
      ? (lessonExercises[currentIndex] ?? null)
      : null;

  // ✅ Derived data (single source of truth)
  const expected = current?.expected ?? {};

  const expectedWords = asArr(expected.words ?? expected.tokens);

  const expectedAnswer = String(
    expected.answer ?? expected.correct ?? expected.expected ?? "",
  ).trim();

  // ✅ NOW it's safe (expectedAnswer + current exist)
  const englishFull = String(expectedAnswer || current?.expected || "").trim();

  // For reorder: correctOrder (array) OR fallback to words OR split expectedAnswer
  const correctOrderArr =
    Array.isArray(expected.correctOrder) && expected.correctOrder.length
      ? expected.correctOrder
      : expectedWords.length
        ? expectedWords
        : expectedAnswer
          ? expectedAnswer.split(/\s+/)
          : [];

  // Typing hint-only word bank (from backend)
  const typingWordBank =
    Array.isArray(expectedWords) && expectedWords.length
      ? expectedWords
      : Array.isArray(correctOrderArr) && correctOrderArr.length
        ? correctOrderArr
        : expectedAnswer
          ? expectedAnswer.split(/\s+/)
          : [];

  console.log(
    "[DBG] currentIndex =",
    currentIndex,
    "| lessonExercises len =",
    lessonExercises?.length,
  );

  console.log("[DBG] current", current);
  console.log("[DBG] expectedWords", expectedWords);
  console.log("[DBG] expectedAnswer", expectedAnswer);
  console.log("[DBG] correctOrderArr", correctOrderArr);

  // ✅ Auto-hide XP toast + reset earnedXP
  useEffect(() => {
    if (!showXPToast) return;

    const t = setTimeout(() => {
      setShowXPToast(false);
    }, 1400);

    return () => clearTimeout(t);
  }, [showXPToast]);

  function openAudioGateAfter(ms = 1800) {
    setAudioGateOpen(false);
    if (audioGateTimerRef.current) clearTimeout(audioGateTimerRef.current);
    audioGateTimerRef.current = setTimeout(() => {
      setAudioGateOpen(true);
    }, ms);
  }

  function resetAudioGate() {
    setAudioGateOpen(false);
    if (audioGateTimerRef.current) clearTimeout(audioGateTimerRef.current);
    audioGateTimerRef.current = null;
  }

  useEffect(() => {
    audioSubmitRef.current = new Set();
  }, [lessonIdFromQuery, lessonId, audioVariant, safeMode]);

  useEffect(() => {
    ttsRateRef.current = ttsRate;
  }, [ttsRate]);
  useEffect(() => {
    ttsLangRef.current = ttsLang;
  }, [ttsLang]);

  useEffect(() => {
    if (safeMode !== "audio") return;
    const v = new URLSearchParams(location.search).get("variant");
    if (v === "repeat" || v === "dictation") setAudioVariant(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeMode, location.search]);

  useEffect(() => {
    console.log("[UI] status/earnedXP/toast", {
      safeMode,
      status,
      earnedXP,
      showXPToast,
    });
  }, [safeMode, status, earnedXP, showXPToast]);

  useEffect(() => {
    if (safeMode !== "audio") return;
    stopTTS();
    setRevealEnglish(false);
  }, [currentIndex, safeMode]);

  useEffect(() => {
    if (!showXPToast) return;

    const t = setTimeout(() => {
      setShowXPToast(false);
    }, 1500);

    return () => clearTimeout(t);
  }, [showXPToast]);

  // -------------------
  // effects
  // -------------------

  // 🔁 Smart Resume (auto, exact lesson + mode)
  useEffect(() => {
    try {
      const last = JSON.parse(
        localStorage.getItem("fj_last_session") || "null",
      );
      if (!last) return;

      // Must match current lesson + mode
      const sameLesson = String(last.lessonId) === String(lessonId);
      const sameMode = String(last.mode) === String(safeMode);

      let sameVariant = true;
      if (String(safeMode) === "audio") {
        const v = String(audioVariant || "");
        const lastV = String(last?.variant || "");
        // If last session had no variant, we allow resume (backward compatible)
        // If it has a variant, it must match.
        sameVariant = !lastV || lastV === v;
      }

      if (!sameLesson || !sameMode || !sameVariant) return;

      if (last?.questionIndex != null) {
        setCurrentIndex(Number(last.questionIndex) || 0);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, safeMode]);

  useEffect(() => {
    // ✅ do not overwrite "done"
    if (isComplete) return;
    if (totalQuestions > 0 && currentIndex >= totalQuestions) return;

    try {
      const session = {
        lessonId: Number(lessonId),
        mode: String(fetchMode || safeMode || ""),
        questionIndex: Number(currentIndex) || 0,
        updatedAt: Date.now(),
        ...(String(fetchMode || safeMode) === "audio"
          ? { variant: audioVariant }
          : {}),
      };
    } catch {
      // ignore
    }
  }, [
    lessonId,
    fetchMode,
    safeMode,
    currentIndex,
    audioVariant,
    isComplete,
    totalQuestions,
  ]);

  useEffect(() => {
    const done =
      isComplete || (totalQuestions > 0 && currentIndex >= totalQuestions);
    if (!done) return;

    try {
      const total = totalQuestions || lessonExercises?.length || 0;

      const session = {
        lessonId: Number(lessonId),
        mode: String(fetchMode || safeMode || ""),
        index: "done",
        questionIndex: total, // helps UI show Q# correctly if needed
        total,
        updatedAt: Date.now(),
        ...(String(fetchMode || safeMode) === "audio"
          ? { variant: audioVariant }
          : {}),
      };

      localStorage.setItem("fj_last_session", JSON.stringify(session));
    } catch {
      // ignore
    }
  }, [
    lessonId,
    fetchMode,
    safeMode,
    audioVariant,
    isComplete,
    totalQuestions,
    currentIndex,
    lessonExercises?.length,
  ]);

  useEffect(() => {
    setCurrentIndex(0);
    setLessonExercises([]);
    loadLessonBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchMode, lessonId]);

  // Keep total question count stored for LessonDetail progress summary
  useEffect(() => {
    if (!lessonId) return;
    if (!lessonExercises || lessonExercises.length === 0) return;

    // store total for both supported modes (typing/reorder)
    writeProgress(lessonId, safeMode, {
      total: lessonExercises.length,
      updatedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, safeMode, lessonExercises?.length]);

  useEffect(() => {
    initQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, safeMode, lessonExercises]);

  // 🔊 Initialize sounds once
  useEffect(() => {
    correctSoundRef.current = new Audio("/sounds/correct.mp3");
    wrongSoundRef.current = new Audio("/sounds/wrong.mp3");
  }, []);

  const playCorrect = async () => {
    try {
      const a = correctSoundRef.current;
      if (!a) return;
      a.currentTime = 0;
      await a.play();
    } catch (e) {
      console.log("[SFX] correct blocked/failed", e);
    }
  };

  const playWrong = async () => {
    try {
      const a = wrongSoundRef.current;
      if (!a) return;
      a.currentTime = 0;
      await a.play();
    } catch (e) {
      console.log("[SFX] wrong blocked/failed", e);
    }
  };

  const onPickToken = (token) => {
    setReorderPicked((prev) => [...prev, token]);
    setReorderBank((prev) => prev.filter((x) => x.id !== token.id));
  };

  const onUnpickToken = (token) => {
    setReorderBank((prev) => [...prev, token]);
    setReorderPicked((prev) => prev.filter((x) => x.id !== token.id));
  };

  // AUTO NEXT after correct/reveal
  useEffect(() => {
    if (isComplete) return;

    if (status === "correct" || status === "reveal") {
      const timer = setTimeout(() => {
        loadNextQuestion();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, isComplete]); // (loadNextQuestion is stable enough here)

  useEffect(() => {
    xpInFlightRef.current = false;
  }, [safeMode, currentIndex]);

  // ===== Universal XP event commit (inside component) =====
  async function awardXPEvent({
    questionId,
    xp,
    event,
    mode,
    lessonId: lid,
    exerciseId = null,
    meta = {},
    completedQuiz = false,
    attemptId,
    attemptNo,
    isCorrect,
    practiceType,
  }) {
    // 🔒 Prevent duplicate *same attempt* calls (but allow other XP events to run)
    const dedupeKey = String(
      attemptId ??
        `${mode}:${questionId ?? exerciseId ?? "na"}:${event}:${Number(attemptNo ?? 1) || 1}`,
    );

    if (xpInFlightKeysRef.current.has(dedupeKey)) {
      console.warn("[XP] skipped duplicate awardXPEvent (same key)", {
        dedupeKey,
        mode,
        event,
        questionId,
        exerciseId,
        attemptId,
        attemptNo,
      });
      return { ok: false, awarded: 0, skipped: true };
    }

    xpInFlightKeysRef.current.add(dedupeKey);

    try {
      const payload = {
        attemptId,
        attemptNo: Number(attemptNo ?? 1) || 1,

        // ✅ IMPORTANT: make questionId real, not undefined noise
        ...(questionId ? { questionId: String(questionId) } : {}),

        // xp: if you already compute xp elsewhere, keep it; else:
        xp: Number(xp) || 0,
        event,

        // keep your existing fields
        lessonId: Number(lid) || 0,
        practiceType: practiceType || mode,
        mode,
        exerciseId,

        meta: { lessonId: Number(lid) || 0, mode, exerciseId, ...meta },

        completedQuiz: !!completedQuiz,
        isCorrect:
          isCorrect === undefined ? event === "exercise_correct" : !!isCorrect,
      };

      const res = await api.post("/progress/update", payload);
      const data = res?.data ?? res;

      if (!data || data.ok !== true) {
        console.error("[XP] /progress/update not ok", {
          payload,
          response: data,
        });
        return { ok: false, awarded: 0, data };
      }

      const serverAwarded =
        Number(
          data?.xpAwarded ??
            data?.awarded ??
            data?.xpDelta ??
            data?.xp_delta ??
            0,
        ) || 0;

      return { ok: true, awarded: serverAwarded, data };
    } catch (err) {
      console.error("[XP] /progress/update failed", err);
      return { ok: false, awarded: 0, error: String(err?.message || err) };
    } finally {
      // 🔓 ALWAYS release this specific attempt lock
      xpInFlightKeysRef.current.delete(dedupeKey);
      console.log("[XP] awardXPEvent RELEASE", {
        dedupeKey,
        mode,
        event,
        questionId,
      });
    }
  }

  async function awardCompletionBonus(mode) {
    return awardXPEvent({
      xp: 300,
      event: "lesson_completed",
      mode,
      lessonId: Number(lessonId),
      completedQuiz: true,
    });
  }

  // -------------------
  // helpers
  // -------------------
  function normalizeExercise(raw) {
    if (!raw) return null;

    // expected may be object or JSON string
    let expected = raw.expected;
    if (typeof expected === "string") {
      try {
        expected = JSON.parse(expected);
      } catch {
        expected = {};
      }
    }
    expected = expected || {};

    const id = raw.id;
    const promptTa = raw.promptTa || raw.prompt || raw.questionTa || "";
    const xp = Number(raw.xp || expected.xp || 0) || 0;

    const mode = String(
      expected.mode || expected.practiceType || raw.mode || "",
    )
      .toLowerCase()
      .trim();

    const words = Array.isArray(expected.words)
      ? expected.words
      : Array.isArray(expected.tokens)
        ? expected.tokens
        : Array.isArray(raw.words)
          ? raw.words
          : [];

    const answer =
      expected.answer ||
      expected.correct ||
      expected.expected ||
      expected.expectedAnswer ||
      raw.answer ||
      raw.expectedAnswer ||
      raw.expected_answer ||
      "";

    return {
      id,
      promptTa,
      xp,
      orderIndex: raw.orderIndex ?? 0,

      // ✅ top-level fields for older UI code
      mode,
      words,
      answer,

      // ✅ keep expected too
      expected: { ...expected, mode, words, answer },
    };
  }

  async function loadLessonBatch() {
    setLoading(true);
    setLoadError("");

    const lessonIdNum = Number(lessonIdFromQuery);

    try {
      const res = await api.get(
        `/quizzes/by-lesson/${lessonIdNum}?mode=${encodeURIComponent(fetchMode)}&difficulty=beginner`,
      );

      const data = res?.data ?? res;

      // ✅ PAYWALL redirect (fast path, no error flash)
      const isLocked =
        data?.ok === false &&
        (data?.code === "PAYWALL" ||
          String(data?.message || data?.error || "")
            .toLowerCase()
            .includes("locked"));

      if (isLocked) {
        const action = data?.nextAction;
        const from = action?.from || `lesson_${lessonIdNum}`;

        // If backend provided a redirect target, follow it
        if (action?.url) {
          const sep = String(action.url).includes("?") ? "&" : "?";
          const target = `${action.url}${sep}from=${encodeURIComponent(from)}`;

          // support external links too
          if (/^https?:\/\//i.test(target)) {
            window.location.href = target;
          } else {
            navigate(target, { replace: true });
          }
          return;
        }

        // fallback: go to practice hub (LessonDetail)
        navigate(`/lesson/${lessonIdNum}`, { replace: true });
        return;
      }

      // ✅ Backend shape: { ok:true, exercises:[...] }
      const exercises = Array.isArray(data?.exercises) ? data.exercises : [];

      const normalized = exercises.map(normalizeExercise).filter(Boolean);

      console.log("[Practice] data:", data);
      console.log("[Practice] raw exercises[0]:", exercises?.[0]);
      console.log("[Practice] normalized[0]:", normalized?.[0]);
      console.log("[Practice] normalized length:", normalized.length);

      if (!normalized.length) {
        setLessonExercises([]);
        setLoadError(
          `No exercises found. mode=${fetchMode} lessonId=${lessonIdNum}`,
        );
        return;
      }

      setLessonExercises(normalized);
      setCurrentIndex(0);
    } catch (e) {
      const status = e?.response?.status ?? e?.status ?? null;

      const data = e?.response?.data ?? e?.data ?? null;
      const code = data?.code ?? null;

      const msg = data?.message ?? data?.error ?? e?.message ?? "";

      if (
        status === 403 &&
        (code === "PAYWALL" || String(msg).toLowerCase().includes("locked"))
      ) {
        const action = data?.nextAction || null;
        const from = action?.from || `lesson_${lessonIdNum}`;

        if (action?.url) {
          const sep = String(action.url).includes("?") ? "&" : "?";
          const target = `${action.url}${sep}from=${encodeURIComponent(from)}`;

          if (/^https?:\/\//i.test(target)) {
            window.location.href = target;
          } else {
            navigate(target, { replace: true });
          }
          return;
        }

        navigate(`/lesson/${lessonIdNum}`, { replace: true });
        return;
      }

      console.error("[Practice] loadLessonBatch failed", e);
      setLoadError(
        status === 500 ? "Server error" : "Failed to load lesson exercises.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadRandomOne() {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get("/quizzes/random", {
        params: { mode: fetchMode, lessonId },
      });
      const data = res?.data ?? res;
      const ex = normalizeExercise(data);

      if (!ex) {
        setLoadError("No exercise returned.");
        return;
      }

      setLessonExercises([ex]); // single-item “batch”
      setCurrentIndex(0);
    } catch (e) {
      // ✅ 1) Detect PAYWALL and redirect immediately (no UI error flash)
      const status = e?.response?.status ?? e?.status ?? null;
      const code = e?.response?.data?.code ?? e?.data?.code ?? null;
      const msg =
        e?.response?.data?.message ?? e?.data?.message ?? e?.message ?? "";

      if (
        status === 403 &&
        (code === "PAYWALL" || String(msg).toLowerCase().includes("locked"))
      ) {
        // go to lesson detail page
        navigate(`/lesson/${lessonId}`, { replace: true });
        return; // ⛔ stops setLoadError below
      }

      // ✅ 2) Normal error handling
      console.error("[Practice] loadRandomOne failed", e);
      setLoadError("Failed to load a random exercise.");
    }
    setLoading(false);
  }

  function initQuiz() {
    setAttempts(0);
    setStatus("idle");
    setShowHint(false);
    setWrongIndexes([]);
    setTypedAnswer("");

    // initialize by mode
    if (safeMode === "reorder") {
      const shuffled = [...correctOrderArr].sort(() => Math.random() - 0.5);
      setTiles(shuffled);
      setAnswer([]);
    } else {
      setTiles([]);
      setAnswer([]);
    }
  }

  function hardResetAndRestart() {
    setShowCompleteModal(false);
    setIsComplete(false);
    setCompletionXp(0);

    setCurrentIndex(0);
    setStatus("idle");
    setFeedback("");
    setShowHint(false);
    setTypedAnswer("");
    setWrongIndexes([]);
    setRevealEnglish(false);
    setEarnedXP(0);
    setShowXPToast(false);
    setAnswer([]);
    setTiles([]);

    setAudioSubmitting(false);
    audioSubmitRef.current = new Set();
    stopTTS();
    resetAudioGate();

    loadLessonBatch();
  }

  function loadNextQuestion() {
    // reset transient UI for next question
    setEarnedXP(0);
    setShowXPToast(false);
    setStatus("idle");
    setFeedback("");
    setShowHint(false);
    setTypedAnswer("");
    setWrongIndexes([]);
    setRevealEnglish(false);

    setAnswer([]);
    setTiles([]);

    setCurrentIndex((prev) => {
      const next = prev + 1;

      const total = Math.min(lessonExercises?.length || 0, sessionTarget);

      if (total > 0 && next >= total) {
        setIsComplete(true);
      }

      return next;
    });
  }

  function addToAnswer(word) {
    if (status === "correct" || status === "reveal") return;
    setAnswer((prev) => [...prev, word]);
    setTiles((prev) => {
      const idx = prev.indexOf(word);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  }

  function playCorrectSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // ignore if blocked
    }
  }

  // ===== REORDER: check correctness =====
  const checkReorderAnswer = async () => {
    if (!current) return;
    if (status === "correct" || status === "reveal") return;

    // answer: your selected words state
    const userArr = toTextArray(answer);
    const correctArr = toTextArray(correctOrderArr);

    const isCorrect = arraysEqualStrict(userArr, correctArr);

    // highlight wrong positions (only when wrong)
    if (!isCorrect) {
      const wrong = [];
      const L = Math.max(userArr.length, correctArr.length);
      for (let i = 0; i < L; i++) {
        if ((userArr[i] ?? "") !== (correctArr[i] ?? "")) wrong.push(i);
      }
      setWrongIndexes(wrong);
    } else {
      setWrongIndexes([]);
    }

    console.log("[DBG] REORDER userArr   =", userArr);
    console.log("[DBG] REORDER correctArr=", correctArr);
    console.log("[DBG] REORDER isCorrect =", isCorrect);

    if (isCorrect) {
      const xp = Number(current?.xp ?? 150) || 150;

      // 1) UI feedback immediately
      playCorrectSound?.();
      setStatus("correct");

      // 2) Commit XP to backend using universal pipeline
      try {
        const result = await awardXPEvent({
          xp,
          event: "exercise_correct",
          mode: "reorder", // ✅ IMPORTANT: literal, avoids TS issues
          lessonId: Number(lessonId),
          exerciseId: current?.id,
        });

        const awarded = Number(result?.awarded ?? 0) || 0;

        if (result?.ok && awarded > 0) {
          setEarnedXP(awarded);
          setShowXPToast(true);
        } else {
          console.error("[XP] reorder: XP not awarded", result);
        }

        // 3) Completion bonus only on last question
        if (currentIndex + 1 >= totalQuestions) {
          try {
            await awardCompletionBonus("reorder");
          } catch (e) {
            console.error("[XP] reorder completion bonus failed", e);
          }
        }
      } catch (e) {
        console.error("[XP] reorder awardXPEvent failed", e);
      }

      // important: stop here; do NOT fall through to wrong
      return;
    }
  };

  // ✅ Typing helper: tap a word chip to append into typedAnswer
  function addToTyped(word) {
    if (status === "correct" || status === "reveal") return;

    setTypedAnswer((prev) => {
      const t = String(prev || "").trimEnd();
      return (t ? t + " " : "") + word + " ";
    });
  }

  function handleTryAgain() {
    setAnswer([]);
    setWrongIndexes([]);
    setStatus("idle");
    setShowHint(false);
    setAttempts(0);

    if (safeMode === "typing") {
      setTypedAnswer("");
      return;
    }

    if (safeMode === "cloze") {
      setTypedAnswer("");
      return;
    }

    if (safeMode === "reorder") {
      const reshuffled = [...correctOrderArr].sort(() => Math.random() - 0.5);
      setTiles(reshuffled);
      setAnswer([]);
    }
  }

  async function handleAudioRepeated() {
    if (!current) return;
    if (status === "correct") return;

    const submitKey = `${audioVariant}:${current.id}`;

    // ✅ prevent double submit on same question
    if (audioSubmitRef.current.has(submitKey)) {
      return;
    }

    // ✅ anti-abuse: must press Play first
    if (!audioGateOpen) {
      setFeedback("▶ Tap Play first, then click “I repeated it ✅”");
      return;
    }

    // ✅ prevent spam clicks while request is running
    if (audioSubmitting) return;

    setAudioSubmitting(true);

    console.log("[AUDIO_REPEAT] clicked", {
      audioGateOpen,
      currentId: current?.id,
      status,
      inFlight: xpInFlightRef.current,
    });

    const attemptNumber = attempts + 1;

    try {
      const result = await awardXPEvent({
        attemptId: `audio-repeat-${current.id}-${attemptNumber}`,
        attemptNo: attemptNumber,
        xp: 150,
        event: "exercise_correct",
        lessonId: Number(lessonIdFromQuery || lessonId) || 0,
        mode: "audio",
        practiceType: "audio",
        exerciseId: current.id,
        questionId: `repeat_${current.id}`, // ✅ stable dedupe key
        meta: { audioVariant: "repeat" },
        completedQuiz: false,
        isCorrect: true,
      });

      const awarded = Number(result?.awarded ?? 0) || 0;

      // ✅ mark submitted once the server responds OK (even if deduped to 0)
      if (result?.ok) {
        audioSubmitRef.current.add(submitKey);
      }

      // ✅ always treat Repeat as success UI (no "wrong")
      setStatus("correct");

      if (result?.ok && awarded > 0) {
        setEarnedXP(awarded);
        setShowXPToast(true);
        playCorrectSound?.();
        setFeedback(`✅ Great! +${awarded} XP`);
      } else if (result?.ok && awarded === 0) {
        // Deduped / already awarded / or server chose 0 — don't punish the user
        setFeedback("✅ Saved!");
      } else {
        // only real failure should block
        console.error("[AUDIO/repeat] awardXPEvent failed", result);
        setStatus("idle");
        setFeedback("⚠️ Couldn’t save. Please try again.");
        return;
      }

      resetAudioGate();

      writeProgress(lessonId, "audio", {
        total: lessonExercises.length,
        completed: Math.min(lessonExercises.length, currentIndex + 1),
        updatedAt: Date.now(),
      });

      setTimeout(() => {
        loadNextQuestion();
        setRevealEnglish(false);
        setShowHint(false);
        setWrongIndexes([]);
        setTypedAnswer("");
        setStatus("idle");
        setFeedback("");
      }, 700);
    } catch (err) {
      console.error("[audio/repeat] award failed", err);
      setStatus("wrong");
      setFeedback("❌ Try again");
    } finally {
      setAudioSubmitting(false);
    }
  }

  async function checkAnswer() {
    if (safeMode === "reorder") {
      return checkReorderAnswer();
    }

    if (!current) return;
    if (status === "correct") return;

    // ⌨️ TYPING validation
    if (
      safeMode === "typing" ||
      (safeMode === "audio" && audioVariant === "dictation")
    ) {
      const normalize = (s) =>
        String(s || "")
          .trim()
          .toLowerCase()
          // ✅ make curly apostrophes equal to normal apostrophe
          .replace(/[’‘‛ʼ]/g, "'")
          // ✅ (optional but safe) normalize curly quotes too
          .replace(/[“”]/g, '"')
          .replace(/\s+/g, " ");

      const target =
        String(expectedAnswer || "").trim() ||
        String((correctOrder || []).join(" ")).trim();

      const user = typedAnswer;

      if (!normalize(user)) {
        setStatus("wrong");
        setShowHint(true);
        return;
      }

      const attemptNumber = attempts + 1;

      const qid =
        safeMode === "audio" && audioVariant === "dictation"
          ? `dict_${current.id}`
          : `typing_${current.id}`;

      if (normalize(user) === normalize(target)) {
        setStatus("correct");
        setWrongIndexes([]);

        const xpDelta = Number(current?.xp ?? 150) || 150;

        const result = await awardXPEvent({
          attemptId: `${qid}-${attemptNumber}`,
          attemptNo: attemptNumber,
          questionId: qid,

          xp: xpDelta,
          event: "exercise_correct",

          mode: safeMode === "audio" ? "audio" : "typing",
          practiceType: safeMode === "audio" ? "audio" : "typing",

          lessonId: Number(lessonId),
          exerciseId: current?.id,
          meta:
            safeMode === "audio" && audioVariant === "dictation"
              ? { audioVariant: "dictation" }
              : {},
          completedQuiz: false,
          isCorrect: true,
        });

        const awarded = Number(result?.awarded ?? 0) || 0;

        if (result?.ok && awarded > 0) {
          setEarnedXP(awarded);
          setShowXPToast(true);
          correctSoundRef.current?.play?.(); // play only after award success
        } else {
          console.error("[XP] typing: XP not awarded", result);
        }

        // Update lesson progress (Typing)
        {
          const prev = readProgress(lessonId, "typing");
          const completedNow = Math.max(
            Number(prev?.completed || 0),
            currentIndex + 1,
          );
          const totalNow = Number(prev?.total || lessonExercises?.length || 0);
          writeProgress(lessonId, "typing", {
            completed: completedNow,
            total: totalNow,
            updatedAt: Date.now(),
          });
        }

        // ✅ Completion bonus (ONLY once, only on last question)
        const isLastQuestion =
          currentIndex >= (lessonExercises?.length || 0) - 1;

        if (isLastQuestion) {
          try {
            const bonus = await awardCompletionBonus(
              safeMode === "audio" && audioVariant === "dictation"
                ? "audio"
                : "typing",
            );

            setCompletionXp(Number(bonus?.awarded ?? 300) || 300);
            setCompletionMode(
              safeMode === "audio" && audioVariant === "dictation"
                ? "audio"
                : "typing",
            );
            // Don't show old modal if session-complete screen is about to show
            const willHitSessionComplete =
              totalQuestions > 0 && currentIndex + 1 >= totalQuestions;

            if (!willHitSessionComplete) {
              setShowCompleteModal(true);
            }
          } catch (err) {
            console.error("[XP] completion bonus failed", err);
          }
        }
        return;
      }

      // wrong typing
      wrongSoundRef.current?.play?.();
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setStatus("wrong");
      setShowHint(true);

      if (nextAttempts >= MAX_ATTEMPTS) {
        setStatus("reveal");
      }
      return;
    }

    // 🧩 CLOZE validationsetEarnedXP
    if (safeMode === "cloze") {
      const normalizeWord = (s) =>
        String(s || "")
          .trim()
          .toLowerCase()
          .replace(/[’‘‛ʼ]/g, "'")
          .replace(/[“”]/g, '"')
          .replace(/\s+/g, " ");

      const expectedMissing = normalizeWord(cloze?.missingWord);
      const got = normalizeWord(typedAnswer);

      if (!got) {
        setStatus("wrong");
        setShowHint(true);
        return;
      }

      // ✅ Accept either the missing word OR the full sentence
      const gotWords = got.split(" ").filter(Boolean);
      const expectedWordOk = expected && got === expected;

      const expectedFull = normalizeWord(String(cloze?.full || ""));
      const expectedFullOk = expectedFull && got === expectedFull;

      // If user typed full sentence with same number of words,
      // validate the blank position word
      const positionalOk =
        Array.isArray(cloze?.words) &&
        typeof cloze?.index === "number" &&
        gotWords.length === cloze.words.length &&
        normalizeWord(gotWords[cloze.index]) === expected;

      const isCorrect =
        expected && (expectedWordOk || expectedFullOk || positionalOk);

      if (isCorrect) {
        const attemptNumber = attempts + 1;

        setStatus("correct");
        setFeedback("✅ Correct!");

        // ✅ SFX
        try {
          playCorrect?.();
        } catch {}

        const xpDelta = Number(current?.xp ?? 80) || 80;

        const result = await awardXPEvent({
          xp: xpDelta,
          event: "exercise_correct",
          mode: xpMode, // keep your mapping if xpMode is "typing"
          lessonId: Number(lessonId),
          exerciseId: current?.id,
        });

        const awarded = Number(result?.awarded ?? 0) || 0;

        if (result?.ok && awarded > 0) {
          setEarnedXP(awarded);
          setShowXPToast(true);
        } else {
          console.error("[XP] cloze: XP not awarded", result);
        }

        // ✅ Update progress (Cloze)
        writeProgress(lessonId, "cloze", {
          total: lessonExercises.length,
          completed: Math.min(lessonExercises.length, currentIndex + 1),
          updatedAt: Date.now(),
        });

        setTimeout(() => {
          loadNextQuestion(); // loadNextQuestion will handle resets
        }, 900);

        return;
      }

      // wrong cloze
      setStatus("wrong");
      setFeedback(`❌ Correct answer: "${cloze?.missingWord || ""}"`);
      setEarnedXP(0);
      try {
        playWrong?.();
      } catch {}
      setShowHint(true);
      return;
    }

    // ✅ REORDER validation
    if (incorrect.length === 0) {
      const attemptNumber = attempts + 1;

      setWrongIndexes([]);
      setStatus("correct");

      try {
        const xpDelta = Number(current?.xp ?? 100) || 100;

        const result = await awardXPEvent({
          attemptId: `reorder_${current?.id}-${attemptNumber}`,
          attemptNo: attemptNumber,
          questionId: `reorder_${current?.id}`,
          xp: xpDelta,
          event: "exercise_correct",
          mode: "reorder",
          practiceType: "reorder",
          lessonId: Number(lessonId),
          exerciseId: current?.id,
          meta: {},
          completedQuiz: false,
          isCorrect: true,
        });

        const awarded = Number(result?.awarded ?? 0) || 0;

        if (result?.ok && awarded > 0) {
          setEarnedXP(awarded);
          setShowXPToast(true);
          playCorrectSound?.();
          setFeedback("✅ Correct!");
        } else {
          console.error("[XP] reorder: XP not awarded", result);
          setFeedback("✅ Correct! (XP not awarded)");
        }

        const isLastQuestion =
          currentIndex >= (lessonExercises?.length || 0) - 1;
        if (isLastQuestion) {
          const bonus = await awardCompletionBonus("reorder");
          setCompletionXp(Number(bonus?.awarded ?? 300) || 300);
          setCompletionMode("reorder");
          // Don't show old modal if session-complete screen is about to show
          const willHitSessionComplete =
            totalQuestions > 0 && currentIndex + 1 >= totalQuestions;

          if (!willHitSessionComplete) {
            setShowCompleteModal(true);
          }
        }
      } catch (err) {
        console.error("[XP] reorder awardXPEvent/completion failed", err);
      }

      // Update lesson progress (Reorder)
      {
        const prev = readProgress(lessonId, "reorder");
        const completedNow = Math.max(
          Number(prev?.completed || 0),
          currentIndex + 1,
        );
        const totalNow = Number(prev?.total || lessonExercises?.length || 0);
        writeProgress(lessonId, "reorder", {
          completed: completedNow,
          total: totalNow,
          updatedAt: Date.now(),
        });
      }
    }

    // WRONG
    wrongSoundRef.current?.play?.();
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setStatus("wrong");
    setShowHint(true);
    setWrongIndexes(incorrect);

    if (nextAttempts >= MAX_ATTEMPTS) {
      setStatus("reveal");
      setEarnedXP(0);
    }
  }

  // -------------------
  // mode guard (MVP)
  // -------------------
  if (
    safeMode !== "reorder" &&
    safeMode !== "typing" &&
    safeMode !== "cloze" &&
    safeMode !== "audio"
  ) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Practice mode: {safeMode}</h1>
        <p className="text-gray-600">
          This mode is coming next. For now, use <b>/practice/reorder</b> or{" "}
          <b>/practice/typing</b>.
        </p>
      </div>
    );
  }

  function safeStopAudioAndUnlock() {
    // Audio safety no-ops if not in audio mode
    try {
      setAudioSubmitting(false);
    } catch {}
    try {
      if (audioSubmitRef?.current) audioSubmitRef.current = new Set();
    } catch {}
    try {
      stopTTS?.();
    } catch {}
    try {
      resetAudioGate?.();
    } catch {}
  }

  function hardResetThenNavigate(nextMode, nextVariant) {
    // Minimal safe resets before leaving completion screen
    try {
      setIsComplete(false);
    } catch {}
    try {
      setShowCompleteModal(false);
    } catch {}
    try {
      setCompletionXp(0);
    } catch {}

    safeStopAudioAndUnlock();

    const sp = new URLSearchParams(location.search);
    const lid = sp.get("lessonId"); // SOURCE OF TRUTH
    if (!lid) return;

    const mode = String(nextMode || "").toLowerCase();
    if (!mode) return;

    if (mode === "audio") {
      const qs = new URLSearchParams();
      qs.set("lessonId", String(lid));
      qs.set("variant", nextVariant || "repeat");
      navigate(`/practice/audio?${qs.toString()}`, { replace: true });
      return;
    }

    navigate(`/practice/${mode}?lessonId=${encodeURIComponent(lid)}`, {
      replace: true,
    });
  }

  const isSessionDone =
    isComplete || (totalQuestions > 0 && currentIndex >= totalQuestions);

  useEffect(() => {
    if (!isSessionDone) return;

    const search = new URLSearchParams(location.search);
    const lid = Number(search.get("lessonId") || 0);
    if (!lid) return;

    let cancelled = false;

    (async () => {
      try {
        const reorderOk = await hasExercises(lid, "reorder");
        const audioOk = await hasExercises(lid, "audio");

        if (cancelled) return;

        setCompleteModeAvail({
          reorder:
            reorderOk === true ||
            reorderOk === "AUTH" ||
            reorderOk === "PAYWALL",
          audio:
            audioOk === true || audioOk === "AUTH" || audioOk === "PAYWALL",
        });
      } catch {
        if (!cancelled) setCompleteModeAvail({ reorder: true, audio: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSessionDone, location.search]);

  // -------------------
  // completion
  // -------------------
  //   � SESSION COMPLETE (10 questions) — engagement loop
  if (isComplete || (totalQuestions > 0 && currentIndex >= totalQuestions)) {
    const search = new URLSearchParams(location.search);
    const lid = Number(search.get("lessonId") || 0);
    const nextLessonId = lid ? lid + 1 : null;

    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-3">🎉 Session Complete!</h1>
        <p className="mb-4 text-gray-700">
          Great job! You finished today’s practice.
        </p>

        <div className="mb-6 text-sm text-gray-600">
          Mode:{" "}
          <span className="font-semibold">
            {String(fetchMode || "").toUpperCase()}
          </span>
        </div>

        <div className="space-y-3">
          {/* Primary CTA: Next Lesson */}
          {nextLessonId ? (
            <button
              className="w-full rounded-2xl bg-black px-6 py-4 text-white font-semibold hover:opacity-90"
              onClick={() =>
                navigate(`/lesson/${nextLessonId}`, { replace: true })
              }
            >
              Continue to Lesson {nextLessonId} →
            </button>
          ) : null}

          {/* Secondary: Practice Again */}
          <button
            className="w-full rounded-2xl bg-purple-600 px-6 py-4 text-white font-semibold hover:opacity-95"
            onClick={() => {
              // reset completion + modal states
              setIsComplete(false);
              setShowCompleteModal(false);
              setCompletionXp(0);

              // reset practice state
              setCurrentIndex(0);
              setStatus("idle");
              setFeedback("");
              setShowHint(false);
              setTypedAnswer("");
              setWrongIndexes([]);
              setRevealEnglish(false);
              setEarnedXP(0);
              setShowXPToast(false);
              setAnswer([]);
              setTiles([]);

              // audio-specific safety
              setAudioSubmitting(false);
              audioSubmitRef.current = new Set(); // ✅ add
              stopTTS(); // ✅ add
              resetAudioGate(); // ✅ call directly (no optional chaining needed)

              // reload
              loadLessonBatch();
            }}
          >
            Practice Again
          </button>

          {/* Tertiary: Back to Lessons */}
          <button
            className="w-full rounded-2xl border bg-white px-6 py-4 font-semibold hover:bg-gray-50"
            onClick={() => navigate("/lessons", { replace: true })}
          >
            Back to Lessons
          </button>
          {/* Try another mode (2 minutes) */}
          {(() => {
            const lidStr = String(lid || "");
            if (!lidStr) return null;

            // only show modes that truly have items (prevents "No quizzes uploaded yet" flash)
            const canShowReorder = completeModeAvail?.reorder !== false; // undefined => show
            const canShowAudio = completeModeAvail?.audio !== false; // undefined => show

            // read progress
            const parse = (raw) => {
              if (!raw) return null;
              try {
                return JSON.parse(raw);
              } catch {
                return null;
              }
            };

            const rp = parse(
              localStorage.getItem(`fj_progress:${lidStr}:reorder`),
            );
            const ap = parse(
              localStorage.getItem(`fj_progress:${lidStr}:audio`),
            );

            const isDone = (p) =>
              Number(p?.total || 0) > 0 &&
              Number(p?.completed || 0) >= Number(p?.total || 0);

            const showReorderBtn =
              canShowReorder &&
              !isDone(rp) &&
              String(safeMode).toLowerCase() !== "reorder";

            const audioEnabled =
              typeof ENABLE_AUDIO === "undefined" ? true : !!ENABLE_AUDIO;
            const showAudioBtns =
              audioEnabled &&
              canShowAudio &&
              !isDone(ap) &&
              String(safeMode).toLowerCase() !== "audio";

            if (!showReorderBtn && !showAudioBtns) return null;

            return (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-left">
                <div className="text-sm font-semibold text-slate-900">
                  Try another mode (2 minutes)
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Different modes train different skills. Pick one more to boost
                  fluency.
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {showReorderBtn ? (
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                      onClick={() => hardResetThenNavigate("reorder")}
                    >
                      Reorder (speed)
                    </button>
                  ) : null}

                  {showAudioBtns ? (
                    <>
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                        onClick={() => hardResetThenNavigate("audio", "repeat")}
                      >
                        Audio Repeat (listening)
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                        onClick={() =>
                          hardResetThenNavigate("audio", "dictation")
                        }
                      >
                        Audio Dictation
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // -------------------
  // empty state (no exercises)
  // -------------------
  if (!loading && (loadError || !(lessonExercises?.length > 0))) {
    const lid = lessonIdFromQuery || lessonId;

    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold">No questions yet</div>

          <div className="mt-1 text-sm text-gray-600">
            {loadError ||
              `No exercises found. mode=${fetchMode} lessonId=${lid}`}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(`/lesson/${lid}`)}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Back to Lesson
            </button>

            <button
              type="button"
              onClick={() => loadLessonBatch()}
              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Retry
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  `/practice/${fetchMode === "reorder" ? "typing" : "reorder"}?lessonId=${encodeURIComponent(
                    lid,
                  )}`,
                  { replace: true },
                )
              }
              className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Try other mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------
  // empty / error / no current (single source of truth)
  // -------------------
  if (loadError) {
    const lid = lessonIdFromQuery || lessonId;
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-red-600">{loadError}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(`/lesson/${lid}`)}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Back to Lesson
            </button>
            <button
              type="button"
              onClick={() => loadLessonBatch()}
              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && !(lessonExercises?.length > 0)) {
    const lid = lessonIdFromQuery || lessonId;
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold">No questions yet</div>
          <div className="mt-1 text-sm text-gray-600">
            This lesson doesn’t have practice items yet.
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(`/lesson/${lid}`)}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Back to Lesson
            </button>
            <button
              type="button"
              onClick={() => loadLessonBatch()}
              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/practice/${fetchMode === "reorder" ? "typing" : "reorder"}?lessonId=${encodeURIComponent(
                    lid,
                  )}`,
                  { replace: true },
                )
              }
              className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Try other mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">No question loaded yet</h1>
        <p className="text-gray-600">Please retry.</p>
        <button
          type="button"
          onClick={() => loadLessonBatch()}
          className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  // -------------------
  // UI
  // -------------------
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-center mb-6">
        Build the sentence
      </h1>

      <div className="text-center text-xs text-slate-400 mb-3">
        urlMode: <b>{String(urlMode)}</b> | activeMode: <b>{activeMode}</b> |
        safeMode: <b>{safeMode}</b> | lessonId: <b>{lessonId}</b>
      </div>

      <div className="text-center text-sm text-gray-500 mb-3">
        Question {currentIndex + 1} / {totalQuestions}
      </div>

      <div className="flex justify-center items-center gap-2 mb-4 text-orange-600 font-semibold">
        🔥 {streak}-day streak
      </div>

      {/* Tamil Prompt */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 text-lg">
        {current?.promptTa}
      </div>

      {/* Hint */}
      {showHint && status !== "correct" && (
        <div className="bg-purple-100 text-purple-800 p-3 rounded mb-4">
          �� Hint: Subject → Verb → Action
        </div>
      )}

      {/* 🧩 CLOZE UI */}
      {safeMode === "cloze" && (
        <div className="bg-white shadow-lg rounded-xl p-5 border border-indigo-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-indigo-700">
              Cloze Practice
            </h2>

            <button
              onClick={() => setTypedAnswer("")}
              className="text-xs px-3 py-1 rounded bg-slate-100 hover:bg-slate-200"
              disabled={status === "correct" || status === "reveal"}
            >
              Clear
            </button>
          </div>

          <div className="text-sm text-gray-600 mb-2">
            Fill the missing word:
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="text-lg font-semibold tracking-wide">
              {cloze?.masked || "____"}
            </div>

            <div className="mt-3">
              <input
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                placeholder="Type ONLY the missing word (or type the full sentence)..."
                className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                disabled={status === "correct" || status === "reveal"}
              />
            </div>

            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={checkAnswer}
                className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                disabled={status === "correct" || status === "reveal" || !cloze}
              >
                Submit
              </button>

              <button
                onClick={() => setStatus("reveal")}
                className="px-4 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600"
                disabled={status === "correct" || status === "reveal"}
              >
                Show Answer
              </button>
            </div>

            {status === "reveal" && (
              <div className="mt-3 text-sm text-gray-700">
                ✅ Answer:{" "}
                <span className="font-semibold">{cloze?.missingWord}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ⌨️ TYPING UI */}
      {(safeMode === "typing" ||
        (safeMode === "audio" && audioVariant === "dictation")) && (
        <div className="bg-white shadow-lg rounded-xl p-5 border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-purple-700">
              {safeMode === "audio" && audioVariant === "dictation"
                ? "Audio Dictation"
                : "Typing Practice"}
            </h2>

            <button
              onClick={() => setTypedAnswer("")}
              className="text-xs px-3 py-1 rounded bg-slate-100 hover:bg-slate-200"
              disabled={status === "correct" || status === "reveal"}
            >
              Clear
            </button>
          </div>

          {/* 🔊 Audio Dictation Controls (only when audio + dictation) */}
          {safeMode === "audio" && audioVariant === "dictation" && (
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => speakTTS(englishFull)}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                disabled={!englishFull}
              >
                {isSpeaking ? "Speaking..." : "▶ Play Audio"}
              </button>

              <button
                type="button"
                onClick={() => stopTTS()}
                className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-sm"
              >
                Stop
              </button>
            </div>
          )}

          {/* Tamil prompt (what they should convert to English) */}
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-3">
            <div className="text-xs font-semibold text-purple-700 mb-1">
              Tamil prompt
            </div>
            <div className="text-sm text-slate-800">{current?.promptTa}</div>
          </div>

          {/* Word Bank (hint only — not clickable) */}
          {(safeMode === "typing" ||
            (safeMode === "audio" && audioVariant === "dictation")) && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-slate-600 mb-2">
                Word Bank (hint only)
              </div>

              <div className="flex flex-wrap gap-2">
                {(typingWordBank || []).map((w, idx) => (
                  <span
                    key={`${w}_${idx}`}
                    className="px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-sm"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <textarea
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            placeholder="Type the full English sentence here..."
            className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
            rows={3}
            disabled={status === "correct" || status === "reveal"}
          />

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={checkAnswer}
              className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700"
              disabled={status === "correct" || status === "reveal"}
            >
              Submit
            </button>

            <button
              onClick={() => setStatus("reveal")}
              className="px-4 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600"
              disabled={status === "correct" || status === "reveal"}
            >
              Show Answer
            </button>
          </div>
        </div>
      )}

      {/* 🔊 AUDIO UI */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (safeMode === "audio") setAudioVariant("repeat");
            else goAudio("repeat");
          }}
          className={`px-3 py-2 rounded-lg border text-sm ${
            audioVariant === "repeat"
              ? "bg-black text-white"
              : "bg-white hover:bg-gray-50"
          }`}
        >
          Repeat
        </button>

        <button
          type="button"
          onClick={() => {
            if (safeMode === "audio") setAudioVariant("dictation");
            else goAudio("dictation");
          }}
          className={`px-3 py-2 rounded-lg border text-sm ${
            audioVariant === "dictation"
              ? "bg-black text-white"
              : "bg-white hover:bg-gray-50"
          }`}
        >
          Dictation
        </button>
      </div>

      {safeMode === "audio" && audioVariant === "repeat" && (
        <div className="bg-white shadow-lg rounded-xl p-5 border border-emerald-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-emerald-700">
              Audio Practice
            </h2>

            <button
              type="button"
              onClick={() => {
                stopTTS();
                setRevealEnglish(false);
              }}
              className="text-xs px-3 py-1 rounded bg-slate-100 hover:bg-slate-200"
            >
              Reset
            </button>
          </div>

          <div className="text-sm text-gray-600 mb-2">
            Listen and repeat. Then mark it done.
          </div>

          <div className="rounded-xl border bg-white p-4">
            {/* Tamil prompt */}
            <div className="text-lg font-semibold tracking-wide">
              {current?.promptTa || "—"}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRevealEnglish((v) => !v)}
                className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
                disabled={!current}
              >
                {revealEnglish ? "Hide English" : "Reveal English"}
              </button>

              <button
                type="button"
                onClick={() => {
                  openAudioGateAfter(1800);
                  speakTTS(englishFull);
                }}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                disabled={!englishFull}
              >
                {isSpeaking ? "Speaking..." : "▶ Play"}
              </button>

              <button
                type="button"
                onClick={() => {
                  stopTTS();
                  resetAudioGate();
                }}
                className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-sm"
              >
                Stop
              </button>
            </div>

            {revealEnglish && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <div className="text-xs text-emerald-700 font-semibold mb-1">
                  English
                </div>
                <div className="text-base font-semibold text-emerald-900">
                  {englishFull || "—"}
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-sm">
                <div className="text-xs text-gray-500 mb-1">Rate</div>
                <input
                  type="range"
                  min="0.6"
                  max="1.8"
                  step="0.1"
                  value={ttsRate}
                  onChange={(e) => setTtsRate(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-600 mt-1">
                  {ttsRate.toFixed(2)}
                </div>
              </label>

              <label className="text-sm">
                <div className="text-xs text-gray-500 mb-1">Accent</div>
                <select
                  value={ttsLang}
                  onChange={(e) => setTtsLang(e.target.value)}
                  className="w-full rounded-lg border px-2 py-2 text-sm"
                >
                  <option value="en-US">US</option>
                  <option value="en-GB">UK</option>
                  <option value="en-IN">India</option>
                </select>
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAudioRepeated}
                  className="w-full px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                  disabled={
                    !current ||
                    status === "correct" ||
                    !audioGateOpen ||
                    audioSubmitting
                  }
                >
                  {audioSubmitting ? "⏳ Saving..." : "I repeated it ✅"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REORDER UI */}
      {safeMode === "reorder" && (
        <>
          {/* Answer Area */}
          <div className="border-2 border-dashed rounded-lg p-4 min-h-[70px] mb-4 flex flex-wrap gap-2">
            {answer.map((word, index) => {
              const isWrong = wrongIndexes.includes(index);
              return (
                <span
                  key={`${word}-${index}`}
                  className={`px-4 py-2 rounded-full text-white transition ${
                    isWrong ? "bg-red-500" : "bg-blue-600"
                  }`}
                >
                  {word}
                </span>
              );
            })}
          </div>

          {/* Tile Bank */}
          <div className="border-2 border-dashed rounded-lg p-4 mb-6 flex flex-wrap gap-2">
            {tiles.map((word, index) => (
              <button
                key={`${word}-${index}`}
                type="button"
                onClick={() => addToAnswer(word)}
                disabled={status === "correct" || status === "reveal"}
                className="px-4 py-2 rounded-full bg-blue-600 text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {word}
              </button>
            ))}
          </div>

          {/* Check Answer button (REORDER only) */}
          {status === "idle" && (
            <button
              type="button"
              onClick={checkReorderAnswer}
              className="w-full bg-purple-600 text-white py-3 rounded-lg text-lg"
            >
              Check Answer
            </button>
          )}
        </>
      )}

      {/* Wrong */}
      {status === "wrong" && (
        <div className="mt-6">
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
            ❌ Not correct. Try again. ({attempts}/{MAX_ATTEMPTS})
          </div>
          <button
            onClick={handleTryAgain}
            className="w-full bg-purple-600 text-white py-3 rounded-lg text-lg"
          >
            Try again
          </button>
        </div>
      )}

      {/* XP Toast */}
      {showXPToast && (
        <div className="fixed top-24 right-6 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce z-50">
          +{earnedXP} XP ✨
        </div>
      )}

      {/* Reveal */}
      {status === "reveal" && (
        <div className="bg-yellow-100 p-4 rounded mt-6">
          📘 <strong>Good attempt! Here is the correct sentence:</strong>
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              {correctOrder.map((word, index) => (
                <span key={index} className="px-3 py-1 bg-green-200 rounded">
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ✅ Lesson completion modal */}
      {!isComplete &&
        !(totalQuestions > 0 && currentIndex >= totalQuestions) &&
        showCompleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="text-xl font-semibold">✅ Lesson Completed!</div>
              <div className="mt-2 text-sm text-gray-600">
                You earned{" "}
                <span className="font-semibold">+{completionXp}</span> XP bonus.
              </div>

              <div className="mt-5 grid gap-2">
                <button
                  className="w-full rounded-xl bg-black px-4 py-2 text-white"
                  onClick={() => {
                    setShowCompleteModal(false);
                    const next = Number(lessonId) + 1;
                    navigate(`/lesson/${next}`, { replace: true });
                  }}
                >
                  Next Lesson →
                </button>

                <button
                  className="w-full rounded-xl border border-gray-300 px-4 py-2"
                  onClick={() => {
                    setShowCompleteModal(false);
                    navigate("/student/leaderboard");
                  }}
                >
                  View Leaderboard
                </button>

                <button
                  className="w-full rounded-xl border border-gray-300 px-4 py-2"
                  onClick={() => {
                    setShowCompleteModal(false);
                    initQuiz();
                  }}
                >
                  Repeat Lesson
                </button>
              </div>
            </div>
          </div>
        )}

      {/* ✅ Correct banner (Typing + Reorder) — bottom floating */}
      {status === "correct" && Number(earnedXP || 0) > 0 && (
        <div className="fixed left-1/2 bottom-6 -translate-x-1/2 z-50">
          <div className="rounded-xl bg-green-100 border border-green-300 px-5 py-3 text-center shadow-lg">
            <div className="font-semibold text-green-800">
              ✅ Correct! Well done
            </div>
            <div className="text-green-800 font-bold">
              +{Number(earnedXP || 0)} XP earned
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// DISK_MARKER_1770108265
