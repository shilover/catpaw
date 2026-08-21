import { SFX, MUSIC_KEY, comboKey, buildSfx, buildMusic, hasMusic } from './synth.js';
import { isMusicEnabled, isSfxEnabled } from '../utils/storage.js';

export { SFX, comboKey };

// The one place scenes talk to audio through.
//
// Every call is a no-op when the sound is missing, when the player has that
// category switched off, or when the browser gave us no audio at all — so
// callers never have to guard, and a silent environment is never a crash.

let musicSound = null;

function canPlay(scene) {
  return !!(scene.sound && scene.cache && scene.cache.audio);
}

export function initAudio(scene) {
  return buildSfx(scene);
}

// Shortest gap between two plays of the same sound. Some triggers legitimately
// fire twice for one player action — a button reached through both Phaser's hit
// test and the split-screen manual fallback, say — and two copies of a 90ms
// click a millisecond apart just sounds broken.
const RETRIGGER_GUARD_MS = 60;
const lastPlayed = new Map();

export function playSfx(scene, key, config) {
  if (!isSfxEnabled() || !canPlay(scene)) return;
  if (!scene.cache.audio.exists(key)) return;

  const now = scene.time ? scene.time.now : 0;
  const previous = lastPlayed.get(key);
  if (previous !== undefined && now - previous < RETRIGGER_GUARD_MS) return;
  lastPlayed.set(key, now);

  scene.sound.play(key, config);
}

export function playCombo(scene, comboIndex) {
  playSfx(scene, comboKey(comboIndex));
}

// Music is owned by the Sound Manager rather than a scene, so it survives scene
// changes instead of restarting on every screen.
export function startMusic(scene) {
  if (!canPlay(scene)) return;

  // The bed is synthesised the first time a scene asks for it, and deliberately
  // a beat late: eight seconds of pad is the most expensive thing the game
  // generates, and doing it inline would stall the very first frame of the menu
  // behind it. Ambient music starting a fraction of a second in is nobody's
  // problem; a blank screen is.
  if (!hasMusic(scene)) {
    if (!scene.__musicPending) {
      scene.__musicPending = true;
      scene.time.delayedCall(120, () => {
        scene.__musicPending = false;
        if (buildMusic(scene)) startMusic(scene);
      });
    }
    return;
  }

  if (!musicSound || !scene.sound.get(MUSIC_KEY)) {
    musicSound = scene.sound.add(MUSIC_KEY, { loop: true, volume: 0.34 });
  }
  if (isMusicEnabled()) {
    if (!musicSound.isPlaying) musicSound.play();
  } else if (musicSound.isPlaying) {
    musicSound.stop();
  }
}

// Called when the player flips the music switch, so the change is heard at once
// rather than at the next scene transition.
export function syncMusic(scene) {
  startMusic(scene);
}

export function stopMusic() {
  if (musicSound && musicSound.isPlaying) musicSound.stop();
}
