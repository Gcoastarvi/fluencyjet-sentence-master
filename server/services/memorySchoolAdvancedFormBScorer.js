import {
  round,
  scoreConceptRecall,
  scoreOrderedRecall,
  scoreAssociationRecall,
  scoreAcademicRecall,
} from "./memoryAssessmentScorer.js";

/*
 * Authoritative server-side scorer.
 * Classes 9–12 — Second Study Memory Test (Form B).
 *
 * Reuses Form A scoring rules but has separate Form B keys.
 * No database operations or public routes.
 */

const FORM_B = {
  trackId: "school_advanced",
  form: "B",

  immediate: {
    weight: 20,
    items: [
      "globe",
      "orange",
      "eagle",
      "scissors",
      "necklace",
      "window",
      "bridge",
      "blanket",
      "candle",
      "coin",
      "castle",
      "scooter",
    ],
  },

  ordered: {
    weight: 15,
    correctOrder: [
      "star",
      "bottle",
      "lion",
      "bell",
      "boat",
      "flower",
      "pencil",
      "hat",
    ],
  },

  association: {
    weight: 20,
    answers: {
      camera: "47",
      coconut: "62",
      ladder: "29",
      drum: "54",
      rocket: "38",
      peacock: "76",
    },
  },

  academic: {
    weight: 25,
    answers: {
      zones: [
        "3",
        "three",
        "three zones",
        "3 zones",
      ],
      restricted_zone: [
        "core",
        "core zone",
        "the core zone",
      ],
      inspection_frequency: [
        "every two months",
        "every 2 months",
        "once every two months",
        "once every 2 months",
      ],
      watch_months: [
        "january to march",
        "from january to march",
        "january through march",
        "january and february and march",
      ],
      smoke_reporting: [
        "15 minutes",
        "fifteen minutes",
        "within 15 minutes",
        "within fifteen minutes",
      ],
      scientific_review: [
        "every four years",
        "every 4 years",
        "once every four years",
        "once every 4 years",
      ],
    },
  },

  delayed: {
    weight: 20,
    source: "immediate",
  },
};

export function scoreSchoolAdvancedFormB({
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
