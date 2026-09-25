export const schoolFoundationFormA = {
  assessmentId: "study_recall_benchmark",
  trackId: "school_foundation",
  form: "A",
  version: 1,

  modules: [
    {
      id: "immediate",
      domain: "Immediate Recall",
      order: 1,
      weight: 20,

      studySeconds: 30,
      recallSeconds: 60,

      instructions: {
        study:
          "Study the 10 items carefully. They will disappear when the timer ends.",
        recall:
          "Type as many items as you can remember. The order does not matter.",
      },

      items: [
        { id: "bicycle", label: "Bicycle" },
        { id: "candle", label: "Candle" },
        { id: "tiger", label: "Tiger" },
        { id: "spoon", label: "Spoon" },
        { id: "kite", label: "Kite" },
        { id: "key", label: "Key" },
        { id: "mountain", label: "Mountain" },
        { id: "bottle", label: "Bottle" },
        { id: "crown", label: "Crown" },
        { id: "clock", label: "Clock" },
      ],

      scoring: {
        type: "concept_recall",
        maxRaw: 10,
        maxWeighted: 20,
        duplicateCredit: false,
        spellingTolerance: "minor",
      },
    },

    {
      id: "ordered",
      domain: "Ordered Recall",
      order: 2,
      weight: 15,

      studySeconds: 20,
      recallSeconds: 40,

      instructions: {
        study:
          "Study these 6 items in order. Try to remember the exact sequence.",
        recall:
          "Arrange the shuffled cards into the same order you studied.",
      },

      items: [
        { id: "book", label: "Book" },
        { id: "fish", label: "Fish" },
        { id: "star", label: "Star" },
        { id: "bus", label: "Bus" },
        { id: "leaf", label: "Leaf" },
        { id: "cup", label: "Cup" },
      ],

      correctOrder: [
        "book",
        "fish",
        "star",
        "bus",
        "leaf",
        "cup",
      ],

      // Fixed shuffled order keeps Form A reproducible for QA and scoring.
      recallOrder: [
        "star",
        "cup",
        "book",
        "leaf",
        "fish",
        "bus",
      ],

      scoring: {
        type: "exact_position",
        maxRaw: 6,
        maxWeighted: 15,
      },
    },

    {
      id: "association",
      domain: "Association Recall",
      order: 3,
      weight: 20,

      studySeconds: 40,
      recallSeconds: 45,

      instructions: {
        study:
          "Study each word-number pair carefully. Try to remember which number belongs to each word.",
        recall:
          "Enter the number that was paired with each word. The prompts will appear in a different order.",
      },

      pairs: [
        { id: "rocket", prompt: "Rocket", answer: "24" },
        { id: "umbrella", prompt: "Umbrella", answer: "57" },
        { id: "guitar", prompt: "Guitar", answer: "31" },
        { id: "apple", prompt: "Apple", answer: "68" },
        { id: "boat", prompt: "Boat", answer: "42" },
      ],

      recallOrder: [
        "apple",
        "rocket",
        "boat",
        "umbrella",
        "guitar",
      ],

      scoring: {
        type: "association_exact",
        maxRaw: 5,
        maxWeighted: 20,
        pointsPerCorrect: 4,
      },
    },

    {
      id: "academic",
      domain: "Academic Recall",
      order: 4,
      weight: 25,

      studySeconds: 60,

      title: "The Nivara Bird",

      passage:
        "The Nivara bird lives near cool mountain lakes. It builds its nest from a soft grass called velin, which grows close to the water. A Nivara pair usually lays three eggs in July. The birds eat small insects, red berries, and lake seeds. During the hottest part of the day, they rest under low rocks. In October, they leave the mountain lakes and travel south in small groups. They return in February, when the weather becomes cooler. Young birds remain with their parents for about four months before finding food on their own.",

      questions: [
        {
          id: "habitat",
          prompt: "Where does the Nivara bird live?",
        },
        {
          id: "grass",
          prompt: "What is the special grass called?",
        },
        {
          id: "eggs",
          prompt: "How many eggs does a pair usually lay?",
        },
        {
          id: "leave_month",
          prompt: "In which month do they leave the mountain lakes?",
        },
        {
          id: "parent_duration",
          prompt: "About how long do young birds remain with their parents?",
        },
      ],

      scoring: {
        type: "academic_question_recall",
        maxRaw: 5,
        maxWeighted: 25,
        pointsPerCorrect: 5,
      },
    },

    {
      id: "delayed",
      domain: "Delayed Recall",
      order: 5,
      weight: 20,

      recallSeconds: 60,

      // Reuse the ORIGINAL Immediate Recall items.
      // Do not expose them again before recall.
      sourceModuleId: "immediate",

      instructions: {
        recall:
          "Without looking back, enter as many of the original items from Part 1 as you can remember.",
      },

      scoring: {
        type: "delayed_concept_recall",
        maxRaw: 10,
        maxWeighted: 20,
        duplicateCredit: false,
        spellingTolerance: "minor",
      },
    },
  ],
};

export default schoolFoundationFormA;
