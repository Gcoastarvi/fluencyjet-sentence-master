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

export {
  conceptMatches,
  normalizeText,
};
