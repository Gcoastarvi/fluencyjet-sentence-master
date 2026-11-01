import schoolFoundationFormA from "./schoolFoundationFormA.js";

/*
 * Class 6–8 — Form B
 *
 * Same module structure, timings and scoring weights as Form A.
 * Fresh assessment material. Do not modify Form A.
 *
 * Academic answer keys must be maintained separately on the server.
 */

export const schoolFoundationFormB = structuredClone(
  schoolFoundationFormA,
);

schoolFoundationFormB.form = "B";
schoolFoundationFormB.version = 1;

const modules = Object.fromEntries(
  schoolFoundationFormB.modules.map((module) => [
    module.id,
    module,
  ]),
);

modules.immediate.items = [
  { id: "camera", label: "Camera" },
  { id: "banana", label: "Banana" },
  { id: "elephant", label: "Elephant" },
  { id: "fork", label: "Fork" },
  { id: "balloon", label: "Balloon" },
  { id: "ladder", label: "Ladder" },
  { id: "river", label: "River" },
  { id: "helmet", label: "Helmet" },
  { id: "ring", label: "Ring" },
  { id: "bell", label: "Bell" },
];

modules.ordered.items = [
  { id: "chair", label: "Chair" },
  { id: "moon", label: "Moon" },
  { id: "train", label: "Train" },
  { id: "flower", label: "Flower" },
  { id: "shoe", label: "Shoe" },
  { id: "pencil", label: "Pencil" },
];

modules.ordered.correctOrder = [
  "chair",
  "moon",
  "train",
  "flower",
  "shoe",
  "pencil",
];

modules.ordered.recallOrder = [
  "train",
  "pencil",
  "chair",
  "shoe",
  "moon",
  "flower",
];

modules.association.pairs = [
  { id: "drum", prompt: "Drum", answer: "46" },
  { id: "butterfly", prompt: "Butterfly", answer: "73" },
  { id: "coconut", prompt: "Coconut", answer: "28" },
  { id: "ship", prompt: "Ship", answer: "61" },
  { id: "glove", prompt: "Glove", answer: "35" },
];

modules.association.recallOrder = [
  "coconut",
  "glove",
  "drum",
  "ship",
  "butterfly",
];

modules.academic.title = "The Merava Plant";

modules.academic.passage =
  "The Merava plant grows on dry hills where there is very little rain. " +
  "Its thick leaves store water during the hotter months. " +
  "Every June, the plant produces four yellow flowers at the top of its stem. " +
  "Small insects called noris carry pollen between the flowers. " +
  "Merava seeds remain inside a hard brown shell until the rainy season begins. " +
  "When rain arrives in November, the shell softens and the seeds fall onto the soil. " +
  "A young Merava plant takes about six months to grow strong roots.";

modules.academic.questions = [
  {
    id: "habitat",
    prompt: "Where does the Merava plant grow?",
  },
  {
    id: "insects",
    prompt: "What insects carry pollen?",
  },
  {
    id: "flowers",
    prompt: "How many yellow flowers does the plant produce?",
  },
  {
    id: "rain_month",
    prompt: "In which month does rain soften the seed shell?",
  },
  {
    id: "root_duration",
    prompt: "How long does a young Merava plant take to grow strong roots?",
  },
];

// Delayed Recall uses Form B's immediate-recall word list.
if (Array.isArray(modules.delayed.items)) {
  modules.delayed.items = structuredClone(
    modules.immediate.items,
  );
}

export default schoolFoundationFormB;
