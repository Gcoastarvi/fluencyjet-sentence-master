// client/src/lib/modeUi.js

export const MODE_UI = {
  reorder: {
    title: "Instant Accuracy",
    sub: "Reorder (word order)",
    coach:
      "Recommended: Instant Accuracy first for a quick win (grammar + word order).",
    est: "~90 sec",
    xp: "+300–450 XP",
  },
  typing: {
    title: "Speed Builder",
    sub: "Typing (fluency)",
    coach: "Recommended: Speed Builder next to build speed and sentence flow.",
    est: "~2 min",
    xp: "+450–600 XP",
  },
  audio: {
    title: "Pronunciation Booster",
    sub: "Audio (repeat + dictation)",
    coach:
      "Recommended: Pronunciation Booster next for pronunciation + listening.",
    est: "~2–3 min",
    xp: "+350–550 XP",
  },
  cloze: {
    title: "Grammar Fix",
    sub: "Cloze",
    coach: "Recommended: Grammar Fix next.",
    est: "~2 min",
    xp: "+XP",
  },
};

export const uiFor = (mode) =>
  MODE_UI[mode] || {
    title: "Practice",
    sub: "",
    coach: "",
    est: "~2 min",
    xp: "+XP",
  };
