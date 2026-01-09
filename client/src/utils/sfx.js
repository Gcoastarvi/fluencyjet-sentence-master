const cache = new Map();

export function playSfx(name, { volume = 0.6 } = {}) {
  try {
    const src = `/sounds/${name}.mp3`;

    // reuse objects so we don't create 100 Audio instances
    let audio = cache.get(src);
    if (!audio) {
      audio = new Audio(src);
      audio.preload = "auto";
      cache.set(src, audio);
    }

    audio.volume = volume;

    // restart sound if it was already playing
    audio.currentTime = 0;

    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Ignore autoplay/security blocks silently
      });
    }
  } catch {
    // Never crash UI because sound failed
  }
}
import { playSfx } from "@/utils/sfx";

// on correct
playSfx("correct");

// on wrong
playSfx("wrong");

// on level-up
playSfx("levelup");
