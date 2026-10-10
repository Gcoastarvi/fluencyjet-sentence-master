export const MEMORY_MASTERCLASS_CONFIG = {
  name: "Live Study Memory Class",

  price: 99,

  // Final funnel videos are authoritative; stale build-time env overrides
  // must not replace them with older/dummy videos.
  parentVimeoId: "1234364593",

  advancedVimeoId: "1234364777",
};

export function getMemoryVslId(trackId, config = MEMORY_MASTERCLASS_CONFIG) {
  return trackId === "advanced" ? config.advancedVimeoId : config.parentVimeoId;
}
