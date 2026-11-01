import {
  round,
  scoreConceptRecall,
  scoreOrderedRecall,
  scoreAssociationRecall,
  scoreAcademicRecall,
} from "./memoryAssessmentScorer.js";

/*
 * Authoritative server-side scorer.
 * Advanced Second Study Memory Test — Form B.
 *
 * Uses existing Form A scoring rules with independent
 * Form B answer keys.
 *
 * No database operations or public routes.
 */

const FORM_B = {
  trackId: "advanced",
  form: "B",

  immediate: {
    weight: 20,
    items: [
      "globe",
      "silver",
      "eagle",
      "cotton",
      "garden",
      "passport",
      "pebble",
      "palace",
      "basket",
      "necklace",
      "bridge",
      "jacket",
      "curtain",
      "sapphire",
    ],
  },

  ordered: {
    weight: 15,
    correctOrder: [
      "crane",
      "olive",
      "gate",
      "peach",
      "wave",
      "mask",
      "branch",
      "radio",
      "moss",
      "mouse",
    ],
  },

  association: {
    weight: 20,
    answers: {
      peacock: "34",
      factory: "76",
      puzzle: "58",
      market: "43",
      kitchen: "89",
      bakery: "25",
      jungle: "61",
    },
  },

  academic: {
    weight: 25,
    answers: {
      apartments: [
        "240",
        "240 apartment buildings",
        "two hundred forty",
        "two hundred and forty",
      ],

      daily_water: [
        "3.6 million litres",
        "3.6 million liters",
        "3.6 million",
        "3600000 litres",
        "3600000 liters",
        "3600000",
      ],

      leak_reduction: [
        "29",
        "29 percent",
        "29%",
        "twenty nine percent",
        "twenty-nine percent",
      ],

      sections: [
        "6",
        "six",
        "six sections",
        "6 sections",
      ],

      sensor_frequency: [
        "every 12 minutes",
        "12 minutes",
        "every twelve minutes",
        "twelve minutes",
      ],

      inspection_day: [
        "tuesday",
        "every tuesday",
        "on tuesday",
      ],

      district: [
        "western district",
        "the western district",
      ],
    },
  },

  delayed: {
    weight: 20,
    source: "immediate",
  },
};

export function scoreAdvancedFormB({
  immediateAnswers,
  orderedAnswers,
  associationAnswers,
  academicAnswers,
  delayedAnswers,
} = {}) {
  const immediate = scoreConceptRecall(
    immediateAnswers,
    FORM_B.immediate.items,
    FORM_B.immediate.weight,
  );

  const ordered = scoreOrderedRecall(
    orderedAnswers,
    FORM_B.ordered.correctOrder,
    FORM_B.ordered.weight,
  );

  const association = scoreAssociationRecall(
    associationAnswers,
    FORM_B.association.answers,
    FORM_B.association.weight,
  );

  const academic = scoreAcademicRecall(
    academicAnswers,
    FORM_B.academic.answers,
    FORM_B.academic.weight,
  );

  const delayed = scoreConceptRecall(
    delayedAnswers,
    FORM_B.immediate.items,
    FORM_B.delayed.weight,
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
      (sum, result) => sum + result.weightedScore,
      0,
    ),
  );

  const retentionRatio =
    immediate.correct > 0
      ? round(delayed.correct / immediate.correct, 3)
      : null;

  return {
    trackId: FORM_B.trackId,
    form: FORM_B.form,
    totalScore,
    maxScore: 100,
    modules,
    retentionRatio,
  };
}
