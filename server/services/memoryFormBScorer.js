import {
  round,
  scoreConceptRecall,
  scoreOrderedRecall,
  scoreAssociationRecall,
  scoreAcademicRecall,
} from "./memoryAssessmentScorer.js";

/*
 * Authoritative server-side scorer:
 * Class 6–8 — Second Study Memory Test (Form B).
 *
 * This scorer uses the same mathematical scoring rules
 * as Form A but entirely separate assessment answers.
 *
 * No database access or public routes.
 */

const FORM_B = {
  trackId: "school_foundation",
  form: "B",

  immediate: {
    weight: 20,
    items: [
      "camera",
      "banana",
      "elephant",
      "fork",
      "balloon",
      "ladder",
      "river",
      "helmet",
      "ring",
      "bell",
    ],
  },

  ordered: {
    weight: 15,
    correctOrder: [
      "chair",
      "moon",
      "train",
      "flower",
      "shoe",
      "pencil",
    ],
  },

  association: {
    weight: 20,
    answers: {
      drum: "46",
      butterfly: "73",
      coconut: "28",
      ship: "61",
      glove: "35",
    },
  },

  academic: {
    weight: 25,
    answers: {
      habitat: [
        "dry hills",
        "on dry hills",
      ],
      insects: [
        "noris",
      ],
      flowers: [
        "4",
        "four",
        "four yellow flowers",
      ],
      rain_month: [
        "november",
        "in november",
      ],
      root_duration: [
        "6 months",
        "six months",
        "about six months",
      ],
    },
  },

  delayed: {
    weight: 20,
    source: "immediate",
  },
};

export function scoreSchoolFoundationFormB({
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
