export const MEMORY_MASTERCLASS_CONFIG = {
  name: "Live Study Memory Class",

  price: 99,

  parentVimeoId:
    import.meta.env?.VITE_MEMORY_PARENT_VSL_ID || "1234364593",

  advancedVimeoId:
    import.meta.env?.VITE_MEMORY_ADVANCED_VSL_ID || "1234364777",
};

export function getMemoryVslId(trackId, config = MEMORY_MASTERCLASS_CONFIG) {
  return trackId === "advanced" ? config.advancedVimeoId : config.parentVimeoId;
}
