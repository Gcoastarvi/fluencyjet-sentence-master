export function buildDay3({
  autoXpConfig,
  stageConfig,
  singleChoiceAnswer,
  tokenSequenceAnswer,
  option,
  DEFERRED_DAY3_REWARDS,
}) {
  return {
    dayNumber: 3,
    title: "My German Profile + First Goethe Experience",
    summary:
      "Combine Days 1–3 into a complete beginner profile and experience listening, reading, writing, and speaking in German.",

    activities: [
      // ------------------------------------------------------------
      // STAGE 1 — 3-DAY MEMORY CHECK
      // ------------------------------------------------------------

      {
        key: "memory-check-mcq",
        activityType: "MCQ",
        evaluationMode: "AUTO",
        title: "3-Day Memory Check — Quick Questions",
        orderIndex: 1,
        config: stageConfig({
          stageKey: "three-day-memory-check",
          stageTitle: "3-Day Memory Check",
          stageOrder: 1,
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "where-do-you-live-question",
            orderIndex: 1,
            prompt: {
              text: "Where do you live?",
              instruction: "Choose the appropriate German question.",
            },
            payload: {
              options: [
                option("option-a", "Woher kommen Sie?"),
                option("option-b", "Wo wohnen Sie?"),
                option("option-c", "Wie heißen Sie?"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
            feedback: {
              correct:
                "Wo wohnen Sie? asks where somebody lives.",
            },
          },
          {
            itemKey: "origin-meaning",
            orderIndex: 2,
            prompt: {
              text: "What does Ich komme aus Indien mean?",
            },
            payload: {
              options: [
                option("option-a", "I live in India"),
                option("option-b", "I come from India"),
                option("option-c", "I speak Indian"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
          },
        ],
      },

      {
        key: "memory-check-reorder",
        activityType: "REORDER",
        evaluationMode: "AUTO",
        title: "3-Day Memory Check — Build It",
        orderIndex: 2,
        config: stageConfig({
          stageKey: "three-day-memory-check",
          stageTitle: "3-Day Memory Check",
          stageOrder: 1,
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "review-profession",
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
            itemKey: "review-language",
            orderIndex: 2,
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
        ],
      },

      {
        key: "memory-check-listening",
        activityType: "LISTENING_MCQ",
        evaluationMode: "AUTO",
        title: "3-Day Memory Check — Number",
        orderIndex: 3,
        config: stageConfig({
          stageKey: "three-day-memory-check",
          stageTitle: "3-Day Memory Check",
          stageOrder: 1,
          extra: {
            assetStatus: "PLACEHOLDER",
          },
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "review-zwoelf",
            orderIndex: 1,
            prompt: {
              text: "Choose the number you hear.",
            },
            payload: {
              audioAssetKey: "de-a1-d3-memory-number-12",
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
        ],
      },

      // ------------------------------------------------------------
      // STAGE 2 — MY HOBBIES
      // ------------------------------------------------------------

      {
        key: "hobbies-mcq",
        activityType: "MCQ",
        evaluationMode: "AUTO",
        title: "My Hobbies — Recognize It",
        orderIndex: 4,
        config: stageConfig({
          stageKey: "my-hobbies",
          stageTitle: "My Hobbies",
          stageOrder: 2,
          extra: {
            assetStatus: "PLACEHOLDER",
          },
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "hobby-reading",
            orderIndex: 1,
            prompt: {
              text: "Choose the German activity.",
            },
            payload: {
              imageAssetKey: "de-a1-d3-hobby-reading",
              options: [
                option("option-a", "reisen"),
                option("option-b", "lesen"),
                option("option-c", "kochen"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
          },
          {
            itemKey: "hobby-swimming",
            orderIndex: 2,
            prompt: {
              text: "Choose the German activity.",
            },
            payload: {
              imageAssetKey: "de-a1-d3-hobby-swimming",
              options: [
                option("option-a", "schwimmen"),
                option("option-b", "spielen"),
                option("option-c", "lesen"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a"),
          },
          {
            itemKey: "hobby-question-response",
            orderIndex: 3,
            prompt: {
              text: "Was machen Sie gern?",
              instruction: "Choose an appropriate response.",
            },
            payload: {
              options: [
                option("option-a", "Ich wohne in Berlin."),
                option("option-b", "Ich lese gern."),
                option("option-c", "Ich komme aus Indien."),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
            feedback: {
              correct:
                "Was machen Sie gern? asks what you like doing.",
            },
          },
        ],
      },

      {
        key: "hobbies-reorder",
        activityType: "REORDER",
        evaluationMode: "AUTO",
        title: "My Hobbies — Build It",
        orderIndex: 5,
        config: stageConfig({
          stageKey: "my-hobbies",
          stageTitle: "My Hobbies",
          stageOrder: 2,
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "ich-lese-gern",
            orderIndex: 1,
            prompt: {
              text: "Build the German sentence.",
            },
            payload: {
              tokens: ["gern", "Ich", "lese"],
            },
            answerKey: tokenSequenceAnswer([
              "Ich",
              "lese",
              "gern",
            ]),
            feedback: {
              canonicalSentence: "Ich lese gern.",
            },
          },
          {
            itemKey: "ich-reise-gern",
            orderIndex: 2,
            prompt: {
              text: "Build the German sentence.",
            },
            payload: {
              tokens: ["reise", "gern", "Ich"],
            },
            answerKey: tokenSequenceAnswer([
              "Ich",
              "reise",
              "gern",
            ]),
            feedback: {
              canonicalSentence: "Ich reise gern.",
            },
          },
        ],
      },

      // ------------------------------------------------------------
      // STAGE 3 — MY FAMILY
      // ------------------------------------------------------------

      {
        key: "family-mcq",
        activityType: "MCQ",
        evaluationMode: "AUTO",
        title: "My Family — Recognize It",
        orderIndex: 6,
        config: stageConfig({
          stageKey: "my-family",
          stageTitle: "My Family",
          stageOrder: 3,
          extra: {
            assetStatus: "PLACEHOLDER",
          },
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "family-mother",
            orderIndex: 1,
            prompt: {
              text: "Choose the German word for mother.",
            },
            payload: {
              imageAssetKey: "de-a1-d3-family-mother",
              options: [
                option("option-a", "die Mutter"),
                option("option-b", "der Vater"),
                option("option-c", "die Schwester"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a"),
          },
          {
            itemKey: "family-sister",
            orderIndex: 2,
            prompt: {
              text: "Choose the German word for sister.",
            },
            payload: {
              imageAssetKey: "de-a1-d3-family-sister",
              options: [
                option("option-a", "der Bruder"),
                option("option-b", "die Schwester"),
                option("option-c", "die Mutter"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
          },
          {
            itemKey: "haben-sie-kinder",
            orderIndex: 3,
            prompt: {
              text: "Haben Sie Kinder?",
              instruction: "Choose an appropriate short response.",
            },
            payload: {
              options: [
                option("option-a", "Ja."),
                option("option-b", "Berlin."),
                option("option-c", "Englisch."),
              ],
            },
            answerKey: singleChoiceAnswer("option-a"),
          },
        ],
      },

      {
        key: "family-reorder",
        activityType: "REORDER",
        evaluationMode: "AUTO",
        title: "My Family — Build It",
        orderIndex: 7,
        config: stageConfig({
          stageKey: "my-family",
          stageTitle: "My Family",
          stageOrder: 3,
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "one-sister",
            orderIndex: 1,
            prompt: {
              text: "Build the German sentence.",
            },
            payload: {
              tokens: ["eine", "Schwester", "Ich", "habe"],
            },
            answerKey: tokenSequenceAnswer([
              "Ich",
              "habe",
              "eine",
              "Schwester",
            ]),
            feedback: {
              canonicalSentence: "Ich habe eine Schwester.",
            },
          },
          {
            itemKey: "two-children",
            orderIndex: 2,
            prompt: {
              text: "Build the German sentence.",
            },
            payload: {
              tokens: ["zwei", "Kinder", "habe", "Ich"],
            },
            answerKey: tokenSequenceAnswer([
              "Ich",
              "habe",
              "zwei",
              "Kinder",
            ]),
            feedback: {
              canonicalSentence: "Ich habe zwei Kinder.",
            },
          },
        ],
      },

      // ------------------------------------------------------------
      // STAGE 4 — HÖREN
      // ------------------------------------------------------------

      {
        key: "hoeren-mini-listening",
        activityType: "LISTENING_MCQ",
        evaluationMode: "AUTO",
        title: "Hören — First Mini Listening Challenge",
        orderIndex: 8,
        config: stageConfig({
          stageKey: "hoeren",
          stageTitle: "Hören — Mini Listening",
          stageOrder: 4,
          extra: {
            assetStatus: "PLACEHOLDER",
            mode: "LEARNING",
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
            itemKey: "sofia-origin",
            orderIndex: 1,
            prompt: {
              text: "Where does Sofia come from?",
            },
            payload: {
              audioAssetKey: "de-a1-d3-listening-01",
              options: [
                option("option-a", "Italy"),
                option("option-b", "Spain"),
                option("option-c", "Germany"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b", {
              audioTranscript:
                "Guten Tag. Ich heiße Sofia. Ich komme aus Spanien.",
            }),
          },
          {
            itemKey: "teacher-profession",
            orderIndex: 2,
            prompt: {
              text: "What is her profession?",
            },
            payload: {
              audioAssetKey: "de-a1-d3-listening-02",
              options: [
                option("option-a", "teacher"),
                option("option-b", "doctor"),
                option("option-c", "student"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a", {
              audioTranscript: "Ich bin Lehrerin.",
            }),
          },
          {
            itemKey: "swimming-hobby",
            orderIndex: 3,
            prompt: {
              text: "What does the speaker like doing?",
            },
            payload: {
              audioAssetKey: "de-a1-d3-listening-03",
              options: [
                option("option-a", "swimming"),
                option("option-b", "reading"),
                option("option-c", "cooking"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a", {
              audioTranscript: "Ich schwimme gern.",
            }),
          },
          {
            itemKey: "two-children-listening",
            orderIndex: 4,
            prompt: {
              text: "How many children does the speaker have?",
            },
            payload: {
              audioAssetKey: "de-a1-d3-listening-04",
              options: [
                option("option-a", "2"),
                option("option-b", "12"),
                option("option-c", "20"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a", {
              audioTranscript: "Ich habe zwei Kinder.",
            }),
          },
          {
            itemKey: "amir-hamburg",
            orderIndex: 5,
            prompt: {
              text: "Where does Amir live?",
            },
            payload: {
              audioAssetKey: "de-a1-d3-listening-05",
              options: [
                option("option-a", "Hamburg"),
                option("option-b", "Berlin"),
                option("option-c", "Bonn"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a", {
              audioTranscript:
                "Hallo. Ich heiße Amir. Ich wohne in Hamburg. Ich spreche Deutsch und Englisch.",
            }),
            feedback: {
              correct:
                "Correct. Listen for Ich wohne in Hamburg.",
              incorrect:
                "Listen again. Which phrase tells you where the person lives?",
            },
          },
        ],
      },

      // ------------------------------------------------------------
      // STAGE 5 — LESEN
      // ------------------------------------------------------------

      {
        key: "lesen-profile",
        activityType: "MCQ",
        evaluationMode: "AUTO",
        title: "Lesen — First Reading Challenge",
        orderIndex: 9,
        config: stageConfig({
          stageKey: "lesen",
          stageTitle: "Lesen — Mini Reading",
          stageOrder: 5,
          extra: {
            passage: [
              "Hallo!",
              "Ich heiße Lena.",
              "Ich komme aus Deutschland.",
              "Ich wohne in München.",
              "Ich spreche Deutsch und Englisch.",
              "Ich bin Studentin.",
              "Ich lese gern.",
              "Ich habe eine Schwester.",
            ],
          },
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "lena-origin",
            orderIndex: 1,
            prompt: {
              text: "Where does Lena come from?",
            },
            payload: {
              options: [
                option("option-a", "Deutschland"),
                option("option-b", "Österreich"),
                option("option-c", "Indien"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a"),
          },
          {
            itemKey: "lena-residence",
            orderIndex: 2,
            prompt: {
              text: "Where does Lena live?",
            },
            payload: {
              options: [
                option("option-a", "Berlin"),
                option("option-b", "München"),
                option("option-c", "Hamburg"),
              ],
            },
            answerKey: singleChoiceAnswer("option-b"),
          },
          {
            itemKey: "lena-profession",
            orderIndex: 3,
            prompt: {
              text: "What is Lena's profession/status?",
            },
            payload: {
              options: [
                option("option-a", "Studentin"),
                option("option-b", "Lehrerin"),
                option("option-c", "Ärztin"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a"),
          },
          {
            itemKey: "lena-hobby",
            orderIndex: 4,
            prompt: {
              text: "What does Lena like doing?",
            },
            payload: {
              options: [
                option("option-a", "lesen"),
                option("option-b", "reisen"),
                option("option-c", "schwimmen"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a"),
          },
          {
            itemKey: "lena-sister",
            orderIndex: 5,
            prompt: {
              text: "Does Lena have a sister?",
            },
            payload: {
              options: [
                option("option-a", "Ja"),
                option("option-b", "Nein"),
              ],
            },
            answerKey: singleChoiceAnswer("option-a"),
          },
        ],
      },

      // ------------------------------------------------------------
      // STAGE 6 — SCHREIBEN
      // ------------------------------------------------------------

      {
        key: "schreiben-profile",
        activityType: "GROUPED_FIELDS",
        evaluationMode: "SELF_ATTESTED",
        title: "Schreiben — My Profile",
        orderIndex: 10,
        config: stageConfig({
          stageKey: "schreiben",
          stageTitle: "Schreiben — My Profile",
          stageOrder: 6,
          extra: {
            scoringMode: "SELF_ATTESTED",
            aiEvaluation: false,
          },
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "my-written-profile",
            orderIndex: 1,
            prompt: {
              title: "Meine Daten",
              instruction:
                "Complete your personal information, then write the two short German sentences.",
            },
            payload: {
              fields: [
                {
                  key: "name",
                  label: "Name",
                  type: "TEXT",
                },
                {
                  key: "country",
                  label: "Land",
                  type: "TEXT",
                },
                {
                  key: "residence",
                  label: "Wohnort",
                  type: "TEXT",
                },
                {
                  key: "languages",
                  label: "Sprache(n)",
                  type: "TEXT",
                },
                {
                  key: "profession",
                  label: "Beruf",
                  type: "TEXT",
                },
                {
                  key: "hobby",
                  label: "Hobby",
                  type: "TEXT",
                },
              ],
              sentencePrompts: [
                {
                  key: "residenceSentence",
                  template: "Ich wohne in ______.",
                },
                {
                  key: "hobbySentence",
                  template: "Ich ______ gern.",
                },
              ],
              expectedSubmission: {
                completed: true,
                profile:
                  "Object containing learner-entered personal information.",
                sentences:
                  "Object containing the learner's two German sentences.",
              },
            },
          },
        ],
      },

      // ------------------------------------------------------------
      // STAGE 7 — SPRECHEN
      // ------------------------------------------------------------

      {
        key: "sprechen-profile",
        activityType: "SPEAKING_PROMPT",
        evaluationMode: "SELF_ATTESTED",
        title: "Sprechen — My First German Profile",
        orderIndex: 11,
        config: stageConfig({
          stageKey: "sprechen",
          stageTitle: "Sprechen — My First German Profile",
          stageOrder: 7,
          deferredRewards: DEFERRED_DAY3_REWARDS,
          extra: {
            rewardPolicyOwner: "DAY_3_AGGREGATES",
            aggregateRewardsStatus: "DEFERRED",
            scoringMode: "SELF_ATTESTED",
            pronunciationScoring: false,
            goethePositioning:
              "First Goethe-style speaking preview; not a claim of exam readiness.",
          },
        }),
        xpConfig: autoXpConfig(),
        items: [
          {
            itemKey: "complete-spoken-profile",
            orderIndex: 1,
            prompt: {
              title: "My First German Profile",
              instruction:
                "Use the cues one at a time and speak your own answers aloud.",
            },
            payload: {
              cues: [
                {
                  key: "name",
                  label: "Name?",
                  answerStarter: "Ich heiße ...",
                },
                {
                  key: "country",
                  label: "Land?",
                  answerStarter: "Ich komme aus ...",
                },
                {
                  key: "residence",
                  label: "Wohnort?",
                  answerStarter: "Ich wohne in ...",
                },
                {
                  key: "languages",
                  label: "Sprachen?",
                  answerStarter: "Ich spreche ...",
                },
                {
                  key: "profession",
                  label: "Beruf?",
                  answerStarter: "Ich bin ...",
                },
                {
                  key: "hobby",
                  label: "Hobby?",
                  answerStarter: "Ich ... gern.",
                },
                {
                  key: "family",
                  label: "Familie? (optional)",
                  answerStarter: "Ich habe ...",
                  optional: true,
                },
              ],
              optionalSpellingCheckpoint: {
                instruction:
                  "Buchstabieren Sie bitte Ihren Namen.",
              },
              expectedSubmission: {
                completed: true,
                neededHelp:
                  "Optional boolean preserved for later repair logic.",
              },
            },
          },
        ],
      },
    ],
  };
}
