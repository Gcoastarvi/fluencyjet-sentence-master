export const schoolAdvancedFormA = {
  assessmentId: "study_recall_benchmark",
  trackId: "school_advanced",
  form: "A",
  version: 1,

  modules: [
    {
      id: "immediate",
      domain: "Immediate Recall",
      order: 1,
      weight: 20,

      studySeconds: 35,
      recallSeconds: 60,

      instructions: {
        study:
          "Study the 12 items carefully. They will disappear when the timer ends.",
        recall:
          "Type as many items as you can remember. The order does not matter.",
      },

      items: [
        { id: "lantern", label: "Lantern" },
        { id: "falcon", label: "Falcon" },
        { id: "anchor", label: "Anchor" },
        { id: "helmet", label: "Helmet" },
        { id: "violin", label: "Violin" },
        { id: "ladder", label: "Ladder" },
        { id: "compass", label: "Compass" },
        { id: "marble", label: "Marble" },
        { id: "jacket", label: "Jacket" },
        { id: "river", label: "River" },
        { id: "camera", label: "Camera" },
        { id: "walnut", label: "Walnut" },
      ],

      scoring: {
        type: "concept_recall",
        maxRaw: 12,
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

      studySeconds: 25,
      recallSeconds: 50,

      instructions: {
        study:
          "Study these 8 items in order. Try to remember the exact sequence.",
        recall:
          "Arrange the shuffled cards into the same order you studied.",
      },

      items: [
        { id: "moon", label: "Moon" },
        { id: "chair", label: "Chair" },
        { id: "drum", label: "Drum" },
        { id: "train", label: "Train" },
        { id: "orange", label: "Orange" },
        { id: "ring", label: "Ring" },
        { id: "horse", label: "Horse" },
        { id: "shell", label: "Shell" },
      ],

      correctOrder: [
        "moon",
        "chair",
        "drum",
        "train",
        "orange",
        "ring",
        "horse",
        "shell",
      ],

      // Fixed shuffled order keeps Form A reproducible for QA and scoring.
      recallOrder: [
        "orange",
        "moon",
        "shell",
        "drum",
        "horse",
        "chair",
        "ring",
        "train",
      ],

      scoring: {
        type: "exact_position",
        maxRaw: 8,
        maxWeighted: 15,
      },
    },

    {
      id: "association",
      domain: "Association Recall",
      order: 3,
      weight: 20,

      studySeconds: 45,
      recallSeconds: 50,

      instructions: {
        study:
          "Study each word-number pair carefully. Try to remember which number belongs to each word.",
        recall:
          "Enter the number that was paired with each word. The prompts will appear in a different order.",
      },

      pairs: [
        { id: "bridge", prompt: "Bridge", answer: "63" },
        { id: "planet", prompt: "Planet", answer: "28" },
        { id: "feather", prompt: "Feather", answer: "74" },
        { id: "orchid", prompt: "Orchid", answer: "51" },
        { id: "basket", prompt: "Basket", answer: "36" },
        { id: "castle", prompt: "Castle", answer: "92" },
      ],

      recallOrder: [
        "orchid",
        "castle",
        "bridge",
        "basket",
        "planet",
        "feather",
      ],

      scoring: {
        type: "association_exact",
        maxRaw: 6,
        maxWeighted: 20,
      },
    },

    {
      id: "academic",
      domain: "Academic Recall",
      order: 4,
      weight: 25,

      studySeconds: 75,

      title: "The Velora Wetland Project",

      passage:
        "The Velora wetland lies beside a shallow freshwater lake in the northern hills. During a five-year study, researchers observed that the wetland stored large amounts of rainwater during the monsoon season and released it slowly during dry months. A reed called mavin covered nearly one-third of the wetland. Its roots reduced soil erosion and provided shelter for insects and young fish. Researchers recorded 42 bird species in the area, with the greatest number arriving between November and January. In 2023, local volunteers planted 600 additional mavin reeds along damaged sections of the shore. Within eight months, erosion in those sections had fallen noticeably. The research team now measures water depth twice each month and conducts a complete bird survey every January.",

      questions: [
        {
          id: "location",
          prompt: "Where is the Velora wetland located?",
        },
        {
          id: "reed",
          prompt: "What is the reed called?",
        },
        {
          id: "bird_species",
          prompt: "How many bird species were recorded?",
        },
        {
          id: "arrival_months",
          prompt:
            "Between which months did the greatest number of birds arrive?",
        },
        {
          id: "reeds_planted",
          prompt: "How many additional reeds were planted in 2023?",
        },
        {
          id: "water_depth_frequency",
          prompt: "How often does the research team measure water depth?",
        },
      ],

      scoring: {
        type: "academic_question_recall",
        maxRaw: 6,
        maxWeighted: 25,
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
        maxRaw: 12,
        maxWeighted: 20,
        duplicateCredit: false,
        spellingTolerance: "minor",
      },
    },
  ],
};

export default schoolAdvancedFormA;
