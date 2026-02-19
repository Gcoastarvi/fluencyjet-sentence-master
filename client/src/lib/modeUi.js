// client/src/lib/modeUi.js

export const MODE_UI = {
  reorder: {
    title: "Instant Accuracy",
    sub: "Fix grammar + word order",
  },
  typing: {
    title: "Speed Builder",
    sub: "Build fluency + sentence flow",
  },
  audio: {
    title: "Pronunciation Booster",
    sub: "Repeat + dictation",
  },
  cloze: {
    title: "Cloze",
    sub: "Fill missing words",
  },
};

export const uiFor = (mode) => MODE_UI[mode] || { title: "Practice", sub: "" };

// Optional helpers (safe + useful for consistency)
export const isValidMode = (mode) => Boolean(MODE_UI[mode]);
export const ALL_MODES = Object.keys(MODE_UI);
