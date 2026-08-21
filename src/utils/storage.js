// Local persistence. Every access is guarded: Safari in private mode throws on
// `setItem` once its quota is hit, and an unguarded write here used to happen at
// the exact moment a round ended, taking the game down with it. Reads are
// guarded for the same reason (a locked-down browser can throw on access to
// `localStorage` itself, not just on writes).

const HIGH_SCORE_KEY = 'tinyfish.highScore';
const COOP_HIGH_SCORE_KEY = 'tinyfish.coopHighScore';
const SCORE_LIST_KEY = 'tinyfish.scoreList';
const MUSIC_KEY = 'tinyfish.musicEnabled';
const SFX_KEY = 'tinyfish.sfxEnabled';
const MAX_SCORE_LIST = 10;

function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function readNumber(key) {
  const raw = readRaw(key);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Solo and Co-op keep separate bests: a Co-op total is two players' work against
// a shared fish, so letting it land in the solo high score made the menu's
// "High Score" unbeatable by an actual solo run.
export function getHighScore() {
  return readNumber(HIGH_SCORE_KEY);
}

export function saveHighScore(score) {
  if (score <= getHighScore()) return false;
  return writeRaw(HIGH_SCORE_KEY, String(score));
}

export function getCoopHighScore() {
  return readNumber(COOP_HIGH_SCORE_KEY);
}

export function saveCoopHighScore(score) {
  if (score <= getCoopHighScore()) return false;
  return writeRaw(COOP_HIGH_SCORE_KEY, String(score));
}

export function getScoreList() {
  try {
    const parsed = JSON.parse(readRaw(SCORE_LIST_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushScoreListEntry(score, mode = 'solo') {
  const list = getScoreList();
  list.unshift({ score, mode, date: Date.now() });
  writeRaw(SCORE_LIST_KEY, JSON.stringify(list.slice(0, MAX_SCORE_LIST)));
}

function readFlag(key) {
  const v = readRaw(key);
  return v === null ? true : v === 'true';
}

export function isMusicEnabled() {
  return readFlag(MUSIC_KEY);
}

export function setMusicEnabled(enabled) {
  writeRaw(MUSIC_KEY, String(enabled));
}

// Music and effects are switched separately: the ambient bed is the first thing
// players turn off, and losing the cut/perfect feedback with it would take the
// game's timing cues away too.
export function isSfxEnabled() {
  return readFlag(SFX_KEY);
}

export function setSfxEnabled(enabled) {
  writeRaw(SFX_KEY, String(enabled));
}
