import schoolAdvancedFormA from "./schoolAdvancedFormA.js";

// Class 9–12 Second Study Memory Test.
// Preserve Form A's module structure, timing and scoring.
// This is a working content draft pending final review.

export const schoolAdvancedFormB = structuredClone(
  schoolAdvancedFormA,
);

schoolAdvancedFormB.form = "B";
schoolAdvancedFormB.version = 1;

const modules = Object.fromEntries(
  schoolAdvancedFormB.modules.map((module) => [
    module.id,
    module,
  ]),
);

modules.immediate.items = [
  { id: "globe", label: "Globe" },
  { id: "orange", label: "Orange" },
  { id: "eagle", label: "Eagle" },
  { id: "scissors", label: "Scissors" },
  { id: "necklace", label: "Necklace" },
  { id: "window", label: "Window" },
  { id: "bridge", label: "Bridge" },
  { id: "blanket", label: "Blanket" },
  { id: "candle", label: "Candle" },
  { id: "coin", label: "Coin" },
  { id: "castle", label: "Castle" },
  { id: "scooter", label: "Scooter" },
];

modules.ordered.items = [
  { id: "star", label: "Star" },
  { id: "bottle", label: "Bottle" },
  { id: "lion", label: "Lion" },
  { id: "bell", label: "Bell" },
  { id: "boat", label: "Boat" },
  { id: "flower", label: "Flower" },
  { id: "pencil", label: "Pencil" },
  { id: "hat", label: "Hat" },
];

modules.ordered.correctOrder = [
  "star", "bottle", "lion", "bell",
  "boat", "flower", "pencil", "hat",
];

modules.ordered.recallOrder = [
  "pencil", "lion", "star", "hat",
  "boat", "bell", "bottle", "flower",
];

modules.association.pairs = [
  { id: "camera", prompt: "Camera", answer: "47" },
  { id: "coconut", prompt: "Coconut", answer: "62" },
  { id: "ladder", prompt: "Ladder", answer: "29" },
  { id: "drum", prompt: "Drum", answer: "54" },
  { id: "rocket", prompt: "Rocket", answer: "38" },
  { id: "peacock", prompt: "Peacock", answer: "76" },
];

modules.association.recallOrder = [
  "rocket", "ladder", "peacock",
  "camera", "drum", "coconut",
];

modules.academic.title = "The Norava Forest Program";

modules.academic.passage =
  "The Norava Forest Program protects a forest by dividing it into " +
  "three zones: core, buffer, and community. Farming and construction " +
  "are not allowed in the core zone. In the buffer zone, people may " +
  "collect fallen branches and medicinal plants, but they cannot cut " +
  "living trees. The community zone allows limited farming under " +
  "supervision. Forest officers inspect the area every two months. " +
  "From January to March, watchtowers remain staffed to detect " +
  "possible fires. Any smoke must be reported within fifteen minutes. " +
  "Scientists review the program every four years to determine whether " +
  "the forest needs additional protection.";

modules.academic.questions = [
  {
    id: "zones",
    prompt: "Into how many zones is the forest divided?",
  },
  {
    id: "restricted_zone",
    prompt: "Which zone does not allow farming or construction?",
  },
  {
    id: "inspection_frequency",
    prompt: "How often do forest officers inspect the area?",
  },
  {
    id: "watch_months",
    prompt: "During which months are watchtowers staffed?",
  },
  {
    id: "smoke_reporting",
    prompt: "Within how many minutes must smoke be reported?",
  },
  {
    id: "scientific_review",
    prompt: "How often do scientists review the program?",
  },
];

// Delayed recall already points to the immediate module.
// Because this is a cloned Form B configuration, it uses Form B words.

export default schoolAdvancedFormB;
