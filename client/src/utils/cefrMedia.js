const SAFE_ASSET_KEY = /^[a-z0-9][a-z0-9-]*$/i;

export function resolveCefrAudioAssetUrl(audioAssetKey) {
  if (
    typeof audioAssetKey !== "string" ||
    !SAFE_ASSET_KEY.test(audioAssetKey)
  ) {
    return null;
  }

  return `/cefr/audio/${audioAssetKey}.mp3`;
}
