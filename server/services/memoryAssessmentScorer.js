// server/services/memoryAssessmentScorer.js
//
// Authoritative scorer for:
// Study Recall Benchmark → Class 6–8 → Form A
//
// Keep answer keys and scoring logic on the server.
// No database dependency in this module.

const FORM_A = {
  trackId: "school_foundation",
  form: "A",

  immediate: {
    weight: 20,
    items: [
      "bicycle",
      "candle",
      "tiger",
      "spoon",
      "kite",
      "key",
      "mountain",
      "bottle",
      "crown",
      "clock",
    ],
  },

  ordered: {
    weight: 15,
    correctOrder: [
      "book",
      "fish",
      "star",
      "bus",
      "leaf",
      "cup",
    ],
  },

  association: {
    weight: 20,
    answers: {
      rocket: "24",
      umbrella: "57",
      guitar: "31",
      apple: "68",
      boat: "42",
    },
  },

  academic: {
    weight: 25,
    answers: {
      habitat: [
        "near cool mountain lakes",
        "cool mountain lakes",
        "near mountain lakes",
      ],
      grass: ["velin"],
      eggs: ["3", "three", "3 eggs", "three eggs"],
      leave_month: ["october", "in october"],
      parent_duration: [
        "4 months",
        "four months",
        "about 4 months",
        "about four months",
      ],
    },
  },

  delayed: {
    weight: 20,
    source: "immediate",
  },
};


const SCHOOL_ADVANCED_FORM_A = {
  trackId: "school_advanced",
  form: "A",

  immediate: {
    weight: 20,
    items: [
      "lantern",
      "falcon",
      "anchor",
      "helmet",
      "violin",
      "ladder",
      "compass",
      "marble",
      "jacket",
      "river",
      "camera",
      "walnut",
    ],
  },

  ordered: {
    weight: 15,
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
  },

  association: {
    weight: 20,
    answers: {
      bridge: "63",
      planet: "28",
      feather: "74",
      orchid: "51",
      basket: "36",
      castle: "92",
    },
  },

  academic: {
    weight: 25,
    answers: {
      location: [
        "beside a shallow freshwater lake in the northern hills",
        "beside a shallow freshwater lake",
        "near a shallow freshwater lake in the northern hills",
        "near a shallow freshwater lake",
        "in the northern hills",
      ],

      reed: [
        "mavin",
      ],

      bird_species: [
        "42",
        "forty two",
        "42 bird species",
        "forty two bird species",
      ],

      arrival_months: [
        "november and january",
        "november to january",
        "november through january",
        "between november and january",
      ],

      reeds_planted: [
        "600",
        "six hundred",
        "600 reeds",
        "600 additional reeds",
        "six hundred reeds",
        "six hundred additional reeds",
      ],

      water_depth_frequency: [
        "twice each month",
        "twice a month",
        "two times a month",
        "2 times a month",
      ],
    },
  },

  delayed: {
    weight: 20,
    source: "immediate",
  },
};


const ADVANCED_FORM_A = {
  trackId: "advanced",
  form: "A",

  immediate: {
    weight: 20,
    items: [
      "telescope",
      "glacier",
      "kettle",
      "sparrow",
      "velvet",
      "tractor",
      "needle",
      "pyramid",
      "coconut",
      "magnet",
      "pillow",
      "desert",
      "mirror",
      "hammer",
    ],
  },

  ordered: {
    weight: 15,
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
  },

  association: {
    weight: 20,
    answers: {
      library: "84",
      volcano: "27",
      ribbon: "65",
      temple: "39",
      diamond: "72",
      coffee: "46",
      forest: "91",
    },
  },

  academic: {
    weight: 25,
    answers: {
      homes_served: [
        "180",
        "180 homes",
        "one hundred eighty",
        "one hundred and eighty",
        "one hundred eighty homes",
        "one hundred and eighty homes",
      ],

      battery_capacity: [
        "2.4 megawatt-hours",
        "2.4 megawatt hours",
        "2.4 megawatt-hour",
        "2.4 megawatt hour",
        "2.4 mwh",
      ],

      diesel_reduction: [
        "38",
        "38 percent",
        "38 per cent",
        "thirty eight percent",
        "thirty-eight percent",
        "thirty eight per cent",
      ],

      network_zones: [
        "4",
        "four",
        "4 zones",
        "four zones",
      ],

      sensor_frequency: [
        "every 15 minutes",
        "every fifteen minutes",
        "15 minutes",
        "fifteen minutes",
      ],

      physical_inspection: [
        "each friday",
        "every friday",
        "on friday",
        "friday",
      ],

      future_plan: [
        "a second microgrid for the eastern valley",
        "second microgrid for the eastern valley",
        "a second microgrid",
        "second microgrid",
        "microgrid for the eastern valley",
        "eastern valley",
      ],
    },
  },

  delayed: {
    weight: 20,
    source: "immediate",
  },
};

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);

  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost =
        left[i - 1] === right[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost,
      );
    }

    for (let j = 0; j < current.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
}

function conceptMatches(input, target) {
  const normalizedInput = normalizeText(input);
  const normalizedTarget = normalizeText(target);

  if (!normalizedInput || !normalizedTarget) return false;
  if (normalizedInput === normalizedTarget) return true;

  // Conservative typo tolerance:
  // one edit only for words of at least 4 characters.
  if (normalizedTarget.length < 4 || normalizedInput.length < 3) {
    return false;
  }

  return levenshtein(normalizedInput, normalizedTarget) <= 1;
}

function scoreConceptRecall(submissions, targetItems, weight) {
  const answers = Array.isArray(submissions) ? submissions : [];
  const remainingTargets = [...targetItems];

  let correct = 0;

  for (const submitted of answers) {
    const normalizedSubmitted = normalizeText(submitted);
    if (!normalizedSubmitted) continue;

    const matchIndex = remainingTargets.findIndex((target) =>
      conceptMatches(normalizedSubmitted, target),
    );

    if (matchIndex === -1) continue;

    correct += 1;
    remainingTargets.splice(matchIndex, 1);
  }

  const maxRaw = targetItems.length;

  return {
    correct,
    maxRaw,
    percentage: round((correct / maxRaw) * 100),
    weightedScore: round((correct / maxRaw) * weight),
    maxWeighted: weight,
  };
}

function scoreOrderedRecall(submissions, correctOrder, weight) {
  const answers = Array.isArray(submissions) ? submissions : [];

  let correct = 0;

  for (let index = 0; index < correctOrder.length; index += 1) {
    if (
      normalizeText(answers[index]) ===
      normalizeText(correctOrder[index])
    ) {
      correct += 1;
    }
  }

  const maxRaw = correctOrder.length;

  return {
    correct,
    maxRaw,
    percentage: round((correct / maxRaw) * 100),
    weightedScore: round((correct / maxRaw) * weight),
    maxWeighted: weight,
  };
}

function scoreAssociationRecall(submissions, answerKey, weight) {
  const answers =
    submissions &&
    typeof submissions === "object" &&
    !Array.isArray(submissions)
      ? submissions
      : {};

  const entries = Object.entries(answerKey);
  let correct = 0;

  for (const [pairId, expected] of entries) {
    const actual = normalizeText(answers[pairId]);

    if (actual && actual === normalizeText(expected)) {
      correct += 1;
    }
  }

  const maxRaw = entries.length;

  return {
    correct,
    maxRaw,
    percentage: round((correct / maxRaw) * 100),
    weightedScore: round((correct / maxRaw) * weight),
    maxWeighted: weight,
  };
}

function phraseMatchesAnswer(input, acceptedAnswers) {
  const actual = normalizeText(input);
  if (!actual) return false;

  const paddedActual = ` ${actual} `;

  return acceptedAnswers.some((accepted) => {
    const expected = normalizeText(accepted);
    if (!expected) return false;

    if (actual === expected) return true;

    return paddedActual.includes(` ${expected} `);
  });
}

function scoreAcademicRecall(submissions, answerKey, weight) {
  const answers =
    submissions &&
    typeof submissions === "object" &&
    !Array.isArray(submissions)
      ? submissions
      : {};

  const entries = Object.entries(answerKey);
  let correct = 0;

  for (const [questionId, acceptedAnswers] of entries) {
    if (
      phraseMatchesAnswer(
        answers[questionId],
        acceptedAnswers,
      )
    ) {
      correct += 1;
    }
  }

  const maxRaw = entries.length;

  return {
    correct,
    maxRaw,
    percentage: round((correct / maxRaw) * 100),
    weightedScore: round((correct / maxRaw) * weight),
    maxWeighted: weight,
  };
}

export function scoreSchoolFoundationFormA({
  immediateAnswers,
  orderedAnswers,
  associationAnswers,
  academicAnswers,
  delayedAnswers,
} = {}) {
  const immediate = scoreConceptRecall(
    immediateAnswers,
    FORM_A.immediate.items,
    FORM_A.immediate.weight,
  );

  const ordered = scoreOrderedRecall(
    orderedAnswers,
    FORM_A.ordered.correctOrder,
    FORM_A.ordered.weight,
  );

  const association = scoreAssociationRecall(
    associationAnswers,
    FORM_A.association.answers,
    FORM_A.association.weight,
  );

  const academic = scoreAcademicRecall(
    academicAnswers,
    FORM_A.academic.answers,
    FORM_A.academic.weight,
  );

  const delayed = scoreConceptRecall(
    delayedAnswers,
    FORM_A.immediate.items,
    FORM_A.delayed.weight,
  );

  const modules = {
    immediate,
    ordered,
    association,
    academic,
    delayed,
  };

  const totalScore = round(
    Object.values(modules).reduce(
      (sum, moduleScore) => sum + moduleScore.weightedScore,
      0,
    ),
  );

  const retentionRatio =
    immediate.correct > 0
      ? round(delayed.correct / immediate.correct, 3)
      : null;

  return {
    trackId: FORM_A.trackId,
    form: FORM_A.form,
    totalScore,
    maxScore: 100,
    modules,
    retentionRatio,
  };
}


export function scoreSchoolAdvancedFormA({
  immediateAnswers,
  orderedAnswers,
  associationAnswers,
  academicAnswers,
  delayedAnswers,
} = {}) {
  const immediate = scoreConceptRecall(
    immediateAnswers,
    SCHOOL_ADVANCED_FORM_A.immediate.items,
    SCHOOL_ADVANCED_FORM_A.immediate.weight,
  );

  const ordered = scoreOrderedRecall(
    orderedAnswers,
    SCHOOL_ADVANCED_FORM_A.ordered.correctOrder,
    SCHOOL_ADVANCED_FORM_A.ordered.weight,
  );

  const association = scoreAssociationRecall(
    associationAnswers,
    SCHOOL_ADVANCED_FORM_A.association.answers,
    SCHOOL_ADVANCED_FORM_A.association.weight,
  );

  const academic = scoreAcademicRecall(
    academicAnswers,
    SCHOOL_ADVANCED_FORM_A.academic.answers,
    SCHOOL_ADVANCED_FORM_A.academic.weight,
  );

  const delayed = scoreConceptRecall(
    delayedAnswers,
    SCHOOL_ADVANCED_FORM_A.immediate.items,
    SCHOOL_ADVANCED_FORM_A.delayed.weight,
  );

  const modules = {
    immediate,
    ordered,
    association,
    academic,
    delayed,
  };

  const totalScore = round(
    Object.values(modules).reduce(
      (sum, moduleScore) => sum + moduleScore.weightedScore,
      0,
    ),
  );

  const retentionRatio =
    immediate.correct > 0
      ? round(delayed.correct / immediate.correct, 3)
      : null;

  return {
    trackId: SCHOOL_ADVANCED_FORM_A.trackId,
    form: SCHOOL_ADVANCED_FORM_A.form,
    totalScore,
    maxScore: 100,
    modules,
    retentionRatio,
  };
}

export {
  conceptMatches,
  normalizeText,
};

export function scoreAdvancedFormA({
  immediateAnswers,
  orderedAnswers,
  associationAnswers,
  academicAnswers,
  delayedAnswers,
} = {}) {
  const immediate = scoreConceptRecall(
    immediateAnswers,
    ADVANCED_FORM_A.immediate.items,
    ADVANCED_FORM_A.immediate.weight,
  );

  const ordered = scoreOrderedRecall(
    orderedAnswers,
    ADVANCED_FORM_A.ordered.correctOrder,
    ADVANCED_FORM_A.ordered.weight,
  );

  const association = scoreAssociationRecall(
    associationAnswers,
    ADVANCED_FORM_A.association.answers,
    ADVANCED_FORM_A.association.weight,
  );

  const academic = scoreAcademicRecall(
    academicAnswers,
    ADVANCED_FORM_A.academic.answers,
    ADVANCED_FORM_A.academic.weight,
  );

  const delayed = scoreConceptRecall(
    delayedAnswers,
    ADVANCED_FORM_A.immediate.items,
    ADVANCED_FORM_A.delayed.weight,
  );

  const modules = {
    immediate,
    ordered,
    association,
    academic,
    delayed,
  };

  const totalScore = round(
    Object.values(modules).reduce(
      (sum, moduleResult) => sum + moduleResult.weightedScore,
      0,
    ),
  );

  const retentionRatio =
    immediate.correct > 0
      ? round(delayed.correct / immediate.correct, 3)
      : null;

  return {
    trackId: ADVANCED_FORM_A.trackId,
    form: ADVANCED_FORM_A.form,
    totalScore,
    maxScore: 100,
    modules,
    retentionRatio,
  };
}
