export const advancedFormA = {
  assessmentId: "study_recall_benchmark",
  trackId: "advanced",
  form: "A",
  version: 1,

  modules: [
    {
      id: "immediate",
      domain: "Immediate Recall",
      order: 1,
      weight: 20,

      studySeconds: 40,
      recallSeconds: 70,

      instructions: {
        study:
          "Study the 14 items carefully. They will disappear when the timer ends.",
        recall:
          "Type as many items as you can remember. The order does not matter.",
      },

      items: [
        { id: "telescope", label: "Telescope" },
        { id: "glacier", label: "Glacier" },
        { id: "kettle", label: "Kettle" },
        { id: "sparrow", label: "Sparrow" },
        { id: "velvet", label: "Velvet" },
        { id: "tractor", label: "Tractor" },
        { id: "needle", label: "Needle" },
        { id: "pyramid", label: "Pyramid" },
        { id: "coconut", label: "Coconut" },
        { id: "magnet", label: "Magnet" },
        { id: "pillow", label: "Pillow" },
        { id: "desert", label: "Desert" },
        { id: "mirror", label: "Mirror" },
        { id: "hammer", label: "Hammer" },
      ],

      scoring: {
        type: "concept_recall",
        maxRaw: 14,
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

      studySeconds: 30,
      recallSeconds: 60,

      instructions: {
        study:
          "Study these 10 items in order. Try to remember the exact sequence.",
        recall:
          "Arrange the shuffled cards into the same order you studied.",
      },

      items: [
        { id: "desk", label: "Desk" },
        { id: "lemon", label: "Lemon" },
        { id: "bell", label: "Bell" },
        { id: "ship", label: "Ship" },
        { id: "coin", label: "Coin" },
        { id: "zebra", label: "Zebra" },
        { id: "window", label: "Window" },
        { id: "brush", label: "Brush" },
        { id: "pearl", label: "Pearl" },
        { id: "eagle", label: "Eagle" },
      ],

      correctOrder: [
        "desk",
        "lemon",
        "bell",
        "ship",
        "coin",
        "zebra",
        "window",
        "brush",
        "pearl",
        "eagle",
      ],

      // Fixed shuffled order keeps Form A reproducible for QA and scoring.
      recallOrder: [
        "zebra",
        "bell",
        "eagle",
        "desk",
        "pearl",
        "ship",
        "window",
        "lemon",
        "brush",
        "coin",
      ],

      scoring: {
        type: "exact_position",
        maxRaw: 10,
        maxWeighted: 15,
      },
    },

    {
      id: "association",
      domain: "Association Recall",
      order: 3,
      weight: 20,

      studySeconds: 55,
      recallSeconds: 60,

      instructions: {
        study:
          "Study each word-number pair carefully. Try to remember which number belongs to each word.",
        recall:
          "Enter the number that was paired with each word. The prompts will appear in a different order.",
      },

      pairs: [
        { id: "library", prompt: "Library", answer: "84" },
        { id: "volcano", prompt: "Volcano", answer: "27" },
        { id: "ribbon", prompt: "Ribbon", answer: "65" },
        { id: "temple", prompt: "Temple", answer: "39" },
        { id: "diamond", prompt: "Diamond", answer: "72" },
        { id: "coffee", prompt: "Coffee", answer: "46" },
        { id: "forest", prompt: "Forest", answer: "91" },
      ],

      recallOrder: [
        "diamond",
        "library",
        "forest",
        "ribbon",
        "coffee",
        "volcano",
        "temple",
      ],

      scoring: {
        type: "association_exact",
        maxRaw: 7,
        maxWeighted: 20,
      },
    },

    {
      id: "academic",
      domain: "Information Recall",
      order: 4,
      weight: 25,

      studySeconds: 90,

      title: "The Norvia Microgrid Trial",

      passage:
        "In 2024, engineers in Norvia, a hill town, began a 14-month trial of a community microgrid serving 180 homes and three small clinics. Solar panels supplied most daytime electricity, while batteries stored extra power for evening use. The system had 2.4 megawatt-hours of battery capacity. During the first six months, electricity drawn from diesel generators fell by 38 percent compared with the previous year. To prevent one fault from affecting the whole network, engineers divided the microgrid into four zones that could be isolated independently. Automated sensors checked battery temperature and charge levels every 15 minutes, while technicians performed a physical inspection each Friday. After severe rain in August, one hillside cable was replaced and drainage channels were widened. By the end of the trial, the clinics had experienced no power interruption longer than nine minutes. The town council is now considering a second microgrid for the eastern valley.",

      questions: [
        {
          id: "homes_served",
          prompt: "How many homes did the microgrid serve?",
        },
        {
          id: "battery_capacity",
          prompt: "What was the battery capacity of the system?",
        },
        {
          id: "diesel_reduction",
          prompt:
            "By what percentage did electricity drawn from diesel generators fall?",
        },
        {
          id: "network_zones",
          prompt: "Into how many zones was the microgrid divided?",
        },
        {
          id: "sensor_frequency",
          prompt:
            "How often did automated sensors check battery temperature and charge levels?",
        },
        {
          id: "physical_inspection",
          prompt: "When did technicians perform a physical inspection?",
        },
        {
          id: "future_plan",
          prompt: "What is the town council considering next?",
        },
      ],

      scoring: {
        type: "academic_question_recall",
        maxRaw: 7,
        maxWeighted: 25,
      },
    },

    {
      id: "delayed",
      domain: "Delayed Recall",
      order: 5,
      weight: 20,

      recallSeconds: 70,

      // Reuse the ORIGINAL Immediate Recall items.
      // Do not expose them again before recall.
      sourceModuleId: "immediate",

      instructions: {
        recall:
          "Without looking back, enter as many of the original items from Part 1 as you can remember.",
      },

      scoring: {
        type: "delayed_concept_recall",
        maxRaw: 14,
        maxWeighted: 20,
        duplicateCredit: false,
        spellingTolerance: "minor",
      },
    },
  ],
};

export default advancedFormA;
