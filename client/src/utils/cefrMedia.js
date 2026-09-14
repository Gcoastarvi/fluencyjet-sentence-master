const SAFE_ASSET_KEY = /^[a-z0-9][a-z0-9-]*$/i;

const READY_AUDIO_ASSET_KEYS = new Set([
  "de-a1-d1-listening-01",
]);

export function isCefrAudioAssetReady(audioAssetKey) {
  return READY_AUDIO_ASSET_KEYS.has(audioAssetKey);
}

export function resolveCefrAudioAssetUrl(audioAssetKey) {
  if (
    typeof audioAssetKey !== "string" ||
    !SAFE_ASSET_KEY.test(audioAssetKey)
  ) {
    return null;
  }

  return `/cefr/audio/${audioAssetKey}.mp3`;
}
