export const MEMORY_MASTERCLASS_CONFIG = {
  name: "Live Study Memory Class",

  dateISO: "2026-10-18",
  dateLabel: "Sunday, 18 October",

  startTime: "5:00 PM",
  endTime: "7:00 PM",
  timezone: "IST",

  price: 99,

  parentVimeoId:
    import.meta.env.VITE_MEMORY_PARENT_VSL_ID || "",

  advancedVimeoId:
    import.meta.env.VITE_MEMORY_ADVANCED_VSL_ID || "",
};
