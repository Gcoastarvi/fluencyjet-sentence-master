export function buildDay2({
  autoXpConfig,
  finalChallengeXpConfig,
  stageConfig,
  singleChoiceAnswer,
  tokenSequenceAnswer,
  textAnswer,
  option,
  DEFERRED_DAY_REWARDS,
}) {
  return {
    dayNumber: 2,
    title: "Personal Information & Numbers 1–20",
    summary:
      "Retrieve your Day 1 introduction, understand numbers 0–20, talk about your profession, and build a stronger German profile.",

    activities: [
      // ------------------------------------------------------------
      // STAGE 1 — YESTERDAY'S MEMORY CHECK
      // ------------------------------------------------------------

      {
        key: "memory-check-reorder",
        activityType: "REORDER",
        evaluationMode: "AUTO",
        title: "Yesterday's Memory Check — Build It",
        orderIndex: 1,
        config: stageConfig({
          stageKey: "yesterday-memory-check",
          stageTitle: "Yesterday's Memory Check",
          stageOrder: 1,
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "review-origin",
            orderIndex: 1,
            prompt: {
              text: "Build the German sentence.",
            },
            payload: {
              tokens: ["Indien", "komme", "Ich", "aus"],
            },
            answerKey: tokenSequenceAnswer([
              "Ich",
              "komme",
              "aus",
              "Indien",
            ]),
            feedback: {
              canonicalSentence: "Ich komme aus Indien.",
            },
          },
        ],
      },

      {
        key: "memory-check-typing",
        activityType: "TYPING",
        evaluationMode: "AUTO",
        title: "Yesterday's Memory Check — Type It",
        orderIndex: 2,
        config: stageConfig({
          stageKey: "yesterday-memory-check",
          stageTitle: "Yesterday's Memory Check",
          stageOrder: 1,
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "review-residence",
            orderIndex: 1,
            prompt: {
              text: "I live in Chennai.",
            },
            answerKey: textAnswer([
              "Ich wohne in Chennai.",
              "Ich wohne in Chennai",
            ]),
          },
        ],
      },

      {
        key: "memory-check-mcq",
        activityType: "MCQ",
        evaluationMode: "AUTO",
        title: "Yesterday's Memory Check — Quick Questions",
        orderIndex: 3,
        config: stageConfig({
          stageKey: "yesterday-memory-check",
          stageTitle: "Yesterday's Memory Check",
          stageOrder: 1,
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "review-wo-wohnen",
            orderIndex: 1,
            prompt: {
              text: '"Wo wohnen Sie?" asks:',
            },
            payload: {
              options: [
                option("option-a", "your name"),
                option("option-b", "where you live"),
                option("option-c", "your language"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
          },
          {
            itemKey: "review-name-response",
            orderIndex: 2,
            prompt: {
              text: "Wie heißen Sie?",
              instruction: "Select the correct response.",
            },
            payload: {
              options: [
                option("option-a", "Ich heiße Ravi."),
                option("option-b", "Ich wohne in Delhi."),
                option("option-c", "Ich spreche Tamil."),
              ],
            },
            answerKey: singleChoiceAnswer("option-a"),
          },
        ],
      },

      {
        key: "memory-check-listening",
        activityType: "LISTENING_MCQ",
        evaluationMode: "AUTO",
        title: "Yesterday's Memory Check — Listen",
        orderIndex: 4,
        config: stageConfig({
          stageKey: "yesterday-memory-check",
          stageTitle: "Yesterday's Memory Check",
          stageOrder: 1,
          extra: {
            assetStatus: "PLACEHOLDER",
          },
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "review-language-listening",
            orderIndex: 1,
            prompt: {
              text: "Which language does the speaker mention?",
            },
            payload: {
              audioAssetKey: "de-a1-d2-memory-listening-01",
              options: [
                option("option-a", "English"),
                option("option-b", "German"),
                option("option-c", "French"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a", {
              audioTranscript: "Ich spreche Englisch.",
            }),
          },
        ],
      },

      // ------------------------------------------------------------
      // STAGE 2 — NUMBER NINJA
      // ------------------------------------------------------------

      {
        key: "number-ninja",
        activityType: "MCQ",
        evaluationMode: "AUTO",
        title: "Number Ninja 0–20",
        orderIndex: 5,
        config: stageConfig({
          stageKey: "number-ninja",
          stageTitle: "Number Ninja 0–20",
          stageOrder: 2,
          extra: {
            scope: {
              minimum: 0,
              maximum: 20,
            },
          },
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "number-3",
            orderIndex: 1,
            prompt: {
              text: "German for 3?",
            },
            payload: {
              options: [
                option("option-a", "zwei"),
                option("option-b", "drei"),
                option("option-c", "vier"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
          },
          {
            itemKey: "number-8",
            orderIndex: 2,
            prompt: {
              text: "German for 8?",
            },
            payload: {
              options: [
                option("option-a", "sieben"),
                option("option-b", "acht"),
                option("option-c", "neun"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
          },
          {
            itemKey: "number-zwoelf",
            orderIndex: 3,
            prompt: {
              text: "zwölf = ?",
            },
            payload: {
              options: [
                option("option-a", "2"),
                option("option-b", "12"),
                option("option-c", "20"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
          },
          {
            itemKey: "number-fuenfzehn",
            orderIndex: 4,
            prompt: {
              text: "fünfzehn = ?",
            },
            payload: {
              options: [
                option("option-a", "5"),
                option("option-b", "14"),
                option("option-c", "15"),
              ],
            },
            answerKey: singleChoiceAnswer("option-c"),
          },
          {
            itemKey: "number-zwanzig",
            orderIndex: 5,
            prompt: {
              text: "zwanzig = ?",
            },
            payload: {
              options: [
                option("option-a", "12"),
                option("option-b", "19"),
                option("option-c", "20"),
              ],
            },
            answerKey: singleChoiceAnswer("option-c"),
          },
          {
            itemKey: "number-16-production",
            orderIndex: 6,
            prompt: {
              text: "16",
              instruction: "Choose the German number.",
            },
            payload: {
              options: [
                option("option-a", "sechs"),
                option("option-b", "sechzehn"),
                option("option-c", "siebzehn"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
          },
          {
            itemKey: "number-17-production",
            orderIndex: 7,
            prompt: {
              text: "17",
              instruction: "Choose the German number.",
            },
            payload: {
              options: [
                option("option-a", "sieben"),
                option("option-b", "siebzehn"),
                option("option-c", "sechzehn"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
          },
          {
            itemKey: "number-19-production",
            orderIndex: 8,
            prompt: {
              text: "19",
              instruction: "Choose the German number.",
            },
            payload: {
              options: [
                option("option-a", "neun"),
                option("option-b", "neunzehn"),
                option("option-c", "zwanzig"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
          },
        ],
      },

      // ------------------------------------------------------------
      // STAGE 3 — HEAR THE NUMBER
      // ------------------------------------------------------------

      {
        key: "hear-the-number",
        activityType: "LISTENING_MCQ",
        evaluationMode: "AUTO",
        title: "Hear the Number",
        orderIndex: 6,
        config: stageConfig({
          stageKey: "hear-the-number",
          stageTitle: "Hear the Number",
          stageOrder: 3,
          extra: {
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
            itemKey: "hear-sieben",
            orderIndex: 1,
            prompt: {
              text: "Choose the number you hear.",
            },
            payload: {
              audioAssetKey: "de-a1-d2-number-07",
              options: [
                option("option-a", "5"),
                option("option-b", "7"),
                option("option-c", "17"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b", {
              audioTranscript: "sieben",
            }),
            feedback: {
              correct: "sieben = 7",
            },
          },
          {
            itemKey: "hear-siebzehn",
            orderIndex: 2,
            prompt: {
              text: "Choose the number you hear.",
            },
            payload: {
              audioAssetKey: "de-a1-d2-number-17",
              options: [
                option("option-a", "6"),
                option("option-b", "7"),
                option("option-c", "17"),
              ],
            },
            answerKey: singleChoiceAnswer("option-c", {
              audioTranscript: "siebzehn",
            }),
            feedback: {
              correct: "siebzehn = 17",
              incorrect:
                "Listen to the ending -zehn. siebzehn = 17.",
            },
          },
          {
            itemKey: "hear-sechs",
            orderIndex: 3,
            prompt: {
              text: "Choose the number you hear.",
            },
            payload: {
              audioAssetKey: "de-a1-d2-number-06",
              options: [
                option("option-a", "6"),
                option("option-b", "16"),
                option("option-c", "10"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a", {
              audioTranscript: "sechs",
            }),
          },
          {
            itemKey: "hear-sechzehn",
            orderIndex: 4,
            prompt: {
              text: "Choose the number you hear.",
            },
            payload: {
              audioAssetKey: "de-a1-d2-number-16",
              options: [
                option("option-a", "6"),
                option("option-b", "16"),
                option("option-c", "17"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b", {
              audioTranscript: "sechzehn",
            }),
          },
          {
            itemKey: "hear-zwoelf",
            orderIndex: 5,
            prompt: {
              text: "Choose the number you hear.",
            },
            payload: {
              audioAssetKey: "de-a1-d2-number-12",
              options: [
                option("option-a", "2"),
                option("option-b", "12"),
                option("option-c", "20"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b", {
              audioTranscript: "zwölf",
            }),
          },
          {
            itemKey: "hear-zwanzig",
            orderIndex: 6,
            prompt: {
              text: "Choose the number you hear.",
            },
            payload: {
              audioAssetKey: "de-a1-d2-number-20",
              options: [
                option("option-a", "12"),
                option("option-b", "19"),
                option("option-c", "20"),
              ],
            },
            answerKey: singleChoiceAnswer("option-c", {
              audioTranscript: "zwanzig",
            }),
          },
        ],
      },

      // ------------------------------------------------------------
      // STAGE 4 — BERUF MATCH
      // ------------------------------------------------------------

      {
        key: "beruf-match",
        activityType: "MCQ",
        evaluationMode: "AUTO",
        title: "Beruf Match",
        orderIndex: 7,
        config: stageConfig({
          stageKey: "beruf-match",
          stageTitle: "Beruf Match",
          stageOrder: 4,
          extra: {
            assetStatus: "PLACEHOLDER",
          },
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "beruf-lehrer",
            orderIndex: 1,
            prompt: {
              text: "Was ist er von Beruf?",
            },
            payload: {
              imageAssetKey: "de-a1-d2-beruf-lehrer",
              options: [
                option("option-a", "Lehrer"),
                option("option-b", "Arzt"),
                option("option-c", "Fahrer"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a"),
          },
          {
            itemKey: "beruf-aerztin",
            orderIndex: 2,
            prompt: {
              text: "Was ist sie von Beruf?",
            },
            payload: {
              imageAssetKey: "de-a1-d2-beruf-aerztin",
              options: [
                option("option-a", "Ärztin"),
                option("option-b", "Lehrerin"),
                option("option-c", "Ingenieurin"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a"),
          },
          {
            itemKey: "beruf-student",
            orderIndex: 3,
            prompt: {
              text: "Was ist er von Beruf?",
            },
            payload: {
              imageAssetKey: "de-a1-d2-beruf-student",
              options: [
                option("option-a", "Techniker"),
                option("option-b", "Student"),
                option("option-c", "Manager"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
          },
          {
            itemKey: "beruf-ingenieurin",
            orderIndex: 4,
            prompt: {
              text: "Was ist sie von Beruf?",
            },
            payload: {
              imageAssetKey: "de-a1-d2-beruf-ingenieurin",
              options: [
                option("option-a", "Köchin"),
                option("option-b", "Verkäuferin"),
                option("option-c", "Ingenieurin"),
              ],
            },
            answerKey: singleChoiceAnswer("option-c"),
          },
          {
            itemKey: "beruf-fahrer",
            orderIndex: 5,
            prompt: {
              text: "Was ist er von Beruf?",
            },
            payload: {
              imageAssetKey: "de-a1-d2-beruf-fahrer",
              options: [
                option("option-a", "Fahrer"),
                option("option-b", "Koch"),
                option("option-c", "Lehrer"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a"),
          },
          {
            itemKey: "beruf-koechin",
            orderIndex: 6,
            prompt: {
              text: "Was ist sie von Beruf?",
            },
            payload: {
              imageAssetKey: "de-a1-d2-beruf-koechin",
              options: [
                option("option-a", "Managerin"),
                option("option-b", "Köchin"),
                option("option-c", "Studentin"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
          },
        ],
      },

      // ------------------------------------------------------------
      // STAGE 5 — BUILD IT
      // ------------------------------------------------------------

      {
        key: "build-it",
        activityType: "REORDER",
        evaluationMode: "AUTO",
        title: "Build It",
        orderIndex: 8,
        config: stageConfig({
          stageKey: "build-it",
          stageTitle: "Build It",
          stageOrder: 5,
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "ich-bin-lehrer",
            orderIndex: 1,
            prompt: {
              text: "Build the German sentence.",
            },
            payload: {
              tokens: ["bin", "Ich", "Lehrer"],
            },
            answerKey: tokenSequenceAnswer([
              "Ich",
              "bin",
              "Lehrer",
            ]),
            feedback: {
              canonicalSentence: "Ich bin Lehrer.",
            },
          },
          {
            itemKey: "profession-question",
            orderIndex: 2,
            prompt: {
              text: "Build the German question.",
            },
            payload: {
              tokens: ["Sie", "Beruf", "Was", "von", "sind"],
            },
            answerKey: tokenSequenceAnswer([
              "Was",
              "sind",
              "Sie",
              "von",
              "Beruf",
            ]),
            feedback: {
              canonicalSentence: "Was sind Sie von Beruf?",
            },
          },
          {
            itemKey: "ich-bin-ingenieurin",
            orderIndex: 3,
            prompt: {
              text: "Build the German sentence.",
            },
            payload: {
              tokens: ["Ingenieurin", "bin", "Ich"],
            },
            answerKey: tokenSequenceAnswer([
              "Ich",
              "bin",
              "Ingenieurin",
            ]),
            feedback: {
              canonicalSentence: "Ich bin Ingenieurin.",
            },
          },
          {
            itemKey: "sind-sie-lehrer",
            orderIndex: 4,
            prompt: {
              text: "Build the German question.",
            },
            payload: {
              tokens: ["Lehrer", "Sie", "Sind"],
            },
            answerKey: tokenSequenceAnswer([
              "Sind",
              "Sie",
              "Lehrer",
            ]),
            feedback: {
              canonicalSentence: "Sind Sie Lehrer?",
            },
          },
          {
            itemKey: "review-language",
            orderIndex: 5,
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
            itemKey: "review-residence-question",
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
              canonicalSentence: "Wo wohnen Sie?",
            },
          },
        ],
      },

      // ------------------------------------------------------------
      // STAGE 6 — TYPE IT
      // ------------------------------------------------------------

      {
        key: "type-it",
        activityType: "TYPING",
        evaluationMode: "AUTO",
        title: "Type It",
        orderIndex: 9,
        config: stageConfig({
          stageKey: "type-it",
          stageTitle: "Type It",
          stageOrder: 6,
          extra: {
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
            itemKey: "type-teacher",
            orderIndex: 1,
            prompt: {
              text: "I am a teacher.",
            },
            answerKey: textAnswer([
              "Ich bin Lehrer.",
              "Ich bin Lehrer",
            ]),
          },
          {
            itemKey: "type-student",
            orderIndex: 2,
            prompt: {
              text: "I am a student.",
            },
            answerKey: textAnswer([
              "Ich bin Student.",
              "Ich bin Student",
              "Ich bin Studentin.",
              "Ich bin Studentin",
            ]),
            feedback: {
              note:
                "Student or Studentin is accepted according to the learner's gender-appropriate form.",
            },
          },
          {
            itemKey: "type-profession-question",
            orderIndex: 3,
            prompt: {
              text: "What is your profession?",
            },
            answerKey: textAnswer([
              "Was sind Sie von Beruf?",
            ]),
            feedback: {
              commonErrors: [
                {
                  submittedText: "Was bin Sie von Beruf?",
                  message:
                    "With polite Sie, use: Was sind Sie von Beruf?",
                },
              ],
            },
          },
          {
            itemKey: "review-origin-typing",
            orderIndex: 4,
            prompt: {
              text: "I come from India.",
            },
            answerKey: textAnswer([
              "Ich komme aus Indien.",
              "Ich komme aus Indien",
            ]),
          },
        ],
      },

      // ------------------------------------------------------------
      // STAGE 7 — MINI INTERVIEW
      // ------------------------------------------------------------

      {
        key: "mini-interview",
        activityType: "SPEAKING_PROMPT",
        evaluationMode: "SELF_ATTESTED",
        title: "Mini Interview",
        orderIndex: 10,
        config: stageConfig({
          stageKey: "mini-interview",
          stageTitle: "Mini Interview",
          stageOrder: 7,
          extra: {
            scoringMode: "SELF_ATTESTED",
            pronunciationScoring: false,
          },
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "interview-name",
            orderIndex: 1,
            prompt: {
              text: "Wie heißen Sie?",
              instruction:
                "Answer aloud in German, then mark the item complete.",
            },
            payload: {
              answerStarter: "Ich heiße ...",
            },
          },
          {
            itemKey: "interview-origin",
            orderIndex: 2,
            prompt: {
              text: "Woher kommen Sie?",
              instruction:
                "Answer aloud in German, then mark the item complete.",
            },
            payload: {
              answerStarter: "Ich komme aus ...",
            },
          },
          {
            itemKey: "interview-residence",
            orderIndex: 3,
            prompt: {
              text: "Wo wohnen Sie?",
              instruction:
                "Answer aloud in German, then mark the item complete.",
            },
            payload: {
              answerStarter: "Ich wohne in ...",
            },
          },
          {
            itemKey: "interview-languages",
            orderIndex: 4,
            prompt: {
              text: "Welche Sprachen sprechen Sie?",
              instruction:
                "Answer aloud in German, then mark the item complete.",
            },
            payload: {
              answerStarter: "Ich spreche ...",
            },
          },
          {
            itemKey: "interview-profession",
            orderIndex: 5,
            prompt: {
              text: "Was sind Sie von Beruf?",
              instruction:
                "Answer aloud in German, then mark the item complete.",
            },
            payload: {
              answerStarter: "Ich bin ...",
            },
          },
        ],
      },

      // ------------------------------------------------------------
      // STAGE 8 — FINAL CHALLENGE: NUMBER CHECK
      // ------------------------------------------------------------

      {
        key: "final-number-check",
        activityType: "LISTENING_MCQ",
        evaluationMode: "AUTO",
        title: "Final Challenge — Number Check",
        orderIndex: 11,
        config: stageConfig({
          stageKey: "final-challenge",
          stageTitle: "My German Profile — Level 2",
          stageOrder: 8,
          extra: {
            assetStatus: "PLACEHOLDER",
          },
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "final-number-five",
            orderIndex: 1,
            prompt: {
              text: "Choose the number you hear.",
            },
            payload: {
              audioAssetKey: "de-a1-d2-final-number-05",
              options: [
                option("option-a", "5"),
                option("option-b", "15"),
                option("option-c", "8"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a", {
              audioTranscript: "fünf",
            }),
          },
          {
            itemKey: "final-number-twelve",
            orderIndex: 2,
            prompt: {
              text: "Choose the number you hear.",
            },
            payload: {
              audioAssetKey: "de-a1-d2-final-number-12",
              options: [
                option("option-a", "2"),
                option("option-b", "12"),
                option("option-c", "20"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b", {
              audioTranscript: "zwölf",
            }),
          },
          {
            itemKey: "final-number-eighteen",
            orderIndex: 3,
            prompt: {
              text: "Choose the number you hear.",
            },
            payload: {
              audioAssetKey: "de-a1-d2-final-number-18",
              options: [
                option("option-a", "8"),
                option("option-b", "18"),
                option("option-c", "20"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b", {
              audioTranscript: "achtzehn",
            }),
          },
        ],
      },

      // ------------------------------------------------------------
      // STAGE 8 — FINAL CHALLENGE: PROFILE
      // ------------------------------------------------------------

      {
        key: "final-profile",
        activityType: "FINAL_CHALLENGE",
        evaluationMode: "SELF_ATTESTED",
        title: "My German Profile — Level 2",
        orderIndex: 12,
        config: stageConfig({
          stageKey: "final-challenge",
          stageTitle: "My German Profile — Level 2",
          stageOrder: 8,
          deferredRewards: DEFERRED_DAY_REWARDS,
          extra: {
            rewardPolicyOwner: "DAY_2",
            scoringMode: "SELF_ATTESTED",
            pronunciationScoring: false,
          },
        }),
        xpConfig: finalChallengeXpConfig(),
        items: [
          {
            itemKey: "complete-profile",
            orderIndex: 1,
            prompt: {
              title: "Give your German profile.",
              instruction:
                "Speak without reading complete model sentences.",
            },
            payload: {
              cues: [
                "Name",
                "Country",
                "City",
                "Languages",
                "Profession",
              ],
              answerStarters: [
                "Ich heiße ...",
                "Ich komme aus ...",
                "Ich wohne in ...",
                "Ich spreche ...",
                "Ich bin ...",
              ],
              expectedSubmission: {
                completed: true,
                neededHelp:
                  "Optional boolean preserved for later repair logic.",
              },
            },
            answerKey: {
              postCompletionModel: [
                "Ich heiße Priya.",
                "Ich komme aus Indien.",
                "Ich wohne in Chennai.",
                "Ich spreche Tamil und Englisch.",
                "Ich bin Ingenieurin.",
              ],
            },
          },
        ],
      },
    ],
  };
}
