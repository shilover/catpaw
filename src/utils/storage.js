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
const LANG_KEY = 'tinyfish.lang';
const LIFETIME_KEY = 'tinyfish.lifetime';
const ACHIEVEMENTS_KEY = 'tinyfish.achievements';
const DAILY_KEY = 'tinyfish.daily';
const CUT_GUIDE_KEY = 'tinyfish.cutGuide';
const TUTORIAL_KEY = 'tinyfish.tutorialDone';
const LEVEL_STARS_KEY = 'tinyfish.levelStars';
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

// Null when the player has never chosen; the i18n layer then follows the
// browser's own language instead of forcing English on everyone.
export function getLang() {
  return readRaw(LANG_KEY);
}

export function setLang(lang) {
  writeRaw(LANG_KEY, String(lang));
}

// --- achievements ---------------------------------------------------------
// Running totals across every round ever played, plus the ids already earned.
// Both are read through the same guarded helpers as everything else here: a
// corrupt or unreadable value degrades to "nothing unlocked yet" rather than
// taking the results screen down with it.

export function getLifetimeStats() {
  try {
    const parsed = JSON.parse(readRaw(LIFETIME_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLifetimeStats(stats) {
  writeRaw(LIFETIME_KEY, JSON.stringify(stats));
}

export function getUnlockedAchievements() {
  try {
    const parsed = JSON.parse(readRaw(ACHIEVEMENTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUnlockedAchievements(ids) {
  writeRaw(ACHIEVEMENTS_KEY, JSON.stringify(ids));
}

// --- daily challenge ------------------------------------------------------
// Only today's record is kept: the challenge resets at midnight and yesterday's
// number is not something the player can act on any more.

export function getDailyRecord(dateKey) {
  try {
    const parsed = JSON.parse(readRaw(DAILY_KEY) || '{}');
    if (!parsed || parsed.date !== dateKey) return { date: dateKey, best: 0, plays: 0 };
    return { date: dateKey, best: Number(parsed.best) || 0, plays: Number(parsed.plays) || 0 };
  } catch {
    return { date: dateKey, best: 0, plays: 0 };
  }
}

// Returns true when this run beat the day's previous best.
export function saveDailyRecord(dateKey, score) {
  const current = getDailyRecord(dateKey);
  const improved = score > current.best;
  writeRaw(DAILY_KEY, JSON.stringify({
    date: dateKey,
    best: improved ? score : current.best,
    plays: current.plays + 1,
  }));
  return improved;
}

// --- teaching aids --------------------------------------------------------

// 'auto' shows the ideal-cut line only while the player is still learning,
// which is the behaviour almost everyone wants; 'on' and 'off' are for the
// people who disagree, in either direction.
export const CUT_GUIDE_MODES = ['auto', 'on', 'off'];

export function getCutGuideMode() {
  const raw = readRaw(CUT_GUIDE_KEY);
  return CUT_GUIDE_MODES.includes(raw) ? raw : 'auto';
}

export function setCutGuideMode(mode) {
  if (CUT_GUIDE_MODES.includes(mode)) writeRaw(CUT_GUIDE_KEY, mode);
}

export function isTutorialDone() {
  return readRaw(TUTORIAL_KEY) === 'true';
}

export function setTutorialDone(done = true) {
  writeRaw(TUTORIAL_KEY, String(done));
}

// --- level progress -------------------------------------------------------
// Best stars per level, keyed by level id. Only ever goes up: a worse replay
// must not cost someone progress they already earned.

export function getLevelStars() {
  try {
    const parsed = JSON.parse(readRaw(LEVEL_STARS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// Returns true when this run improved on the level's previous best.
export function saveLevelStars(levelId, stars) {
  const all = getLevelStars();
  const previous = all[levelId] || 0;
  if (stars <= previous) return false;
  all[levelId] = stars;
  writeRaw(LEVEL_STARS_KEY, JSON.stringify(all));
  return true;
}

export function getTotalStars() {
  return Object.values(getLevelStars()).reduce((sum, n) => sum + (Number(n) || 0), 0);
}
