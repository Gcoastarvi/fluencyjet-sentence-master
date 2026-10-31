import advancedFormA from "./advancedFormA.js";

/*
 * Advanced Second Study Memory Test — Form B.
 * Working draft pending educational review.
 *
 * Preserve Form A's timings, scoring and module structure.
 * Use independent server-side answer keys.
 */

export const advancedFormB = structuredClone(advancedFormA);

advancedFormB.form = "B";
advancedFormB.version = 1;

const modules = Object.fromEntries(
  advancedFormB.modules.map((module) => [
    module.id,
    module,
  ]),
);

modules.immediate.items = [
  { id: "globe", label: "Globe" },
  { id: "silver", label: "Silver" },
  { id: "eagle", label: "Eagle" },
  { id: "cotton", label: "Cotton" },
  { id: "garden", label: "Garden" },
  { id: "passport", label: "Passport" },
  { id: "pebble", label: "Pebble" },
  { id: "palace", label: "Palace" },
  { id: "basket", label: "Basket" },
  { id: "necklace", label: "Necklace" },
  { id: "bridge", label: "Bridge" },
  { id: "jacket", label: "Jacket" },
  { id: "curtain", label: "Curtain" },
  { id: "sapphire", label: "Sapphire" },
];

modules.ordered.items = [
  { id: "crane", label: "Crane" },
  { id: "olive", label: "Olive" },
  { id: "gate", label: "Gate" },
  { id: "peach", label: "Peach" },
  { id: "wave", label: "Wave" },
  { id: "mask", label: "Mask" },
  { id: "branch", label: "Branch" },
  { id: "radio", label: "Radio" },
  { id: "moss", label: "Moss" },
  { id: "mouse", label: "Mouse" },
];

modules.ordered.correctOrder = [
  "crane", "olive", "gate", "peach", "wave",
  "mask", "branch", "radio", "moss", "mouse",
];

modules.ordered.recallOrder = [
  "olive", "moss", "mouse", "gate", "radio",
  "wave", "branch", "peach", "crane", "mask",
];

modules.association.pairs = [
  { id: "peacock", prompt: "Peacock", answer: "34" },
  { id: "factory", prompt: "Factory", answer: "76" },
  { id: "puzzle", prompt: "Puzzle", answer: "58" },
  { id: "market", prompt: "Market", answer: "43" },
  { id: "kitchen", prompt: "Kitchen", answer: "89" },
  { id: "bakery", prompt: "Bakery", answer: "25" },
  { id: "jungle", prompt: "Jungle", answer: "61" },
];

modules.association.recallOrder = [
  "kitchen", "peacock", "jungle",
  "puzzle", "bakery", "factory", "market",
];

modules.academic.title = "The Avenor Smart Water Network";

modules.academic.passage =
  "The Avenor Smart Water Network was introduced in the western " +
  "district to reduce leaks and improve water delivery. " +
  "It now supplies clean water to 240 apartment buildings across " +
  "the district. On an average day, the system distributes " +
  "3.6 million litres of water through underground pipelines. " +
  "During its first year, smart monitoring reduced the amount " +
  "of water lost to leaks by 29 percent. " +
  "Engineers divided the network into six sections, and each " +
  "section can be closed independently when a repair is needed. " +
  "Digital sensors measure water pressure and flow every " +
  "12 minutes, sending readings to a central control room. " +
  "Maintenance teams inspect the main valves every Tuesday " +
  "and record any unusual changes in pressure. " +
  "When a leak is suspected, the control room compares readings " +
  "from nearby sensors before dispatching a repair team. " +
  "The city plans to extend the system only after further " +
  "reliability testing.";

modules.academic.questions = [
  {
    id: "apartments",
    prompt: "How many apartment buildings does the network serve?",
  },
  {
    id: "daily_water",
    prompt: "How much water does the system distribute daily?",
  },
  {
    id: "leak_reduction",
    prompt: "By what percentage did water loss decrease?",
  },
  {
    id: "sections",
    prompt: "Into how many sections is the network divided?",
  },
  {
    id: "sensor_frequency",
    prompt: "How often do the sensors take readings?",
  },
  {
    id: "inspection_day",
    prompt: "On which day are the main valves inspected?",
  },
  {
    id: "district",
    prompt: "In which district was the network introduced?",
  },
];

// Delayed recall references this Form B's immediate module.

export default advancedFormB;
