// Substitutes the UE project's AutoSaveGame/BaseGameInstance (HighScore, ScoreList).

const HIGH_SCORE_KEY = 'tinyfish.highScore';
const SCORE_LIST_KEY = 'tinyfish.scoreList';
const MUSIC_KEY = 'tinyfish.musicEnabled';
const MAX_SCORE_LIST = 10;

export function getHighScore() {
  return Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
}

export function saveHighScore(score) {
  const current = getHighScore();
  if (score > current) {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
    return true;
  }
  return false;
}

export function getScoreList() {
  try {
    return JSON.parse(localStorage.getItem(SCORE_LIST_KEY) || '[]');
  } catch {
    return [];
  }
}

export function pushScoreListEntry(score) {
  const list = getScoreList();
  list.unshift({ score, date: Date.now() });
  localStorage.setItem(SCORE_LIST_KEY, JSON.stringify(list.slice(0, MAX_SCORE_LIST)));
}

export function isMusicEnabled() {
  const v = localStorage.getItem(MUSIC_KEY);
  return v === null ? true : v === 'true';
}

export function setMusicEnabled(enabled) {
  localStorage.setItem(MUSIC_KEY, String(enabled));
}
