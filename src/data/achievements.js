import { CUT_FISH_TYPES, DIFFICULTY_STAGES } from './fishData.js';

// Achievement definitions.
//
// Each one is checked against two things: the round that just finished, and the
// player's running lifetime totals. Splitting it that way lets "score 1000 in a
// single run" and "cut 200 fish in total" live side by side without either
// needing special-case plumbing.
//
// `check(round, lifetime)` must be a pure function — it is called on every
// round end and, for the menu list, on every repaint.

const ALL_SPECIES = CUT_FISH_TYPES.map((f) => f.key);
const LAST_STAGE = DIFFICULTY_STAGES[DIFFICULTY_STAGES.length - 1];

export const ACHIEVEMENTS = [
  {
    id: 'firstCut',
    check: (round, life) => life.cutCount >= 1,
  },
  {
    id: 'firstPerfect',
    check: (round, life) => life.perfectCount >= 1,
  },
  {
    id: 'perfectionist',
    goal: 25,
    progress: (round, life) => life.perfectCount,
    check: (round, life) => life.perfectCount >= 25,
  },
  {
    id: 'combo5',
    goal: 5,
    progress: (round, life) => life.bestCombo,
    check: (round, life) => life.bestCombo >= 5,
  },
  {
    id: 'combo12',
    goal: 12,
    progress: (round, life) => life.bestCombo,
    check: (round, life) => life.bestCombo >= 12,
  },
  {
    id: 'octopusHunter',
    goal: 15,
    progress: (round, life) => life.octopusCount,
    check: (round, life) => life.octopusCount >= 15,
  },
  {
    id: 'thousandaire',
    goal: 1000,
    progress: (round, life) => life.bestScore,
    check: (round, life) => life.bestScore >= 1000,
  },
  {
    // "Not one got away" is only an achievement if there were fish to lose.
    id: 'flawless',
    check: (round) => round.missedCount === 0 && round.cutCount >= 8,
  },
  {
    id: 'marineBiologist',
    goal: ALL_SPECIES.length,
    progress: (round, life) => ALL_SPECIES.filter((k) => (life.speciesCut[k] || 0) > 0).length,
    check: (round, life) => ALL_SPECIES.every((k) => (life.speciesCut[k] || 0) > 0),
  },
  {
    id: 'riptide',
    check: (round) => round.reachedStage >= LAST_STAGE.minElapsed,
  },
  {
    id: 'teamPlayer',
    check: (round, life) => life.coopRounds >= 1,
  },
  {
    id: 'champion',
    check: (round, life) => life.versusWins >= 1,
  },
];

export const EMPTY_LIFETIME = {
  cutCount: 0,
  perfectCount: 0,
  nearPerfectCount: 0,
  missedCount: 0,
  octopusCount: 0,
  bestCombo: 0,
  bestScore: 0,
  rounds: 0,
  coopRounds: 0,
  versusWins: 0,
  speciesCut: {},
};

// Folds one finished round into the running totals. Counters add up; "best"
// fields keep the higher of the two.
export function mergeLifetime(lifetime, round) {
  const merged = {
    ...EMPTY_LIFETIME,
    ...lifetime,
    speciesCut: { ...(lifetime.speciesCut || {}) },
  };

  merged.cutCount += round.cutCount || 0;
  merged.perfectCount += round.perfectCount || 0;
  merged.nearPerfectCount += round.nearPerfectCount || 0;
  merged.missedCount += round.missedCount || 0;
  merged.octopusCount += round.octopusCount || 0;
  merged.rounds += 1;
  merged.bestCombo = Math.max(merged.bestCombo, round.bestCombo || 0);
  merged.bestScore = Math.max(merged.bestScore, round.score || 0);
  if (round.mode === 'coop') merged.coopRounds += 1;
  if (round.mode === 'versus' && round.won) merged.versusWins += 1;

  Object.entries(round.speciesCut || {}).forEach(([key, count]) => {
    merged.speciesCut[key] = (merged.speciesCut[key] || 0) + count;
  });

  return merged;
}

// Returns the ids that are satisfied but were not already unlocked, so the
// results screen can call them out.
export function evaluateAchievements(round, lifetime, alreadyUnlocked = []) {
  const known = new Set(alreadyUnlocked);
  return ACHIEVEMENTS
    .filter((a) => !known.has(a.id))
    .filter((a) => {
      try {
        return !!a.check(round, lifetime);
      } catch {
        return false;
      }
    })
    .map((a) => a.id);
}
