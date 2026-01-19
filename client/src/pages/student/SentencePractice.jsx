import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/api/apiClient";

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

      const u = new SpeechSynthesisUtterance(text);
      u.rate = Number(ttsRate || 1.0);
      u.lang = String(ttsLang || "en-IN");

      setIsSpeaking(true);
      u.onend = () => setIsSpeaking(false);
      u.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(u);
    } catch {
      setIsSpeaking(false);
    }

    function englishFull(q) {
      if (!q) return "";

      // Typing exercises (most common)
      if (typeof q.expected === "string" && q.expected.trim()) {
        return q.expected.trim();
      }

      // Reorder exercises
      if (Array.isArray(q.correctOrder) && q.correctOrder.length) {
        return q.correctOrder.join(" ").trim();
      }

      // Cloze variants (if you ever store it differently)
      if (typeof q.fullSentence === "string" && q.fullSentence.trim()) {
        return q.fullSentence.trim();
      }

      return "";
    }
  }

  // -------------------
  // refs
  // -------------------
  const correctSoundRef = useRef(null);
  const wrongSoundRef = useRef(null);

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
    stopTTS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, safeMode]);

  // -------------------
  // Derived data (must be declared AFTER state)
  // -------------------
  const currentQuestion = useMemo(() => {
    const list = Array.isArray(lessonExercises) ? lessonExercises : [];
    const q = list[currentIndex];
    return q || null;
  }, [lessonExercises, currentIndex]);

  // ✅ Typing Word Bank (hint chips)
  const typingWordBank = useMemo(() => {
    if (safeMode !== "typing") return [];
    const words = Array.isArray(currentQuestion?.correctOrder)
      ? [...currentQuestion.correctOrder]
      : [];
    return words.sort(() => Math.random() - 0.5);
  }, [safeMode, currentQuestion, currentIndex]);

  const englishFull = useMemo(() => {
    const target =
      currentQuestion?.answer?.trim() ||
      (currentQuestion?.correctOrder || []).join(" ");
    return String(target || "").trim();
  }, [currentQuestion, currentIndex]);

  // ✅ Cloze: build masked sentence + missing word
  const cloze = useMemo(() => {
    if (safeMode !== "cloze") return null;

    const target =
      currentQuestion?.answer?.trim() ||
      currentQuestion?.expected?.trim() ||
      (Array.isArray(currentQuestion?.correctOrder)
        ? currentQuestion.correctOrder.join(" ")
        : "");

    const words = String(target || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => String(w));
    if (words.length < 3) return null;

    // pick a "good" blank word (avoid tiny words)
    const candidates = words
      .map((w, i) => ({ w, i }))
      .filter(
        ({ w }) => String(w || "").replace(/[^a-zA-Z']/g, "").length >= 3,
      );

    const pick = candidates.length
      ? candidates[Math.floor(candidates.length / 2)]
      : {
          w: words[Math.floor(words.length / 2)],
          i: Math.floor(words.length / 2),
        };

    const missingWord = String(pick.w || "").trim();
    const maskedWords = words.map((w, idx) => (idx === pick.i ? "____" : w));
    const masked = maskedWords.join(" ");
    const full = words.join(" ");

    return {
      missingWord,
      masked,
      index: pick.i,
      words,
      full,
    };
  }, [safeMode, currentQuestion, currentIndex]);

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

      if (!sameLesson || !sameMode) return;

      if (last?.questionIndex != null) {
        setCurrentIndex(Number(last.questionIndex) || 0);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, safeMode]);

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

  // AUTO NEXT after correct/reveal
  useEffect(() => {
    if (status === "correct" || status === "reveal") {
      const timer = setTimeout(() => {
        loadNextQuestion();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, loadNextQuestion]);

  // -------------------
  // XP update (stable + backend-friendly)
  // -------------------
  async function commitXP({ isCorrect, attemptNo, mode }) {
    const attemptId =
      globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `att_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // backend-friendly numeric IDs
    const numericQuestionId = Number(currentIndex + 1); // 1..N

    // choose xp by mode (keep your economy)
    const xpValue = isCorrect
      ? mode === "typing"
        ? 150
        : mode === "reorder"
          ? 100
          : mode === "cloze"
            ? 80
            : 0
      : 0;

    // ✅ build payload correctly (NO statements inside object literal)
    const payload = {
      attemptId,
      attemptNo: Number(attemptNo ?? 1) || 1,

      // ✅ REQUIRED for XP award logic
      xp: xpValue,
      event: isCorrect ? `${mode}_correct` : `${mode}_wrong`,
      meta: {
        lessonId,
        mode,
        questionId: numericQuestionId,
      },

      // keep your existing fields (safe/backward compatible)
      lessonId, // numeric (dynamic)
      questionId: numericQuestionId,

      lessonKey: `L${lessonId}`,
      questionKey: `Q${numericQuestionId}`,

      practiceType: mode,
      mode,

      isCorrect: !!isCorrect,
      completedQuiz: false,
      timeTakenSec: null,
    };

    try {
      const res = await api.post("/progress/update", payload);
      const data = res?.data ?? res;

      if (!data || data.ok !== true) {
        console.error("[XP] /progress/update not ok", {
          payload,
          response: data,
        });
        setEarnedXP(0);
        return;
      }

      const awarded =
        Number(
          data.xpAwarded ??
            data.xpDelta ??
            data.xp_delta ??
            data.earnedXP ??
            data.xp ??
            0,
        ) || 0;

      // TEMP DEBUG (remove later if you want)
      console.log("[XP] awarded from server:", awarded, "raw:", data);

      setEarnedXP(awarded);
      setStreak(Number(data.streak ?? data.currentStreak ?? 0) || 0);

      setShowXPToast(true);
      setTimeout(() => setShowXPToast(false), 1200);

      window.dispatchEvent(new Event("fj:xp_updated"));
    } catch (err) {
      console.error("[XP] update failed", err);
      setEarnedXP(0);
    }
  }

  async function awardCompletionBonus(mode) {
    const attemptId =
      globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `complete_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const payload = {
      attemptId,
      attemptNo: 1,
      xp: 300,
      event: "lesson_completed",
      meta: { lessonId, mode },
      lessonId,
      practiceType: mode,
      mode,
      completedQuiz: true,
    };

    try {
      const res = await api.post("/progress/update", payload);
      console.log("[XP] commitXP response", res?.data ?? res);
      const data = res?.data ?? res;

      const awarded =
        Number(
          data?.xpAwarded ??
            data?.xpDelta ??
            data?.xp_delta ??
            data?.earnedXP ??
            data?.xp ??
            300,
        ) || 300;

      return { ok: true, awarded };
    } catch (err) {
      console.error("[XP] completion bonus failed", err);
      return { ok: false, awarded: 0 };
    }
  }

  // -------------------
  // helpers
  // -------------------
  function normalizeExercise(raw) {
    if (!raw) return null;

    const ex = raw.exercise ?? raw;

    return {
      id: ex.id ?? ex.exerciseId ?? null,
      type: ex.type ?? ex.practiceType ?? ex.mode ?? null, // ✅ ADD THIS
      tamil: ex.tamil ?? ex.promptTamil ?? ex.tamilLine ?? ex.promptTa ?? "",
      correctOrder: Array.isArray(ex.correctOrder) ? ex.correctOrder : [],
      answer: ex.answer ?? ex.english ?? "",
      xp: ex.xp ?? 0, // optional, but useful
    };
  }

  async function loadLessonBatch() {
    setLoading(true);
    setLoadError("");

    try {
      const res = await api.get(
        `/quizzes/by-lesson/${lessonId}?mode=${encodeURIComponent(fetchMode)}`,
      );

      const data = res?.data ?? res;

      const ok = Array.isArray(data) ? true : data?.ok;
      if (data?.ok === false) {
        throw new Error((data && data.error) || "Failed to load questions");
      }

      const arr = Array.isArray(data)
        ? data
        : Array.isArray(data.questions)
          ? data.questions
          : Array.isArray(data.data?.questions)
            ? data.data.questions
            : Array.isArray(data.items)
              ? data.items
              : Array.isArray(data.exercises)
                ? data.exercises
                : [];

      const normalized = arr.map(normalizeExercise).filter(Boolean);

      if (!normalized.length) {
        setLessonExercises([]);
        setLoadError(
          `No exercises found. mode=${safeMode} lessonId=${lessonId}`,
        );
        return;
      }

      setLessonExercises(normalized);
    } catch (e) {
      console.error("[Practice] loadLessonBatch failed", e);
      setLoadError("Failed to load lesson exercises.");
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
      console.error("[Practice] loadRandomOne failed", e);
      setLoadError("Failed to load a random exercise.");
    } finally {
      setLoading(false);
    }
  }

  function initQuiz() {
    setAttempts(0);
    setStatus("idle");
    setShowHint(false);
    setWrongIndexes([]);
    setTypedAnswer("");

    // initialize by mode
    if (safeMode === "reorder") {
      const shuffled = [...(currentQuestion?.correctOrder || [])].sort(
        () => Math.random() - 0.5,
      );
      setTiles(shuffled);
      setAnswer([]);
    } else {
      setTiles([]);
      setAnswer([]);
    }
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

    // mode-specific resets
    setAnswer([]);
    setTiles([]);

    setCurrentIndex((prev) => prev + 1);
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
      const reshuffled = [...(currentQuestion?.correctOrder || [])].sort(
        () => Math.random() - 0.5,
      );
      setTiles(reshuffled);
    }
  }

  async function handleAudioRepeated() {
    // Audio is “self-attested”: user says they repeated it.
    setStatus("correct");
    setEarnedXP(150);
    setShowXPToast(true);
    setTimeout(() => setShowXPToast(false), 900);

    // ✅ Update progress (Audio)
    writeProgress(lessonId, "audio", {
      total: lessonExercises.length,
      completed: Math.min(lessonExercises.length, currentIndex + 1),
      updatedAt: Date.now(),
    });

    // ✅ Save session (Audio)
    localStorage.setItem(
      "fj_last_session",
      JSON.stringify({
        lessonId,
        mode: "audio",
        questionIndex: currentIndex + 1,
        timestamp: Date.now(),
      }),
    );

    // ✅ XP + completion bonus asynchronously (backend-safe)
    (async () => {
      try {
        await commitXP({
          isCorrect: true,
          attemptNo: 1,
          mode: xpMode, // audio counted as typing in backend
        });

        // Refresh /me so dashboard/leaderboard update immediately
        try {
          await api.get("/me");
        } catch {}
      } catch (e) {
        console.warn("[AUDIO] commitXP failed", e);
      }
    })();

    // ✅ Advance after short beat so user sees toast/banner
    setTimeout(() => {
      loadNextQuestion();
      setShowHint(false);
      setWrongIndexes([]);
      setTypedAnswer("");
      setStatus("idle");
      setFeedback("");
      setRevealEnglish(false);
    }, 700);
  }

  async function checkAnswer() {
    if (!currentQuestion) return;
    if (status === "correct") return;

    // ⌨️ TYPING validation
    if (safeMode === "typing") {
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
        currentQuestion.answer?.trim() ||
        (currentQuestion.correctOrder || []).join(" ");
      const user = typedAnswer;

      if (!normalize(user)) {
        setStatus("wrong");
        setShowHint(true);
        return;
      }

      const attemptNumber = attempts + 1;

      if (normalize(user) === normalize(target)) {
        correctSoundRef.current?.play?.();
        setStatus("correct");
        setWrongIndexes([]);

        // Run XP + completion bonus asynchronously
        (async () => {
          try {
            await commitXP({
              isCorrect: true,
              attemptNo: attemptNumber,
              mode: "typing",
            });
            const isLastQuestion =
              currentIndex >= (lessonExercises?.length || 0) - 1;
            if (isLastQuestion) {
              const bonus = await awardCompletionBonus("typing");
              setCompletionXp(bonus.awarded || 300);
              setCompletionMode("typing");
              setShowCompleteModal(true);
            }
          } catch (err) {
            console.error("[XP] typing commitXP/completion failed", err);
          }
        })();

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

        localStorage.setItem(
          "fj_last_session",
          JSON.stringify({
            lessonId,
            mode: "typing",
            questionIndex: currentIndex + 1,
            timestamp: Date.now(),
          }),
        );
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

      const expected = normalizeWord(cloze?.missingWord);
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

        // ✅ Cloze XP (UI)
        setEarnedXP(150);
        setShowXPToast(true);
        setTimeout(() => setShowXPToast(false), 900);

        console.log("[CLOZE] correct: set toast+xp", { xp: 150, safeMode });

        // ✅ SFX
        try {
          playCorrect?.();
        } catch {}

        // ✅ XP + completion bonus asynchronously (backend-safe)
        (async () => {
          try {
            await commitXP({
              isCorrect: true,
              attemptNo: attemptNumber,
              mode: xpMode, // ✅ cloze counted as typing in backend
            });

            const isLastQuestion =
              currentIndex >= (lessonExercises?.length || 0) - 1;

            if (isLastQuestion) {
              const bonus = await awardCompletionBonus(xpMode);
              setCompletionXp(bonus.awarded || 300);
              setCompletionMode("cloze"); // keep UI label as cloze
              setShowCompleteModal(true);
            }
          } catch (err) {
            console.error("[XP] cloze commitXP/completion failed", err);
          }
        })();

        // ✅ Update progress (Cloze)
        writeProgress(lessonId, "cloze", {
          total: lessonExercises.length,
          completed: Math.min(lessonExercises.length, currentIndex + 1),
          updatedAt: Date.now(),
        });

        // ✅ Save session (Cloze) — resume next question
        localStorage.setItem(
          "fj_last_session",
          JSON.stringify({
            lessonId,
            mode: "cloze",
            questionIndex: currentIndex + 1,
            timestamp: Date.now(),
          }),
        );

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
    if (answer.length !== currentQuestion.correctOrder.length) {
      setStatus("wrong");
      setShowHint(true);
      return;
    }

    const incorrect = [];
    answer.forEach((word, index) => {
      if (word !== currentQuestion.correctOrder[index]) incorrect.push(index);
    });

    if (incorrect.length === 0) {
      correctSoundRef.current?.play?.();
      const attemptNumber = attempts + 1;

      setWrongIndexes([]);
      setStatus("correct");

      // Run XP + completion bonus asynchronously (no await needed here)
      (async () => {
        try {
          await commitXP({
            isCorrect: true,
            attemptNo: attemptNumber,
            mode: "reorder",
          });

          const isLastQuestion =
            currentIndex >= (lessonExercises?.length || 0) - 1;

          if (isLastQuestion) {
            const bonus = await awardCompletionBonus("reorder");
            setCompletionXp(bonus.awarded || 300);
            setCompletionMode("reorder");
            setShowCompleteModal(true);
          }
        } catch (err) {
          console.error("[XP] reorder commitXP/completion failed", err);
        }
      })();

      // 🔊 Audio mode: auto-advance after correct
      // Audio “I repeated it” XP flow
      async function handleAudioRepeated() {
        if (!currentQuestion) return;
        if (status === "correct") return;

        // count audio as typing for backend XP economy
        const xpMode = "typing";
        const attemptNumber = attempts + 1;

        setStatus("correct");
        setFeedback("✅ Great! +150 XP");
        setEarnedXP(150);
        setShowXPToast(true);
        setTimeout(() => setShowXPToast(false), 900);

        try {
          playCorrect?.();
        } catch {}

        // XP + completion bonus (async)
        (async () => {
          try {
            await commitXP({
              isCorrect: true,
              attemptNo: attemptNumber,
              mode: xpMode,
            });

            const isLastQuestion =
              currentIndex >= (lessonExercises?.length || 0) - 1;

            if (isLastQuestion) {
              const bonus = await awardCompletionBonus(xpMode);
              setCompletionXp(bonus.awarded || 300);
              setCompletionMode("audio");
              setShowCompleteModal(true);
            }
          } catch (err) {
            console.error("[XP] audio commitXP/completion failed", err);
          }
        })();

        // ✅ Update progress (Audio)
        writeProgress(lessonId, "audio", {
          total: lessonExercises.length,
          completed: Math.min(lessonExercises.length, currentIndex + 1),
          updatedAt: Date.now(),
        });

        // ✅ Save session (Audio)
        localStorage.setItem(
          "fj_last_session",
          JSON.stringify({
            lessonId,
            mode: "audio",
            questionIndex: currentIndex + 1,
            timestamp: Date.now(),
          }),
        );

        // ✅ Advance so user sees toast/banner
        setTimeout(() => {
          loadNextQuestion();
          setRevealEnglish(false);
          setStatus("idle");
          setFeedback("");
          setShowHint(false);
        }, 700);
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

      localStorage.setItem(
        "fj_last_session",
        JSON.stringify({
          lessonId,
          mode: "reorder",
          questionIndex: currentIndex + 1,
          timestamp: Date.now(),
        }),
      );
      return;
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

  // -------------------
  // completion
  // -------------------
  if (totalQuestions > 0 && currentIndex >= totalQuestions) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">🎉 Session Complete!</h1>
        <p className="mb-4">Great job! You finished today’s practice.</p>

        <button
          className="bg-purple-600 text-white px-6 py-3 rounded-lg"
          onClick={() => {
            setCurrentIndex(0);
            setStatus("idle");
            loadLessonBatch(); // reload for another run
          }}
        >
          Practice Again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <div className="text-lg font-semibold">Loading practice…</div>
        <div className="text-sm text-slate-500 mt-2">Fetching exercises</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <div className="text-lg font-semibold text-red-600">{loadError}</div>
        <button
          className="mt-4 bg-purple-600 text-white px-5 py-2 rounded-lg"
          onClick={() => loadLessonBatch()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (
    !loading &&
    !loadError &&
    (!lessonExercises || lessonExercises.length === 0)
  ) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">No exercises found</h1>
        <p className="text-gray-600">
          This lesson doesn’t have practice items yet.
        </p>
        <button
          onClick={() => window.history.back()}
          className="mt-4 px-4 py-2 rounded-xl border hover:bg-gray-50"
        >
          Back
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">No questions found</h1>
        <p className="text-gray-600">Please reload.</p>
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
        {currentQuestion.tamil}
      </div>

      {/* Hint */}
      {showHint && status !== "correct" && (
        <div className="bg-purple-100 text-purple-800 p-3 rounded mb-4">
          💡 Hint: Subject → Verb → Action
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
      {safeMode === "typing" && (
        <div className="bg-white shadow-lg rounded-xl p-5 border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-purple-700">
              Typing Practice
            </h2>

            <button
              onClick={() => setTypedAnswer("")}
              className="text-xs px-3 py-1 rounded bg-slate-100 hover:bg-slate-200"
              disabled={status === "correct" || status === "reveal"}
            >
              Clear
            </button>
          </div>

          {/* Tamil prompt (what they should convert to English) */}
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-3">
            <div className="text-xs font-semibold text-purple-700 mb-1">
              Tamil prompt
            </div>
            <div className="text-sm text-slate-800">
              {currentQuestion.tamil}
            </div>
          </div>

          {/* Word Bank (hint only — not clickable) */}
          {safeMode === "typing" && (
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
      {safeMode === "audio" && (
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
              {currentQuestion?.tamil || "—"}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRevealEnglish((v) => !v)}
                className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
                disabled={!currentQuestion}
              >
                {revealEnglish ? "Hide English" : "Reveal English"}
              </button>

              <button
                type="button"
                onClick={() => speakTTS(englishFull)}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                disabled={!englishFull}
              >
                {isSpeaking ? "Speaking..." : "▶ Play"}
              </button>

              <button
                type="button"
                onClick={stopTTS}
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
                  min="0.8"
                  max="1.2"
                  step="0.05"
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
                  disabled={!currentQuestion || status === "correct"}
                >
                  I repeated it ✅
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
                    isWrong ? "bg-red-500 animate-shake" : "bg-blue-600"
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
              onClick={checkAnswer}
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
              {(currentQuestion?.correctOrder || []).map((word, index) => (
                <span key={index} className="px-3 py-1 bg-green-200 rounded">
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="text-xl font-semibold">✅ Lesson Completed!</div>
            <div className="mt-2 text-sm text-gray-600">
              You earned <span className="font-semibold">+{completionXp}</span>{" "}
              XP bonus.
            </div>

            <div className="mt-5 grid gap-2">
              <button
                className="w-full rounded-xl bg-black px-4 py-2 text-white"
                onClick={() => {
                  setShowCompleteModal(false);
                  const next = Number(lessonId) + 1;
                  window.location.href = `/practice/${completionMode}?lessonId=${next}`;
                }}
              >
                Next Lesson →
              </button>

              <button
                className="w-full rounded-xl border border-gray-300 px-4 py-2"
                onClick={() => {
                  setShowCompleteModal(false);
                  window.location.href = "/student/leaderboard";
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

      {/* ✅ Lesson completion modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="text-xl font-semibold">✅ Lesson Completed!</div>
            <div className="mt-2 text-sm text-gray-600">
              You earned <span className="font-semibold">+{completionXp}</span>{" "}
              XP bonus.
            </div>

            <div className="mt-5 grid gap-2">
              <button
                className="w-full rounded-xl bg-black px-4 py-2 text-white"
                onClick={() => {
                  setShowCompleteModal(false);
                  const next = Number(lessonId) + 1;
                  window.location.href = `/practice/${completionMode}?lessonId=${next}`;
                }}
              >
                Next Lesson →
              </button>

              <button
                className="w-full rounded-xl border border-gray-300 px-4 py-2"
                onClick={() => {
                  setShowCompleteModal(false);
                  window.location.href = "/student/leaderboard";
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

      {/* Shake animation */}
      <style>
        {`
          @keyframes shake {
            0% { transform: translateX(0); }
            25% { transform: translateX(-4px); }
            50% { transform: translateX(4px); }
            75% { transform: translateX(-4px); }
            100% { transform: translateX(0); }
          }
          .animate-shake {
            animation: shake 0.3s ease-in-out;
          }
        `}
      </style>
    </div>
  );
}
