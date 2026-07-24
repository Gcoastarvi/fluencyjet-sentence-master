// client/src/pages/public/SpokenEnglishChallenge.jsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./SpokenEnglishChallenge.css";
import ReorderExerciseCard from "@/components/practice/ReorderExerciseCard";

const XP_PER_SENTENCE = 150;
const STORAGE_KEY = "fj_guest_challenge_v1";

const QUESTIONS = [
  {
    id: "challenge-1",
    tamil: "நான் ஒரு ஆசிரியர்.",
    answer: "I am a teacher",
    words: ["a", "teacher", "I", "am"],
  },
  {
    id: "challenge-2",
    tamil: "நான் தினமும் ஆங்கிலம் பயிற்சி செய்கிறேன்.",
    answer: "I practice English every day",
    words: ["English", "every", "I", "day", "practice"],
  },
  {
    id: "challenge-3",
    tamil: "அவள் இப்போது வேலை செய்கிறாள்.",
    answer: "She is working now",
    words: ["now", "working", "She", "is"],
  },
  {
    id: "challenge-4",
    tamil: "எனக்கு ஆங்கிலம் பேச வேண்டும்.",
    answer: "I want to speak English",
    words: ["speak", "want", "English", "to", "I"],
  },
  {
    id: "challenge-5",
    tamil: "நான் என் திறமைகளை மேம்படுத்த முயற்சி செய்கிறேன்.",
    answer: "I am trying to improve my skills",
    words: ["skills", "trying", "my", "I", "am", "improve", "to"],
  },
  {
    id: "challenge-6",
    tamil: "நாங்கள் இன்று வகுப்பில் இருக்கிறோம்.",
    answer: "We are in class today",
    words: ["today", "class", "are", "We", "in"],
  },
  {
    id: "challenge-7",
    tamil: "அவர் நேற்று என்னை அழைத்தார்.",
    answer: "He called me yesterday",
    words: ["me", "yesterday", "called", "He"],
  },
];

const CHALLENGE_ACCENT = {
  bar: "bg-indigo-500",
  border: "border-indigo-200",
  soft: "bg-indigo-50",
  text: "text-indigo-700",
};

function shuffleArray(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function createTokens(words, questionId) {
  return words.map((text, index) => ({
    id: `${questionId}-${index}`,
    text,
  }));
}

function normaliseSentence(sentence) {
  return sentence
    .toLowerCase()
    .replace(/[.,!?'"’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createAttemptId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function trackEvent(eventName, parameters = {}) {
  try {
    if (typeof window.fbq === "function") {
      window.fbq("trackCustom", eventName, parameters);
    }

    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, parameters);
    }
  } catch (error) {
    console.warn("Challenge tracking failed:", error);
  }
}

export default function SpokenEnglishChallenge() {
  const navigate = useNavigate();
  const challengeStartedRef = useRef(false);

  const advanceTimerRef = useRef(null);
  const correctSoundRef = useRef(null);

  const [xpFlash, setXpFlash] = useState(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [xpToastId, setXpToastId] = useState(0);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [availableWords, setAvailableWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState([]);

  const [attempts, setAttempts] = useState(0);
  const [firstTryScore, setFirstTryScore] = useState(0);
  const [completedSentences, setCompletedSentences] = useState(0);
  const [answerHistory, setAnswerHistory] = useState([]);

  const [feedback, setFeedback] = useState(null);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [result, setResult] = useState(null);

  const [startedAt] = useState(() => Date.now());

  const currentQuestion = QUESTIONS[questionIndex];
  const totalQuestions = QUESTIONS.length;
  const currentXp = completedSentences * XP_PER_SENTENCE;

  const challengeStatus = answerLocked
    ? "correct"
    : feedback?.type === "error"
      ? "wrong"
      : "idle";

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentQuestion) return;

    const tokens = createTokens(currentQuestion.words, currentQuestion.id);

    setAvailableWords(shuffleArray(tokens));
    setSelectedWords([]);
    setAttempts(0);
    setFeedback(null);
    setAnswerLocked(false);
    setXpFlash(null);
    setIsAdvancing(false);
  }, [questionIndex, currentQuestion]);

  useEffect(() => {
    const audio = new Audio("/sounds/correct.mp3");

    audio.preload = "auto";
    audio.volume = 0.65;

    correctSoundRef.current = audio;

    return () => {
      audio.pause();
      correctSoundRef.current = null;
    };
  }, []);

  function markChallengeStarted() {
    if (challengeStartedRef.current) return;

    challengeStartedRef.current = true;

    trackEvent("GuestChallengeStarted", {
      challenge_name: "Spoken English Challenge",
      total_questions: totalQuestions,
    });
  }

  function selectWord(token) {
    if (answerLocked) return;

    markChallengeStarted();

    setAvailableWords((previous) =>
      previous.filter((word) => word.id !== token.id),
    );

    setSelectedWords((previous) => [...previous, token]);
    setFeedback(null);
  }

  function removeSelectedWord(token) {
    if (answerLocked) return;

    markChallengeStarted();

    setSelectedWords((previous) =>
      previous.filter((word) => word.id !== token.id),
    );

    setAvailableWords((previous) => [...previous, token]);
    setFeedback(null);
  }

  function playCorrectSound() {
    const audio = correctSoundRef.current;

    if (!audio) return;

    try {
      audio.currentTime = 0;

      const playPromise = audio.play();

      if (playPromise?.catch) {
        playPromise.catch(() => {
          // Some browsers may block audio until user interaction.
        });
      }
    } catch (error) {
      console.warn("Unable to play correct-answer sound:", error);
    }
  }

  function clearSentence() {
    if (answerLocked) return;

    setAvailableWords((previous) =>
      shuffleArray([...previous, ...selectedWords]),
    );

    setSelectedWords([]);
    setFeedback(null);
  }

  function checkAnswer() {
    if (answerLocked || selectedWords.length !== currentQuestion.words.length) {
      return;
    }

    markChallengeStarted();

    const constructedSentence = selectedWords
      .map((word) => word.text)
      .join(" ");

    const nextAttemptCount = attempts + 1;
    const isCorrect =
      normaliseSentence(constructedSentence) ===
      normaliseSentence(currentQuestion.answer);

    setAttempts(nextAttemptCount);

    if (!isCorrect) {
      setFeedback({
        type: "error",
        message: "Not quite right. Rearrange the words and try again.",
      });

      return;
    }

    const wasCorrectOnFirstTry = nextAttemptCount === 1;

    const nextFirstTryScore = firstTryScore + (wasCorrectOnFirstTry ? 1 : 0);

    const nextCompletedSentences = completedSentences + 1;

    const nextAnswerHistory = [
      ...answerHistory,
      {
        exerciseId: currentQuestion.id,
        submittedAnswer: constructedSentence,
        correctAnswer: currentQuestion.answer,
        attempts: nextAttemptCount,
        firstTryCorrect: wasCorrectOnFirstTry,
      },
    ];

    setFirstTryScore(nextFirstTryScore);
    setCompletedSentences(nextCompletedSentences);
    setAnswerHistory(nextAnswerHistory);
    setAnswerLocked(true);

    setFeedback(null);

    playCorrectSound();

    setXpToastId((previous) => previous + 1);
    setXpFlash(XP_PER_SENTENCE);
    setIsAdvancing(true);

    advanceTimerRef.current = window.setTimeout(() => {
      if (questionIndex === totalQuestions - 1) {
        completeChallenge({
          nextFirstTryScore,
          nextCompletedSentences,
          nextAnswerHistory,
        });

        return;
      }

      setQuestionIndex((previous) => previous + 1);
    }, 850);
  }

  function completeChallenge({
    nextFirstTryScore,
    nextCompletedSentences,
    nextAnswerHistory,
  }) {
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - startedAt) / 1000),
    );

    const accuracy = Math.round((nextFirstTryScore / totalQuestions) * 100);

    const challengeResult = {
      attemptId: createAttemptId(),
      challengeId: "spoken-english-challenge-v1",
      score: nextFirstTryScore,
      totalQuestions,
      firstTryAccuracy: accuracy,
      completedSentences: nextCompletedSentences,
      xp: nextCompletedSentences * XP_PER_SENTENCE,
      durationSeconds,
      answers: nextAnswerHistory,
      completedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(challengeResult));
    } catch (error) {
      console.warn("Could not save guest challenge:", error);
    }

    setResult(challengeResult);

    trackEvent("GuestChallengeCompleted", {
      score: challengeResult.score,
      total_questions: challengeResult.totalQuestions,
      accuracy: challengeResult.firstTryAccuracy,
      xp: challengeResult.xp,
      duration_seconds: challengeResult.durationSeconds,
    });
  }

  function continueToSignup() {
    trackEvent("GuestChallengeSignupClicked", {
      score: result?.score || 0,
      xp: result?.xp || 0,
    });

    const nextPath = encodeURIComponent("/quick-start");

    navigate(
      `/try-spoken-english-gym?source=spoken-english-challenge&next=${nextPath}#signup`,
    );
  }

  const progressPercentage = result
    ? 100
    : Math.round((completedSentences / totalQuestions) * 100);

  if (result) {
    return (
      <main className="sec-page">
        <section className="sec-result-section">
          <div className="sec-result-card">
            <div className="sec-result-icon">🏆</div>

            <p className="sec-eyebrow">CHALLENGE COMPLETED</p>

            <h1>You completed your first English workout!</h1>

            <p className="sec-result-intro">
              Your temporary result is ready. Create your free FluencyJet
              account to save your XP and continue practising.
            </p>

            <div className="sec-result-grid">
              <div className="sec-result-stat">
                <strong>
                  {result.score}/{result.totalQuestions}
                </strong>
                <span>Correct on first try</span>
              </div>

              <div className="sec-result-stat">
                <strong>{result.firstTryAccuracy}%</strong>
                <span>First-try accuracy</span>
              </div>

              <div className="sec-result-stat sec-xp-stat">
                <strong>{result.xp.toLocaleString("en-IN")}</strong>
                <span>Challenge XP earned</span>
              </div>
            </div>

            <div className="sec-save-box">
              <div>
                <span className="sec-save-label">Your XP is waiting</span>
                <strong>
                  Save {result.xp.toLocaleString("en-IN")} XP and unlock your
                  complete first workout.
                </strong>
              </div>
            </div>

            <button
              type="button"
              className="sec-primary-button"
              onClick={continueToSignup}
            >
              Save My XP &amp; Continue
            </button>

            <p className="sec-button-note">
              Free account · No payment · No card required
            </p>

            <Link className="sec-login-link" to="/login?next=/quick-start">
              Already have an account? Sign in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="sec-page">
      <section className="sec-hero">
        <div className="sec-hero-content">
          <div className="sec-hero-copy">
            <p className="sec-eyebrow">FREE 3-MINUTE ENGLISH CHALLENGE</p>

            <h1>
              Can You Build <span>7 Correct English Sentences?</span>
            </h1>

            <p className="sec-hero-description">
              Arrange the words, test your sentence-making ability and earn your
              first FluencyJet XP.
            </p>

            <a
              className="sec-primary-button sec-hero-button"
              href="#challenge"
              onClick={markChallengeStarted}
            >
              Start My Sentence Challenge
            </a>

            <div className="sec-trust-row">
              <span>✓ No payment</span>
              <span>✓ No card</span>
              <span>✓ Instant result</span>
            </div>
          </div>

          <div className="sec-hero-preview">
            <span className="sec-preview-label">YOUR FIRST WORKOUT</span>

            <div className="sec-preview-number">7</div>
            <strong>Useful English sentences</strong>
            <p>Reorder the words and build each sentence correctly.</p>

            <div className="sec-preview-xp">Up to 1,050 Challenge XP</div>
          </div>
        </div>
      </section>

      <section className="sec-challenge-section" id="challenge">
        <div className="sec-challenge-shell">
          <div className="sec-progress-header">
            <div>
              <span className="sec-progress-label">
                Sentence {questionIndex + 1} of {totalQuestions}
              </span>

              <strong>{currentXp.toLocaleString("en-IN")} XP earned</strong>
            </div>

            <span className="sec-progress-count">{progressPercentage}%</span>
          </div>

          <div className="sec-progress-track">
            <div
              className="sec-progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {xpFlash !== null && (
            <div
              key={xpToastId}
              className="sec-xp-flash"
              role="status"
              aria-live="polite"
            >
              +{xpFlash} XP ✨
            </div>
          )}

          {/* Tamil prompt stays outside and above the shared Reorder card */}
          <div className="mb-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
            <p className="mb-3 text-sm font-bold text-slate-500">
              Tamil prompt
            </p>

            <div className="rounded-2xl bg-slate-50 px-5 py-5 text-2xl font-black leading-relaxed text-slate-950 sm:text-3xl">
              {currentQuestion.tamil}
            </div>
          </div>

          <ReorderExerciseCard
            title="Quick English"
            subtitle="Build the English sentence"
            answer={selectedWords}
            tiles={availableWords}
            status={challengeStatus}
            accent={CHALLENGE_ACCENT}
            onTileClick={selectWord}
            onAnswerClick={removeSelectedWord}
            disabled={isAdvancing}
            footer={
              <>
                <div className="sec-actions">
                  <button
                    type="button"
                    className="sec-secondary-button"
                    onClick={clearSentence}
                    disabled={
                      selectedWords.length === 0 || answerLocked || isAdvancing
                    }
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    className="sec-primary-button"
                    onClick={checkAnswer}
                    disabled={
                      answerLocked ||
                      isAdvancing ||
                      selectedWords.length !== currentQuestion.words.length
                    }
                  >
                    {isAdvancing ? "Loading Next Sentence..." : "Check Answer"}
                  </button>
                </div>

                <p className="sec-question-note">
                  Your first-attempt score and XP will be shown after all seven
                  sentences.
                </p>
              </>
            }
          />
        </div>
      </section>

      <section className="sec-explanation">
        <p className="sec-eyebrow">WHY THIS MATTERS</p>

        <h2>Knowing English is different from building sentences quickly.</h2>

        <p>
          FluencyJet helps you practise sentence formation repeatedly through
          Reorder, Typing, Audio Repeat and Dictation.
        </p>
      </section>
    </main>
  );
}
