import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/api/apiClient";
import { useLocation, useNavigate } from "react-router-dom";

import { uiFor } from "@/lib/modeUi";

import { track } from "@/lib/track";

import PracticeHeader from "@/components/student/PracticeHeader";
import PromptCard from "@/components/student/PromptCard";

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

  const NEXT_MODE = {
    reorder: "typing",
    typing: "audio",
    audio: "reorder",
    cloze: "reorder",
  };

  const fallbackMode = NEXT_MODE[safeMode] || "reorder";

  // API fetch mode: supports reorder/typing/audio. Cloze is experimental → fall back to reorder.
  const fetchMode = safeMode === "cloze" ? "reorder" : safeMode;

  // XP mode (what we send to backend XP pipeline)
  // Backend currently supports only typing/reorder
  const xpMode = safeMode === "reorder" ? "reorder" : "typing";

  const search = new URLSearchParams(window.location.search);
  const lessonId = Number(search.get("lessonId") || 1);

  const navigate = useNavigate();

  const lessonIdNumSafe = lessonId || 1;
  const nextLessonId = lessonIdNumSafe + 1;

  const difficulty = String(
    search.get("difficulty") || "beginner",
  ).toLowerCase();

  function goLessons() {
    navigate("/lessons", { replace: true });
  }

  function goNextLesson() {
    if (!nextLessonId) return goLessons();
    navigate(
      `/lesson/${nextLessonId}?difficulty=${encodeURIComponent(difficulty)}&autostart=1`,
      { replace: true },
    );
  }

  const asArr = (v) => (Array.isArray(v) ? v : []);
  const norm = (s) =>
    String(s || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  function goAudio(variant) {
    if (!lessonIdNumSafe) return;
    navigate(
      `/practice/audio?lessonId=${encodeURIComponent(lessonIdNumSafe)}&difficulty=${encodeURIComponent(difficulty)}&variant=${encodeURIComponent(variant)}`,
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

  function seededShuffle(arr, seedStr) {
    const a = [...arr];
    // Simple deterministic hash
    let seed = 0;
    const s = String(seedStr ?? "0");
    for (let i = 0; i < s.length; i++)
      seed = (seed * 31 + s.charCodeAt(i)) >>> 0;

    // Deterministic “random” generator
    let x = seed || 123456789;
    const rand = () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return ((x >>> 0) % 1000000) / 1000000;
    };

    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
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

  const [suppressEmpty, setSuppressEmpty] = useState(false);

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

  const lid = Number(lessonIdFromQuery ?? lessonId ?? 0);

  // Reset practice UI when switching modes/lesson/difficulty (React Router does not remount)
  useEffect(() => {
    setIsComplete(false);
    setShowCompleteModal(false);
    setLoadError("");
  }, [safeMode, lid, difficulty]);

  const xpInFlightRef = useRef(false);

  const audioSubmitRef = useRef(new Set()); // per-question "already submitted"
  const [audioSubmitting, setAudioSubmitting] = useState(false); // UX: disable button while saving

  const nextIndex = currentIndex + 1;

  const resumeIndexRef = useRef(null);

  const resumeAppliedRef = useRef(false);

  const resumeWantedRef = useRef(false);

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

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // For reorder: correctOrder (array) OR fallback to words OR split expectedAnswer
  const correctOrderArr =
    Array.isArray(expected.correctOrder) && expected.correctOrder.length
      ? expected.correctOrder
      : expectedWords.length
        ? expectedWords
        : expectedAnswer
          ? expectedAnswer.split(/\s+/)
          : [];

  // Typing hint-only word bank (SCRAMBLED, stable per question)
  const typingWordBankBase =
    Array.isArray(expectedWords) && expectedWords.length
      ? expectedWords
      : expectedAnswer
        ? expectedAnswer.split(/\s+/)
        : [];

  const typingWordBank =
    safeMode === "typing"
      ? seededShuffle(
          typingWordBankBase,
          current?.id ?? `${lid}:${currentIndex}`,
        )
      : typingWordBankBase;

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
    if (!resumeAppliedRef.current) return;

    if (isComplete) return;
    if (totalQuestions > 0 && currentIndex >= totalQuestions) return;

    try {
      const session = {
        lessonId: Number(lid) || 0,
        difficulty: String(difficulty || "beginner"),
        mode: String(fetchMode || safeMode || ""),
        questionIndex: Number(currentIndex) || 0,
        updatedAt: Date.now(),
        ...(String(fetchMode || safeMode) === "audio"
          ? { variant: audioVariant }
          : {}),
      };

      localStorage.setItem("fj_last_session", JSON.stringify(session));
      console.log("[DBG] saved fj_last_session (progress)", session);
    } catch {}
  }, [
    lid,
    difficulty,
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
        lessonId: Number(lid) || 0,
        difficulty: String(difficulty || "beginner"),
        mode: String(fetchMode || safeMode || ""),
        index: "done",
        questionIndex: total,
        total,
        updatedAt: Date.now(),
        ...(String(fetchMode || safeMode) === "audio"
          ? { variant: audioVariant }
          : {}),
      };

      localStorage.setItem("fj_last_session", JSON.stringify(session));
      console.log("[DBG] saved fj_last_session", session);
    } catch {
      // ignore
    }
  }, [
    lid,
    difficulty,
    fetchMode,
    safeMode,
    audioVariant,
    isComplete,
    totalQuestions,
    currentIndex,
    lessonExercises?.length,
  ]);

  const isSessionDone =
    isComplete || (totalQuestions > 0 && currentIndex >= totalQuestions);

  useEffect(() => {
    if (!isSessionDone) return;

    const search = new URLSearchParams(location.search);
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

  useEffect(() => {
    if (!isSessionDone) return;

    const search = new URLSearchParams(location.search);
    if (!lid) return;

    const mode = String(fetchMode || safeMode || "").toLowerCase();
    if (!mode) return;

    // Only track the modes we care about in the hub
    const allowed = ["typing", "reorder", "audio", "cloze"];
    if (!allowed.includes(mode)) return;

    // When session is done, mark THIS mode complete (numbers)
    try {
      writeProgress(lid, mode, {
        completed: Number(totalQuestions || 0),
        total: Number(totalQuestions || 0),
        updatedAt: Date.now(),
      });
    } catch {
      // ignore
    }
  }, [isSessionDone, location.search, fetchMode, safeMode, totalQuestions]);

  useEffect(() => {
    // Mode/lesson changed → reset completion + cursor so UI leaves Session Complete
    setIsComplete(false);
    setShowCompleteModal(false);

    // Reset the question cursor so completion condition can't stay true
    setCurrentIndex(0);

    // Force practice UI to re-load
    setStatus("loading");

    // Drop old exercises so derived totals recompute cleanly
    setLessonExercises([]);

    // Clear any prior error
    setLoadError(null);
  }, [safeMode, lid, difficulty]);

  useEffect(() => {
    setLessonExercises([]);
    loadLessonBatch();
  }, [safeMode, lid, difficulty]);

  // Keep total question count stored for LessonDetail progress summary
  useEffect(() => {
    if (!lid) return;
    if (!lessonExercises || lessonExercises.length === 0) return;

    // store total for both supported modes (typing/reorder)
    writeProgress(lessonId, safeMode, {
      total: lessonExercises.length,
      updatedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lid, safeMode, lessonExercises?.length]);

  useEffect(() => {
    initQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, safeMode, lessonExercises]);

  useEffect(() => {
    // 1) If URL has q=, it always wins
    const qRaw = search.get("q");
    if (qRaw != null) {
      const qNum = Number(qRaw);
      if (Number.isFinite(qNum) && qNum >= 0) {
        setCurrentIndex(qNum);
        return;
      }
    }

    // 2) Else, try last session
    try {
      const last = JSON.parse(
        localStorage.getItem("fj_last_session") || "null",
      );
      if (!last) {
        setCurrentIndex(0);
        return;
      }

      const sameLesson = Number(last.lessonId) === Number(lid);
      const sameDiff =
        String(last.difficulty || "beginner") ===
        String(difficulty || "beginner");
      const sameMode =
        String(last.mode || "").toLowerCase() ===
        String(fetchMode || safeMode || "").toLowerCase();

      if (sameLesson && sameDiff && sameMode) {
        const idx = Number(last.questionIndex);
        setCurrentIndex(Number.isFinite(idx) && idx >= 0 ? idx : 0);
        return;
      }
    } catch {
      // ignore
    }

    // 3) Default fresh start
    setCurrentIndex(0);
  }, [lid, difficulty, safeMode, fetchMode]);

  useEffect(() => {
    try {
      const last = JSON.parse(
        localStorage.getItem("fj_last_session") || "null",
      );
      if (!last) return;

      const sameLesson = Number(last.lessonId) === Number(lid);
      const sameDiff =
        String(last.difficulty || "beginner") ===
        String(difficulty || "beginner");
      const sameMode =
        String(last.mode || "").toLowerCase() ===
        String(fetchMode || safeMode || "").toLowerCase();

      if (!sameLesson || !sameDiff || !sameMode) return;

      const idx = Number(last.questionIndex);
      if (Number.isFinite(idx) && idx >= 0) {
        setCurrentIndex(idx);
        console.log("[DBG] restored index", idx, last);
      }
    } catch (e) {
      console.log("[DBG] restore failed", e);
    }
  }, [lid, difficulty, fetchMode, safeMode]);

  useEffect(() => {
    // reset
    resumeIndexRef.current = null;
    resumeWantedRef.current = false;

    // 1) URL q= wins
    const qRaw = search.get("q");
    if (qRaw != null) {
      const qNum = Number(qRaw);
      if (Number.isFinite(qNum) && qNum >= 0) {
        resumeIndexRef.current = qNum;
        resumeWantedRef.current = true;
        return;
      }
    }

    // 2) Else use last session (if it matches this lesson/difficulty/mode)
    try {
      const last = JSON.parse(
        localStorage.getItem("fj_last_session") || "null",
      );
      if (!last) return;

      const sameLesson = Number(last.lessonId) === Number(lid);
      const sameDiff =
        String(last.difficulty || "beginner") ===
        String(difficulty || "beginner");
      const sameMode =
        String(last.mode || "").toLowerCase() ===
        String(fetchMode || safeMode || "").toLowerCase();

      if (!sameLesson || !sameDiff || !sameMode) return;

      const idx = Number(last.questionIndex);
      if (Number.isFinite(idx) && idx >= 0) {
        resumeIndexRef.current = idx;
        resumeWantedRef.current = true;
      }
    } catch {}
  }, [lid, difficulty, fetchMode, safeMode]);

  useEffect(() => {
    track("practice_view", {
      lessonId: Number(lid) || 0,
      difficulty,
      mode: safeMode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lid, difficulty, safeMode]);

  useEffect(() => {
    if (!isComplete) return;
    track("session_complete", {
      lessonId: Number(lid) || 0,
      difficulty,
      mode: safeMode,
      answered: Number(currentIndex) + 1,
      total: Number(totalQuestions || lessonExercises?.length || 0),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

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

    if (status === "correct") {
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
    setSuppressEmpty(true);
    setTimeout(() => setSuppressEmpty(false), 800);

    const lessonIdNum = lid;

    try {
      const res = await api.get(
        `/quizzes/by-lesson/${lessonIdNum}?mode=${encodeURIComponent(fetchMode)}&difficulty=${encodeURIComponent(difficulty || "beginner")}`,
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

        const prettyMode = safeMode.charAt(0).toUpperCase() + safeMode.slice(1);

        // Premium, actionable empty-state (no mysterious redirects)

        setLoadError(
          `No ${prettyMode} items for this lesson yet. Try ${fallbackMode} to keep your streak going.`,
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

  useEffect(() => {
    if (!Array.isArray(lessonExercises) || lessonExercises.length === 0) return;

    // If we wanted a resume and have an index, apply it once
    if (resumeWantedRef.current && resumeIndexRef.current != null) {
      const idx = Number(resumeIndexRef.current);
      const max = lessonExercises.length - 1;
      const clamped = Math.max(0, Math.min(idx, max));

      setCurrentIndex(clamped);
      console.log("[DBG] applied resume index after load", clamped);

      resumeIndexRef.current = null;
      resumeWantedRef.current = false;
    }

    // Now it's safe to start saving progress (prevents index 0 overwrite on refresh)
    resumeAppliedRef.current = true;
  }, [lessonExercises]);

  async function loadRandomOne() {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get("/quizzes/random", {
        params: { mode: fetchMode, lessonId: lid },
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
        lessonId: lid || 0,
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
        <h1 className="text-2xl font-bold mb-2">
          Practice: {uiFor(safeMode).title}
        </h1>
        <p className="text-gray-600">
          This mode is coming next. For now, use <b>{uiFor("reorder").title}</b>{" "}
          or <b>{uiFor("typing").title}</b>.
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
    const sp = new URLSearchParams(location.search);
    const lid = sp.get("lessonId"); // SOURCE OF TRUTH
    if (!lid) return;

    const diffRaw = String(sp.get("difficulty") || "").toLowerCase();
    const difficulty = diffRaw === "intermediate" ? "intermediate" : "beginner";

    const mode = String(nextMode || "").toLowerCase();
    if (!mode) return;

    // Build target URL FIRST
    let target = "";

    if (mode === "audio") {
      const qs = new URLSearchParams();
      qs.set("lessonId", String(lid));
      qs.set("difficulty", difficulty);
      qs.set("variant", nextVariant || "repeat");
      target = `/practice/audio?${qs.toString()}`;
    } else {
      const qs = new URLSearchParams();
      qs.set("lessonId", String(lid));
      qs.set("difficulty", difficulty);
      target = `/practice/${mode}?${qs.toString()}`;
    }

    // Navigate FIRST (so button doesn't disappear without redirect)
    navigate(target, { replace: true });

    // Then reset state on next tick (prevents stale modal / audio lock)
    setTimeout(() => {
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
    }, 0);
  }

  const MODE_ACCENT = {
    reorder: {
      bar: "bg-indigo-500",
      soft: "bg-indigo-50",
      border: "border-indigo-200",
      text: "text-indigo-700",
    },
    typing: {
      bar: "bg-amber-500",
      soft: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
    },
    audio: {
      bar: "bg-emerald-500",
      soft: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
    },
  };
  const A = MODE_ACCENT[safeMode] || {
    bar: "bg-slate-500",
    soft: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
  };

  // -------------------
  // completion
  // -------------------
  //   � SESSION COMPLETE (10 questions) — engagement loop
  if (isComplete || (totalQuestions > 0 && currentIndex >= totalQuestions)) {
    const search = new URLSearchParams(location.search);
    const lid = Number(search.get("lessonId") || 0);
    const nextLessonId = lid ? lid + 1 : null;

    const diffRaw = String(search.get("difficulty") || "").toLowerCase();
    const difficulty = diffRaw === "intermediate" ? "intermediate" : "beginner";
    const base = difficulty === "intermediate" ? "/i" : "/b";

    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {/* Accent bar (mode-based) */}
            <div
              className={`h-2 w-full ${MODE_ACCENT?.[safeMode]?.bar || "bg-slate-500"}`}
            />

            <div className="p-6 sm:p-8">
              <div className="text-center">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Session complete
                </div>
                <h1 className="mt-2 text-3xl font-extrabold text-slate-900">
                  🎉 Great job!
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  You finished today’s practice. Keep the streak alive by doing
                  10 minutes daily.
                </p>
              </div>

              {/* Quick stats */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-xs font-semibold text-slate-500">
                    Mode
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    {uiFor(safeMode).title}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-xs font-semibold text-slate-500">
                    Bonus XP
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    +{Number(completionXp || 0)} XP
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-xs font-semibold text-slate-500">
                    Streak
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    🔥 {Number(streak || 0)}-day
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div className="mt-7 grid gap-3">
                {/* Primary: Continue */}
                {nextLessonId ? (
                  <button
                    type="button"
                    className="w-full rounded-2xl bg-slate-900 px-6 py-4 text-base font-semibold text-white shadow-sm hover:opacity-90"
                    onClick={() => {
                      track("practice_cta_clicked", {
                        lessonId: Number(lid) || 0,
                        difficulty,
                        mode: safeMode,
                        cta: "continue_next_lesson",
                        nextLessonId,
                      });

                      navigate(
                        `${base}/lesson/${nextLessonId}?difficulty=${encodeURIComponent(
                          difficulty,
                        )}&autostart=1`,
                        { replace: true },
                      );
                    }}
                  >
                    Continue to Lesson {nextLessonId} →
                  </button>
                ) : null}

                {/* Secondary: Back */}
                <button
                  type="button"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-4 text-base font-semibold text-slate-900 hover:bg-slate-50"
                  onClick={() => {
                    track("practice_cta_clicked", {
                      lessonId: Number(lid) || 0,
                      difficulty,
                      mode: safeMode,
                      cta: "back_to_lesson",
                    });

                    navigate(
                      `${base}/lesson/${lid || 1}?difficulty=${encodeURIComponent(difficulty)}`,
                      { replace: true },
                    );
                  }}
                >
                  Back to Lesson {lid || 1}
                </button>

                {/* Engagement loop */}
                <div className="mt-2">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Try another mode
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-left hover:bg-slate-100"
                      onClick={() => {
                        track("mode_switched", {
                          lessonId: Number(lid) || 0,
                          difficulty,
                          fromMode: safeMode,
                          toMode: fallbackMode,
                          source: "session_complete",
                        });

                        navigate(
                          `/practice/${fallbackMode}?lessonId=${encodeURIComponent(
                            lid || 1,
                          )}&difficulty=${encodeURIComponent(difficulty)}`,
                        );
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            MODE_ACCENT?.[fallbackMode]?.bar || "bg-slate-500"
                          }`}
                        />
                        <div className="text-sm font-bold text-slate-900">
                          {uiFor(fallbackMode).title}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        Quick 2-minute boost →
                      </div>
                    </button>

                    <button
                      type="button"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-left hover:bg-slate-100"
                      onClick={() => {
                        track("mode_switched", {
                          lessonId: Number(lid) || 0,
                          difficulty,
                          fromMode: safeMode,
                          toMode: "audio",
                          source: "session_complete",
                        });

                        navigate(
                          `/practice/audio?lessonId=${encodeURIComponent(
                            lid || 1,
                          )}&difficulty=${encodeURIComponent(difficulty)}&variant=repeat`,
                        );
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${MODE_ACCENT?.audio?.bar || "bg-slate-500"}`}
                        />
                        <div className="text-sm font-bold text-slate-900">
                          {uiFor("audio").title}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        Improve pronunciation →
                      </div>
                    </button>
                  </div>
                </div>

                {/* Optional: leaderboard (kept as tertiary) */}
                <button
                  type="button"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => navigate("/student/leaderboard")}
                >
                  View leaderboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const exLen = Array.isArray(lessonExercises) ? lessonExercises.length : 0;

  console.log("[DBG] empty-check", {
    hasLoadedOnce,
    loading,
    loadError,
    exLen,
    status: typeof status === "undefined" ? "(no status var)" : status,
  });

  // -------------------
  // empty state (no exercises)
  // -------------------
  if (
    !suppressEmpty &&
    hasLoadedOnce &&
    !loading &&
    (loadError || exLen === 0)
  ) {
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
              onClick={() =>
                navigate(
                  `/b/lesson/${lid}?difficulty=${encodeURIComponent(difficulty)}`,
                )
              }
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
              onClick={() => {
                const sp = new URLSearchParams(window.location.search);
                const lid = sp.get("lessonId") || String(lessonId);
                const diff = sp.get("difficulty") || difficulty || "beginner";

                const nextMode = fallbackMode;

                navigate(
                  `/practice/${nextMode}?lessonId=${encodeURIComponent(
                    lid,
                  )}&difficulty=${encodeURIComponent(diff)}`,
                  { replace: true },
                );
              }}
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
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-red-600">{loadError}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/b/lesson/${lid}?difficulty=${encodeURIComponent(difficulty)}`,
                )
              }
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

  if (
    hasLoadedOnce &&
    !loading &&
    (loadError || lessonExercises.length === 0)
  ) {
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
              onClick={() =>
                navigate(
                  `/b/lesson/${lid}?difficulty=${encodeURIComponent(difficulty)}`,
                )
              }
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
              onClick={() => {
                const sp = new URLSearchParams(window.location.search);
                const lid = sp.get("lessonId") || String(lessonId);
                const diff = sp.get("difficulty") || difficulty || "beginner";

                const nextMode = fallbackMode;

                navigate(
                  `/b/practice/${nextMode}?lessonId=${encodeURIComponent(lid)}&difficulty=${encodeURIComponent(diff)}`,
                  { replace: true },
                );
              }}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Try {uiFor(nextMode).title} →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!suppressEmpty && hasLoadedOnce && !loading && !current) {
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

  function AudioVariantToggle({ audioVariant, onGoVariant }) {
    return (
      <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white/80 p-1 shadow-sm">
        <button
          type="button"
          onClick={() => onGoVariant("repeat")}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            audioVariant === "repeat"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          Repeat
        </button>

        <button
          type="button"
          onClick={() => onGoVariant("dictation")}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            audioVariant === "dictation"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          Dictation
        </button>
      </div>
    );
  }

  // ===============================
  // Sticky Bottom CTA (MVP-safe)
  // ===============================
  const BTN_PRIMARY_BASE =
    "w-full rounded-2xl px-4 py-3 text-base font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

  const STICKY_PRIMARY_BG = {
    reorder: "bg-indigo-600 hover:bg-indigo-700",
    typing: "bg-amber-600 hover:bg-amber-700",
    audio: "bg-emerald-600 hover:bg-emerald-700",
  };

  const BTN_PRIMARY_MODE_BG =
    safeMode === "reorder"
      ? "bg-indigo-600 hover:bg-indigo-700"
      : safeMode === "typing"
        ? "bg-amber-600 hover:bg-amber-700"
        : safeMode === "audio"
          ? "bg-emerald-600 hover:bg-emerald-700"
          : "bg-slate-900 hover:bg-slate-950";

  const stickyPrimaryBg =
    safeMode === "reorder"
      ? "bg-indigo-600 hover:bg-indigo-700"
      : safeMode === "typing"
        ? "bg-amber-600 hover:bg-amber-700"
        : safeMode === "audio"
          ? "bg-emerald-600 hover:bg-emerald-700"
          : "bg-slate-900 hover:bg-slate-950";

  const BTN_SECONDARY =
    "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

  function StickyCTABar({ cfg }) {
    if (!cfg?.show) return null;

    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/85 backdrop-blur shadow-[0_-8px_30px_rgba(15,23,42,0.08)]">
        <div
          className={`h-[3px] w-full ${MODE_ACCENT?.[safeMode]?.bar || "bg-slate-500"}`}
        />
        <div className="mx-auto max-w-3xl px-4 pt-3 pb-[env(safe-area-inset-bottom)]">
          {cfg.hintText ? (
            <div className="mb-2 text-xs font-semibold text-slate-500">
              {cfg.hintText}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            {cfg.secondary?.length ? (
              <div className="flex flex-wrap gap-2">
                {cfg.secondary.map((s, idx) => (
                  <button
                    key={`${s.label}-${idx}`}
                    type="button"
                    onClick={s.onClick}
                    className={BTN_SECONDARY}
                    disabled={!!s.disabled}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : (
              <div />
            )}

            <div className="ml-auto w-full max-w-[260px]">
              <button
                type="button"
                onClick={cfg.primary.onClick}
                className={`${BTN_PRIMARY_BASE} ${
                  STICKY_PRIMARY_BG?.[safeMode] ||
                  "bg-slate-900 hover:bg-slate-950"
                }`}
                disabled={!!cfg.primary.disabled}
              >
                {cfg.primary.label}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function getStickyCtaConfig({
    show,
    lid,
    difficulty,
    safeMode,
    status,
    audioVariant,
    audioGateOpen,
    typedAnswer,
    reorderAnswerLen,
    track,

    onCheckReorder,
    onTryAgain,
    onNext,
    onSubmit,
    onReveal,
    onClearTyping,
    onAudioRepeated,
    onPlayAudio,
    onResetAudio,
  }) {
    if (!show) return { show: false, primary: null, secondary: [] };

    const basePayload = {
      lid,
      difficulty,
      mode: safeMode,
      variant: safeMode === "audio" ? audioVariant : undefined,
      status,
    };

    const firePrimary = (label, fn) => () => {
      try {
        track?.("sticky_primary_click", { ...basePayload, label });
      } catch {}
      fn?.();
    };

    const fireSecondary = (label, fn) => () => {
      try {
        track?.("sticky_secondary_click", { ...basePayload, label });
      } catch {}
      fn?.();
    };

    // ===== REORDER =====
    if (safeMode === "reorder") {
      if (status === "idle") {
        return {
          show: true,
          primary: {
            label: "Check Answer",
            onClick: firePrimary("Check Answer", onCheckReorder),
            disabled: !(reorderAnswerLen > 0),
          },
          secondary: [
            { label: "Reset", onClick: fireSecondary("Reset", onTryAgain) },
          ],
        };
      }
      if (status === "wrong") {
        return {
          show: true,
          primary: {
            label: "Try again",
            onClick: firePrimary("Try again", onTryAgain),
          },
          secondary: [],
        };
      }
      return {
        show: true,
        primary: { label: "Next", onClick: firePrimary("Next", onNext) },
        secondary: [],
      };
    }

    // ===== TYPING + AUDIO DICTATION =====
    const isTypingLike =
      safeMode === "typing" ||
      (safeMode === "audio" && audioVariant === "dictation");

    if (isTypingLike) {
      const trimmed = String(typedAnswer || "").trim();
      const canSubmit = trimmed.length > 0;

      if (status === "reveal" || status === "correct") {
        return {
          show: true,
          primary: { label: "Next", onClick: firePrimary("Next", onNext) },
          secondary: [],
        };
      }

      const secondaryRaw = [
        {
          label: "Show Answer",
          onClick: fireSecondary("Show Answer", onReveal),
        },
        ...(safeMode === "audio" && audioVariant === "dictation"
          ? [
              {
                label: "Play Audio",
                onClick: fireSecondary("Play Audio", onPlayAudio),
              },
            ]
          : []),
      ];

      // Typing & Dictation: keep sticky clean (Clear stays in the card header)
      return {
        show: true,
        primary: {
          label: "Submit",
          onClick: firePrimary("Submit", onSubmit),
          disabled: !canSubmit,
        },
        secondary: secondaryRaw,
      };
    }

    // ===== AUDIO REPEAT =====
    if (safeMode === "audio" && audioVariant === "repeat") {
      return {
        show: true,
        primary: {
          label: "I repeated it ✅",
          onClick: firePrimary("I repeated it ✅", onAudioRepeated),
          disabled: !audioGateOpen,
        },
        secondary: [
          { label: "Reset", onClick: fireSecondary("Reset", onResetAudio) },
          { label: "Play", onClick: fireSecondary("Play", onPlayAudio) },
        ],
        hintText: audioGateOpen ? undefined : "Tap Play first to unlock ✅",
      };
    }

    return { show: false, primary: null, secondary: [] };
  }

  // ===== Sticky CTA visibility (ACTIVE question only) =====
  const stickyShow = !!current && !loading && !loadError && !showCompleteModal;

  // Safe audio play/reset wrappers (do not crash if functions are absent)
  const playAudioSafe = () => {
    const text = String(expectedAnswer || englishFull || "").trim();
    try {
      if (typeof speakTTS === "function") speakTTS(text);
      else if (typeof speak === "function") speak(text);
    } catch {}
  };

  const resetAudioSafe = () => {
    try {
      if (typeof stopTTS === "function") stopTTS();
      else if (typeof stop === "function") stop();
    } catch {}
    try {
      setRevealEnglish(false);
    } catch {}
    try {
      if (typeof resetAudioGate === "function") resetAudioGate();
    } catch {}
  };

  const stickyCfg = getStickyCtaConfig({
    show: !!stickyShow,
    lid,
    difficulty,
    safeMode,
    status,
    audioVariant,
    audioGateOpen: !!audioGateOpen,
    typedAnswer,
    reorderAnswerLen: Array.isArray(answer) ? answer.length : 0,
    track,

    onCheckReorder: checkReorderAnswer,
    onTryAgain: handleTryAgain,
    onNext: loadNextQuestion,
    onSubmit: checkAnswer,
    onReveal: () => setStatus("reveal"),
    onClearTyping: () => setTypedAnswer(""),
    onAudioRepeated: handleAudioRepeated,
    onPlayAudio: playAudioSafe,
    onResetAudio: resetAudioSafe,
  });

  const setAudioVariantInUrl = (v) => {
    const sp = new URLSearchParams(location.search);
    sp.set("variant", v);
    navigate(`${location.pathname}?${sp.toString()}`, { replace: true });
  };

  // -------------------
  // UI
  // -------------------
  return (
    <div className="min-h-screen bg-slate-50">
      <PracticeHeader
        lid={lid}
        difficulty={difficulty}
        mode={safeMode}
        currentIndex={currentIndex}
        total={totalQuestions || lessonExercises?.length || 0}
        streakText={`${Number(streak || 0)}-day streak`}
        onBack={() =>
          navigate(
            `/b/lesson/${lid || 1}?difficulty=${encodeURIComponent(
              difficulty || "beginner",
            )}`,
          )
        }
      />

      {import.meta.env.DEV ? (
        <div className="mx-auto max-w-3xl px-4 pt-3 text-center text-xs text-slate-400">
          urlMode: <b>{String(urlMode)}</b> | activeMode: <b>{activeMode}</b> |
          safeMode: <b>{safeMode}</b> | lid: <b>{String(lid)}</b>
        </div>
      ) : null}

      <PromptCard tamil={current?.promptTa || "—"} />

      {/* Hint */}
      {showHint && status !== "correct" && (
        <div className="mx-auto max-w-3xl px-4 pt-3">
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm font-semibold text-purple-800">
            Hint: Subject → Verb → Action
          </div>
        </div>
      )}

      {/* Main content wrapper (DO NOT close this here) */}
      <div
        className={`mx-auto max-w-3xl px-4 pt-4 ${stickyCfg.show ? "pb-28" : "pb-10"}`}
      >
        {/* 🧩 CLOZE UI */}
        {safeMode === "cloze" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-900">
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
                {!stickyCfg.show && (
                  <button
                    onClick={checkAnswer}
                    className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                    disabled={
                      status === "correct" || status === "reveal" || !cloze
                    }
                  >
                    Submit
                  </button>
                )}

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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`h-1 w-full rounded-t-2xl ${A.bar}`} />
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {safeMode === "audio" && audioVariant === "dictation"
                    ? "Audio Dictation"
                    : uiFor("typing").title}
                </h2>

                {safeMode === "audio" && audioVariant === "dictation" ? (
                  <div className="mt-1 text-xs text-slate-500">
                    Listen once. Type what you hear.
                  </div>
                ) : null}
                {/* Status pills */}
                {status === "wrong" && (
                  <div className="mt-3 inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                    Try again
                  </div>
                )}
                {status === "reveal" && (
                  <div
                    className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${A.border} ${A.soft} ${A.text}`}
                  >
                    Answer shown
                  </div>
                )}
                {status === "correct" && (
                  <div className="mt-3 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Nice! ✅
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {safeMode === "audio" && audioVariant === "dictation" ? (
                  <AudioVariantToggle
                    audioVariant={audioVariant}
                    onGoVariant={(v) => setAudioVariantInUrl(v)}
                  />
                ) : null}

                <button
                  type="button"
                  onClick={() => setTypedAnswer("")}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  disabled={status === "correct" || status === "reveal"}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* 🔊 Audio Dictation Controls (only when audio + dictation) */}
            {safeMode === "audio" && audioVariant === "dictation" && (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-600">
                      Dictation controls
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Tap play once. Then type what you heard.
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => speakTTS(englishFull)}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      disabled={!englishFull}
                    >
                      <span className="text-base">▶</span>
                      {isSpeaking ? "Playing…" : "Play"}
                    </button>

                    <button
                      type="button"
                      onClick={() => stopTTS()}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Word Bank (hint only — not clickable) */}
            {safeMode === "typing" && (
              <div className="mb-3">
                <div className="mb-2 text-xs font-semibold text-slate-600">
                  Word Bank (hint only)
                </div>

                <div className="flex flex-wrap gap-2">
                  {(typingWordBank || []).map((w, idx) => (
                    <span
                      key={`${w}_${idx}`}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 shadow-sm"
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
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              rows={3}
              disabled={status === "correct" || status === "reveal"}
            />
            <div className="flex items-center gap-3 mt-3">
              {!stickyCfg.show && (
                <button
                  onClick={checkAnswer}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90"
                  disabled={status === "correct" || status === "reveal"}
                >
                  Submit
                </button>
              )}

              {!stickyCfg.show && (
                <button
                  onClick={() => setStatus("reveal")}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  disabled={status === "correct" || status === "reveal"}
                >
                  Show Answer
                </button>
              )}
            </div>
          </div>
        )}

        {safeMode === "audio" && audioVariant === "repeat" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`h-1 w-full rounded-t-2xl ${A.bar}`} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {uiFor("audio").title}
                </h2>
                <div className="mt-1 text-xs text-slate-500">
                  Listen and repeat. Then mark it done.
                </div>
                {/* Status pills */}
                {!audioGateOpen && (
                  <div
                    className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${A.border} ${A.soft} ${A.text}`}
                  >
                    Tap Play first to unlock ✅
                  </div>
                )}
                {status === "correct" && (
                  <div className="mt-3 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Done ✅
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {/* Repeat / Dictation toggle */}
                <AudioVariantToggle
                  audioVariant={audioVariant}
                  onGoVariant={(v) => setAudioVariantInUrl(v)}
                />

                {/* Reset */}
                <button
                  type="button"
                  onClick={() => {
                    stopTTS();
                    setRevealEnglish(false);
                    resetAudioGate();
                  }}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-600">
                    Repeat this sentence
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Tap Play → repeat aloud → mark it done.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRevealEnglish((v) => !v)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      revealEnglish
                        ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
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
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    disabled={!englishFull}
                  >
                    <span className="text-base">▶</span>
                    {isSpeaking ? "Playing…" : "Play"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopTTS();
                      resetAudioGate();
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Stop
                  </button>
                </div>
              </div>

              {revealEnglish && (
                <div className="mt-4 rounded-2xl border border-indigo-200 bg-white p-4">
                  <div className="text-xs font-semibold text-indigo-700">
                    English
                  </div>
                  <div className="mt-2 text-lg font-bold text-slate-900">
                    {englishFull || "—"}
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                <div className="text-xs text-slate-500 mb-1">Rate</div>
                <input
                  type="range"
                  min="0.6"
                  max="1.8"
                  step="0.1"
                  value={ttsRate}
                  onChange={(e) => setTtsRate(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-slate-700 font-semibold mt-1">
                  {ttsRate.toFixed(2)}
                </div>
              </label>

              <label className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                <div className="text-xs text-slate-500 mb-1">Accent</div>
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
                {!stickyCfg.show && (
                  <button
                    type="button"
                    onClick={handleAudioRepeated}
                    className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    disabled={
                      !current ||
                      status === "correct" ||
                      !audioGateOpen ||
                      audioSubmitting
                    }
                  >
                    {audioSubmitting ? "⏳ Saving..." : "I repeated it ✅"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* REORDER UI */}
        {safeMode === "reorder" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`h-1 w-full rounded-t-2xl ${A.bar}`} />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {uiFor("reorder").title}
              </h2>
              <button
                type="button"
                onClick={handleTryAgain}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                disabled={status === "correct" || status === "reveal"}
              >
                Reset
              </button>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {uiFor("reorder").sub}
            </div>

            {/* Status pills */}
            {(status === "wrong" ||
              (typeof wrongIndexes !== "undefined" &&
                Array.isArray(wrongIndexes) &&
                wrongIndexes.length > 0)) && (
              <div className="mt-3 inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                Not quite — try again
              </div>
            )}
            {status === "reveal" && (
              <div
                className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${A.border} ${A.soft} ${A.text}`}
              >
                Answer shown
              </div>
            )}
            {status === "correct" && (
              <div className="mt-3 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Correct ✅
              </div>
            )}

            {/* Answer Area */}
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 min-h-[72px] flex flex-wrap gap-2">
              {Array.isArray(answer) && answer.length === 0 && (
                <div className="w-full text-sm font-semibold text-slate-400">
                  Tap the words below to build the sentence
                </div>
              )}
              {answer.map((word, index) => {
                const isWrong = wrongIndexes.includes(index);
                return (
                  <span
                    key={`${word}-${index}`}
                    className={`px-4 py-2 rounded-full text-sm font-semibold ${
                      isWrong
                        ? "bg-rose-100 text-rose-800 border border-rose-200"
                        : `${A.border} ${A.soft} ${A.text} shadow-sm`
                    }`}
                  >
                    {word}
                  </span>
                );
              })}
            </div>

            {/* Tile Bank */}
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap gap-2">
              {tiles.map((word, index) => (
                <button
                  key={`${word}-${index}`}
                  type="button"
                  onClick={() => addToAnswer(word)}
                  disabled={status === "correct" || status === "reveal"}
                  className={`px-4 py-2 rounded-full border ${A.border} ${A.soft} ${A.text} shadow-sm transition hover:brightness-[0.98] hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {word}
                </button>
              ))}
            </div>

            {/* Check Answer */}
            {!stickyCfg.show && status === "idle" && (
              <button
                type="button"
                onClick={checkReorderAnswer}
                className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Check Answer
              </button>
            )}
          </div>
        )}

        {/* Wrong */}
        {status === "wrong" && (
          <div className="mt-6">
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
              ❌ Not correct. Try again. ({attempts}/{MAX_ATTEMPTS})
            </div>

            {!stickyCfg.show && (
              <button
                onClick={handleTryAgain}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Try again
              </button>
            )}
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
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              📘 Good attempt! Here is the correct sentence:
            </div>

            {(() => {
              const text = String(expectedAnswer || englishFull || "").trim();
              const words = Array.isArray(text)
                ? text
                : String(text).trim().split(/\s+/).filter(Boolean);

              if (!words.length) {
                return (
                  <div className="mt-2 text-sm text-slate-600">
                    (No answer available for this item.)
                  </div>
                );
              }

              return (
                <div className="mt-3 flex flex-wrap gap-2">
                  {words.map((word, index) => (
                    <span
                      key={`${word}-${index}`}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <StickyCTABar cfg={stickyCfg} />

      {/* ✅ Lesson completion modal */}
      {!isComplete &&
        !(totalQuestions > 0 && currentIndex >= totalQuestions) &&
        showCompleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
              {/* Top accent */}
              <div className="h-1.5 w-full bg-emerald-500" />

              <div className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Lesson complete
                    </div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900">
                      🎉 Great job!
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      You earned{" "}
                      <span className="font-bold text-slate-900">
                        +{completionXp}
                      </span>{" "}
                      XP bonus.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCompleteModal(false)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-5 grid gap-3">
                  {/* Primary */}
                  <button
                    className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                    onClick={() => {
                      setShowCompleteModal(false);
                      const next = Number(lid) + 1;
                      navigate(
                        `${base}/lesson/${next}?difficulty=${encodeURIComponent(difficulty)}`,
                        { replace: true },
                      );
                    }}
                  >
                    Continue to next lesson →
                  </button>

                  {/* Secondary row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      onClick={() => {
                        setShowCompleteModal(false);
                        initQuiz();
                      }}
                    >
                      Repeat lesson
                    </button>

                    <button
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      onClick={() => {
                        setShowCompleteModal(false);
                        navigate("/student/leaderboard");
                      }}
                    >
                      View leaderboard
                    </button>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-600">
                    Keep your streak going
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Practice 10 minutes daily for faster automatic sentence
                    formation.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* ✅ Correct banner (Typing + Reorder) — bottom floating */}
      {status === "correct" && Number(earnedXP || 0) > 0 && (
        <div className="fixed left-1/2 bottom-6 -translate-x-1/2 z-50">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-3 text-center shadow-lg">
            <div className="font-semibold text-emerald-800">Correct ✅</div>
            <div className="text-emerald-900 font-extrabold">
              +{Number(earnedXP || 0)} XP
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// DISK_MARKER_1770108265
