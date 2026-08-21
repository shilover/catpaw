// The seven levels.
//
// One level per skill the game actually asks of you — no more, because there
// are only seven distinct things to be good at here, and padding the list with
// score thresholds would just be the same level wearing different numbers.
//
// Each level isolates its skill: everything else is turned down or held
// constant, so a player who is stuck knows exactly which ability is failing
// them. The seeds are fixed, so every player gets the same fish in the same
// order and a score is worth comparing.

import { CUT_FISH_TYPES } from './fishData.js';

const ALL_SPECIES = CUT_FISH_TYPES.map((f) => f.key);

export const LEVELS = [
  {
    id: 1,
    skill: 'precision',
    seed: 101,
    duration: 45,
    rules: {
      // One species, no current, generous clock: nothing to think about except
      // where the line goes. Targets start at the easy end — 50% is a cut
      // through the middle, which has an obvious visual anchor — and walk out
      // towards the ones with no landmark at all.
      species: ['clown'],
      targets: [50, 45, 40, 35, 30],
      wind: { amplitude: 0, speed: 0 },
      cutTime: 5.0,
    },
    stars: { metric: 'score', values: [400, 650, 900] },
  },
  {
    id: 2,
    skill: 'shape',
    seed: 202,
    duration: 50,
    rules: {
      // Every species in rotation at one fixed target. The whole lesson is that
      // "25%" sits somewhere different on a round pufferfish than on a flat
      // manta ray — which is only true now that each species has its own body
      // ellipse (see fishData.bodyRadii).
      species: ALL_SPECIES,
      cycleSpecies: true,
      targets: [25],
      wind: { amplitude: 0, speed: 0 },
      cutTime: 5.0,
    },
    stars: { metric: 'score', values: [450, 700, 950] },
  },
  {
    id: 3,
    skill: 'angle',
    seed: 303,
    duration: 50,
    rules: {
      // Vertical cuts only, on the round species so the shape gives no
      // directional hint. Judging a share across the width is a genuinely
      // different problem from judging it down the height.
      species: ['puffer'],
      targets: [25, 30, 35, 40],
      wind: { amplitude: 0, speed: 0 },
      cutTime: 5.5,
      cutAngle: { degrees: 90, tolerance: 25 },
    },
    stars: { metric: 'score', values: [350, 600, 850] },
  },
  {
    id: 4,
    skill: 'current',
    seed: 404,
    duration: 50,
    rules: {
      // A strong, steady current: the fish is somewhere else by the time the
      // swipe lands, so the cut has to be led rather than aimed.
      species: ['clown', 'cute'],
      targets: [30, 35, 40, 45],
      wind: { amplitude: 88, speed: 3.4 },
      cutTime: 5.0,
    },
    stars: { metric: 'score', values: [350, 600, 850] },
  },
  {
    id: 5,
    skill: 'speed',
    seed: 505,
    duration: 45,
    rules: {
      // Half the usual thinking time, with forgiving targets so the pressure
      // comes from the clock and nothing else.
      species: ALL_SPECIES,
      targets: [35, 40, 45, 50],
      wind: { amplitude: 0, speed: 0 },
      cutTime: 2.4,
    },
    stars: { metric: 'score', values: [450, 750, 1050] },
  },
  {
    id: 6,
    skill: 'streak',
    seed: 606,
    duration: 60,
    // Scored on the longest streak rather than points: this level is about not
    // dropping the ball, and a big score from one lucky stretch should not pass
    // for consistency.
    stars: { metric: 'bestCombo', values: [4, 7, 11] },
    rules: {
      species: ['clown', 'cute', 'puffer'],
      targets: [35, 40, 45],
      wind: { amplitude: 20, speed: 1.4 },
      cutTime: 4.2,
    },
  },
  {
    id: 7,
    skill: 'margin',
    seed: 707,
    duration: 50,
    rules: {
      // Small fish. The same 5% scoring bucket is now a handful of pixels wide,
      // so there is no margin left to be sloppy in.
      species: ALL_SPECIES,
      targets: [20, 25, 30, 35],
      wind: { amplitude: 26, speed: 1.6 },
      cutTime: 4.5,
      fishScale: 0.5,
    },
    stars: { metric: 'score', values: [350, 600, 850] },
  },
];

export const TOTAL_STARS = LEVELS.length * 3;

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || null;
}

// How many stars a finished run earned: the highest threshold it reached.
export function starsFor(level, stats) {
  if (!level) return 0;
  const value = level.stars.metric === 'bestCombo' ? (stats.bestCombo || 0) : (stats.score || 0);
  let earned = 0;
  level.stars.values.forEach((threshold) => {
    if (value >= threshold) earned += 1;
  });
  return earned;
}

// A level is playable once the one before it has been cleared at all. Clearing
// means one star, not three — the gate is there to order the lessons, not to
// make anyone grind.
export function isLevelUnlocked(id, starsById) {
  if (id <= 1) return true;
  return (starsById[id - 1] || 0) >= 1;
}
