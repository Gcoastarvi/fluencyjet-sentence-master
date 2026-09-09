import { buildDay2 } from "./cefrGermanA1/day2.js";
import { buildDay3 } from "./cefrGermanA1/day3.js";

const LANGUAGE = {
  code: "de",
  name: "German",
};

const PROGRAM = {
  slug: "german-a1",
  name: "German A1",
  cefrLevel: "A1",
};

const VERSION_KEY = "2026-v1";

const BASE_XP = Object.freeze({
  ruleVersion: "cefr-xp-v1",
  firstCorrect: 150,
  retryCorrect: 75,
  selfAttestedComplete: 100,
});

const FINAL_CHALLENGE_XP = Object.freeze({
  ...BASE_XP,

  // SELF_ATTESTED already awards +100.
  // +200 here preserves the trainer-approved +300 total.
  activityCompletion: 200,
});

const DEFERRED_DAY_REWARDS = Object.freeze({
  missionCompletion: 300,
  perfectFirstAttemptAccuracy: 300,
});

const DEFERRED_DAY3_REWARDS = Object.freeze({
  ...DEFERRED_DAY_REWARDS,
  fourSkillChallengeCompletion: 300,
  threeDayChallengeCompletion: 500,
});

function autoXpConfig() {
  return { ...BASE_XP };
}

function finalChallengeXpConfig() {
  return { ...FINAL_CHALLENGE_XP };
}

function stageConfig({
  stageKey,
  stageTitle,
  stageOrder,
  deferredRewards,
  extra = {},
}) {
  return {
    stageKey,
    stageTitle,
    stageOrder,
    ...(deferredRewards ? { deferredRewards } : {}),
    ...extra,
  };
}

function singleChoiceAnswer(correctOptionId, extra = {}) {
  return {
    type: "SINGLE_CHOICE",
    correctOptionId,
    ...extra,
  };
}

function tokenSequenceAnswer(tokens) {
  return {
    type: "TOKEN_SEQUENCE",
    tokens,
  };
}

function textAnswer(acceptedAnswers) {
  return {
    type: "TEXT",
    acceptedAnswers,
    normalization: {
      trim: true,
      collapseWhitespace: true,
      caseSensitive: false,
    },
  };
}

function option(id, label) {
  return { id, label };
}

function assertUnique(values, label) {
  const seen = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`);
    }

    seen.add(value);
  }
}

const DAY_1 = {
  dayNumber: 1,
  title: "My First German Conversation",
  summary:
    "Greet someone and introduce yourself with your name, country, residence, and languages.",
  activities: [
    {
      key: "quick-win-mcq",
      activityType: "MCQ",
      evaluationMode: "AUTO",
      title: "Quick Win",
      orderIndex: 1,
      config: stageConfig({
        stageKey: "quick-win",
        stageTitle: "Quick Win",
        stageOrder: 2,
        extra: {
          estimatedMinutes: 2,
        },
      }),
      xpConfig: autoXpConfig(),
      items: [
        {
          itemKey: "guten-tag-meaning",
          orderIndex: 1,
          prompt: {
            text: 'What does "Guten Tag" mean?',
          },
          payload: {
            options: [
              option("option-a", "Good night"),
              option("option-b", "Hello / Good day"),
              option("option-c", "Thank you"),
            ],
          },
          answerKey: singleChoiceAnswer("option-b"),
          feedback: {
            correct:
              "Correct! Guten Tag is a common daytime greeting.",
            incorrect:
              "Not quite. Guten Tag is used as a daytime greeting.",
          },
        },
        {
          itemKey: "guten-morgen-meaning",
          orderIndex: 2,
          prompt: {
            text: 'Which expression means "Good morning"?',
          },
          payload: {
            options: [
              option("option-a", "Guten Morgen"),
              option("option-b", "Guten Abend"),
              option("option-c", "Tschüss"),
            ],
          },
          answerKey: singleChoiceAnswer("option-a"),
          feedback: {
            correct: "Guten Morgen = Good morning.",
          },
        },
        {
          itemKey: "leaving-expression",
          orderIndex: 3,
          prompt: {
            text: "Which expression can you use when leaving?",
          },
          payload: {
            options: [
              option("option-a", "Ich heiße"),
              option("option-b", "Auf Wiedersehen"),
              option("option-c", "Guten Morgen"),
            ],
          },
          answerKey: singleChoiceAnswer("option-b"),
          feedback: {
            correct: "Auf Wiedersehen means goodbye.",
          },
        },
        {
          itemKey: "ich-heisse-meaning",
          orderIndex: 4,
          prompt: {
            text: 'What does "Ich heiße Priya" mean?',
          },
          payload: {
            options: [
              option("option-a", "I live in Priya"),
              option("option-b", "My name is Priya"),
              option("option-c", "I speak Priya"),
            ],
          },
          answerKey: singleChoiceAnswer("option-b"),
          feedback: {
            correct:
              "Ich heiße... is used to tell someone your name.",
          },
        },
        {
          itemKey: "ich-wohne-meaning",
          orderIndex: 5,
          prompt: {
            text: 'Which sentence means "I live in Chennai"?',
          },
          payload: {
            options: [
              option("option-a", "Ich komme aus Chennai."),
              option("option-b", "Ich wohne in Chennai."),
              option("option-c", "Ich spreche Chennai."),
            ],
          },
          answerKey: singleChoiceAnswer("option-b"),
          feedback: {
            correct:
              "Ich wohne in... tells someone where you live.",
          },
        },
      ],
    },

    {
      key: "build-it-reorder",
      activityType: "REORDER",
      evaluationMode: "AUTO",
      title: "Build It",
      orderIndex: 2,
      config: stageConfig({
        stageKey: "build-it",
        stageTitle: "Build It",
        stageOrder: 3,
        extra: {
          estimatedMinutes: 3,
        },
      }),
      xpConfig: autoXpConfig(),
      items: [
        {
          itemKey: "name-statement",
          orderIndex: 1,
          prompt: {
            text: "Build the German sentence.",
          },
          payload: {
            tokens: ["Priya", "heiße", "Ich"],
          },
          answerKey: tokenSequenceAnswer([
            "Ich",
            "heiße",
            "Priya",
          ]),
          feedback: {
            correct: "Ich heiße... = My name is...",
            canonicalSentence: "Ich heiße Priya.",
          },
        },
        {
          itemKey: "origin-statement",
          orderIndex: 2,
          prompt: {
            text: "Build the German sentence.",
          },
          payload: {
            tokens: ["aus", "Indien", "komme", "Ich"],
          },
          answerKey: tokenSequenceAnswer([
            "Ich",
            "komme",
            "aus",
            "Indien",
          ]),
          feedback: {
            correct: "Use aus with where you come from.",
            canonicalSentence: "Ich komme aus Indien.",
          },
        },
        {
          itemKey: "residence-statement",
          orderIndex: 3,
          prompt: {
            text: "Build the German sentence.",
          },
          payload: {
            tokens: ["wohne", "Chennai", "Ich", "in"],
          },
          answerKey: tokenSequenceAnswer([
            "Ich",
            "wohne",
            "in",
            "Chennai",
          ]),
          feedback: {
            correct: "wohnen in = to live in a place.",
            canonicalSentence: "Ich wohne in Chennai.",
          },
        },
        {
          itemKey: "language-statement",
          orderIndex: 4,
          prompt: {
            text: "Build the German sentence.",
          },
          payload: {
            tokens: ["Englisch", "spreche", "Ich"],
          },
          answerKey: tokenSequenceAnswer([
            "Ich",
            "spreche",
            "Englisch",
          ]),
          feedback: {
            canonicalSentence: "Ich spreche Englisch.",
          },
        },
        {
          itemKey: "name-question",
          orderIndex: 5,
          prompt: {
            text: "Build the German question.",
          },
          payload: {
            tokens: ["Sie", "heißen", "Wie"],
          },
          answerKey: tokenSequenceAnswer([
            "Wie",
            "heißen",
            "Sie",
          ]),
          feedback: {
            correct:
              "Wie heißen Sie? asks someone's name politely.",
            canonicalSentence: "Wie heißen Sie?",
          },
        },
        {
          itemKey: "residence-question",
          orderIndex: 6,
          prompt: {
            text: "Build the German question.",
          },
          payload: {
            tokens: ["wohnen", "Wo", "Sie"],
          },
          answerKey: tokenSequenceAnswer([
            "Wo",
            "wohnen",
            "Sie",
          ]),
          feedback: {
            correct: "Wo asks where.",
            canonicalSentence: "Wo wohnen Sie?",
          },
        },
      ],
    },

    {
      key: "hear-it-listening",
      activityType: "LISTENING_MCQ",
      evaluationMode: "AUTO",
      title: "Hear It",
      orderIndex: 3,
      config: stageConfig({
        stageKey: "hear-it",
        stageTitle: "Hear It",
        stageOrder: 4,
        extra: {
          estimatedMinutes: 3,
          assetStatus: "PLACEHOLDER",
          playbackPolicy: {
            firstPlayback: "NORMAL",
            freeReplayBeforeAnswer: 1,
            replayAfterWrongAnswer: 1,
          },
        },
      }),
      xpConfig: autoXpConfig(),
      items: [
        {
          itemKey: "nina-name",
          orderIndex: 1,
          prompt: {
            text: "What is her name?",
          },
          payload: {
            audioAssetKey: "de-a1-d1-listening-01",
            options: [
              option("option-a", "Nina"),
              option("option-b", "Lina"),
              option("option-c", "Anna"),
            ],
          },
          answerKey: singleChoiceAnswer("option-a", {
            audioTranscript: "Hallo. Ich heiße Nina.",
          }),
          feedback: {
            correct: "Listen for Ich heiße Nina.",
          },
        },
        {
          itemKey: "india-origin",
          orderIndex: 2,
          prompt: {
            text: "Where does the speaker come from?",
          },
          payload: {
            audioAssetKey: "de-a1-d1-listening-02",
            options: [
              option("option-a", "Germany"),
              option("option-b", "India"),
              option("option-c", "Austria"),
            ],
          },
          answerKey: singleChoiceAnswer("option-b", {
            audioTranscript:
              "Guten Tag. Ich komme aus Indien.",
          }),
          feedback: {
            correct:
              "Ich komme aus Indien = I come from India.",
          },
        },
        {
          itemKey: "berlin-residence",
          orderIndex: 3,
          prompt: {
            text: "Where does the speaker live?",
          },
          payload: {
            audioAssetKey: "de-a1-d1-listening-03",
            options: [
              option("option-a", "Berlin"),
              option("option-b", "Bonn"),
              option("option-c", "Hamburg"),
            ],
          },
          answerKey: singleChoiceAnswer("option-a", {
            audioTranscript: "Ich wohne in Berlin.",
          }),
        },
        {
          itemKey: "german-english-languages",
          orderIndex: 4,
          prompt: {
            text: "Which languages does the person speak?",
          },
          payload: {
            audioAssetKey: "de-a1-d1-listening-04",
            options: [
              option("option-a", "German and English"),
              option("option-b", "German and French"),
              option("option-c", "English and Spanish"),
            ],
          },
          answerKey: singleChoiceAnswer("option-a", {
            audioTranscript:
              "Ich spreche Deutsch und Englisch.",
          }),
        },
        {
          itemKey: "omar-hamburg",
          orderIndex: 5,
          prompt: {
            text: "Where does Omar live?",
          },
          payload: {
            audioAssetKey: "de-a1-d1-listening-05",
            options: [
              option("option-a", "Berlin"),
              option("option-b", "Hamburg"),
              option("option-c", "München"),
            ],
          },
          answerKey: singleChoiceAnswer("option-b", {
            audioTranscript:
              "Hallo. Ich heiße Omar. Ich wohne in Hamburg.",
          }),
        },
      ],
    },

    {
      key: "type-it",
      activityType: "TYPING",
      evaluationMode: "AUTO",
      title: "Type It",
      orderIndex: 4,
      config: stageConfig({
        stageKey: "type-it",
        stageTitle: "Type It",
        stageOrder: 5,
        extra: {
          estimatedMinutes: 3,
          typingPolicy: {
            capitalization: "SOFT_CORRECTION",
            finalPeriod: "OPTIONAL",
            multipleSpaces: "IGNORE",
          },
        },
      }),
      xpConfig: autoXpConfig(),
      items: [
        {
          itemKey: "type-name",
          orderIndex: 1,
          prompt: {
            text: "My name is Priya.",
          },
          answerKey: textAnswer([
            "Ich heiße Priya.",
            "Ich heiße Priya",
          ]),
        },
        {
          itemKey: "type-origin",
          orderIndex: 2,
          prompt: {
            text: "I come from India.",
          },
          answerKey: textAnswer([
            "Ich komme aus Indien.",
            "Ich komme aus Indien",
          ]),
          feedback: {
            commonErrors: [
              {
                submittedText: "Ich komme in Indien.",
                message:
                  "Use aus for where you come from: Ich komme aus Indien.",
              },
            ],
          },
        },
        {
          itemKey: "type-residence",
          orderIndex: 3,
          prompt: {
            text: "I live in Chennai.",
          },
          answerKey: textAnswer([
            "Ich wohne in Chennai.",
            "Ich wohne in Chennai",
          ]),
          feedback: {
            commonErrors: [
              {
                submittedText: "Ich wohnen in Chennai.",
                message:
                  "With ich, say: Ich wohne in Chennai.",
              },
            ],
          },
        },
        {
          itemKey: "type-languages",
          orderIndex: 4,
          prompt: {
            text: "I speak Tamil and English.",
          },
          answerKey: textAnswer([
            "Ich spreche Tamil und Englisch.",
            "Ich spreche Tamil und Englisch",
          ]),
        },
      ],
    },

    {
      key: "say-it",
      activityType: "AUDIO_REPEAT",
      evaluationMode: "SELF_ATTESTED",
      title: "Say It",
      orderIndex: 5,
      config: stageConfig({
        stageKey: "say-it",
        stageTitle: "Say It",
        stageOrder: 6,
        extra: {
          estimatedMinutes: 3,
          assetStatus: "PLACEHOLDER",
          scoringMode: "SELF_ATTESTED",
          pronunciationScoring: false,
        },
      }),
      xpConfig: autoXpConfig(),
      items: [
        {
          itemKey: "say-guten-tag",
          orderIndex: 1,
          prompt: {
            text: "Listen and repeat aloud.",
          },
          payload: {
            audioAssetKey: "de-a1-d1-repeat-01",
            modelText: "Guten Tag.",
          },
        },
        {
          itemKey: "say-name",
          orderIndex: 2,
          prompt: {
            text: "Listen and repeat aloud.",
          },
          payload: {
            audioAssetKey: "de-a1-d1-repeat-02",
            modelText: "Ich heiße Priya.",
            personalization:
              "Where possible, substitute your own name.",
          },
        },
        {
          itemKey: "say-origin",
          orderIndex: 3,
          prompt: {
            text: "Listen and repeat aloud.",
          },
          payload: {
            audioAssetKey: "de-a1-d1-repeat-03",
            modelText: "Ich komme aus Indien.",
            personalization:
              "Where possible, substitute your own country.",
          },
        },
        {
          itemKey: "say-residence",
          orderIndex: 4,
          prompt: {
            text: "Listen and repeat aloud.",
          },
          payload: {
            audioAssetKey: "de-a1-d1-repeat-04",
            modelText: "Ich wohne in Chennai.",
            personalization:
              "Where possible, substitute your own city.",
          },
        },
        {
          itemKey: "say-languages",
          orderIndex: 5,
          prompt: {
            text: "Listen and repeat aloud.",
          },
          payload: {
            audioAssetKey: "de-a1-d1-repeat-05",
            modelText: "Ich spreche Tamil und Englisch.",
            personalization:
              "Where possible, substitute your own languages.",
          },
        },
      ],
    },

    {
      key: "final-challenge",
      activityType: "FINAL_CHALLENGE",
      evaluationMode: "SELF_ATTESTED",
      title: "Your Turn",
      orderIndex: 6,
      config: stageConfig({
        stageKey: "final-challenge",
        stageTitle: "Your Turn",
        stageOrder: 7,
        deferredRewards: DEFERRED_DAY_REWARDS,
        extra: {
          estimatedMinutes: 2,
          rewardPolicyOwner: "DAY_1",
          scoringMode: "SELF_ATTESTED",
          pronunciationScoring: false,
        },
      }),
      xpConfig: finalChallengeXpConfig(),
      items: [
        {
          itemKey: "self-introduction",
          orderIndex: 1,
          prompt: {
            title: "Introduce yourself in German.",
            instruction:
              "Speak without looking at your class notes.",
          },
          payload: {
            cues: [
              "Name",
              "Country",
              "City",
              "Languages",
            ],
            hints: [
              "Ich ______...",
              "Ich heiße...",
            ],
            completionQuestion:
              "Were you able to say all four pieces of information?",
            completionOptions: [
              {
                id: "yes",
                label: "Yes",
              },
              {
                id: "needed-help",
                label: "I needed help",
              },
            ],
            expectedSubmission: {
              completed: true,
              neededHelp:
                "Optional boolean preserved for later repair logic.",
            },
          },
          answerKey: {
            postCompletionModel: [
              "Guten Tag.",
              "Ich heiße Priya.",
              "Ich komme aus Indien.",
              "Ich wohne in Chennai.",
              "Ich spreche Tamil und Englisch.",
            ],
          },
          hint: {
            first: "Ich ______...",
            second: "Ich heiße...",
          },
        },
      ],
    },
  ],
};

const DAY_2 = buildDay2({
  autoXpConfig,
  finalChallengeXpConfig,
  stageConfig,
  singleChoiceAnswer,
  tokenSequenceAnswer,
  textAnswer,
  option,
  DEFERRED_DAY_REWARDS,
});

const DAY_3 = buildDay3({
  autoXpConfig,
  stageConfig,
  singleChoiceAnswer,
  tokenSequenceAnswer,
  option,
  DEFERRED_DAY3_REWARDS,
});

const DAYS = [DAY_1, DAY_2, DAY_3];

// Curriculum content will be added in the next steps.
// No database write should occur until all three days pass validation.

export {
  LANGUAGE,
  PROGRAM,
  VERSION_KEY,
  BASE_XP,
  FINAL_CHALLENGE_XP,
  DEFERRED_DAY_REWARDS,
  DEFERRED_DAY3_REWARDS,
  DAYS,
  autoXpConfig,
  finalChallengeXpConfig,
  stageConfig,
  singleChoiceAnswer,
  tokenSequenceAnswer,
  textAnswer,
  option,
  assertUnique,
};
