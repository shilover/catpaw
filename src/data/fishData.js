// Mirrors DT_FishList / FIshStruct rows (Name, Score, Size) for the
// "cuttable" species — the octopus (DT_BounsList) is reserved for the
// perfect-cut bonus pop-up, not a regular target.

export const CUT_FISH_TYPES = [
  {
    key: 'clown',
    name: 'Clownfish',
    baseScore: 10,
    size: 4.0,
    bodyColor: 0xff7a29,
    stripeColor: 0xffffff,
    finColor: 0xff5a00,
  },
  {
    key: 'cute',
    name: 'CuteFish',
    baseScore: 15,
    size: 3.8,
    bodyColor: 0x53c7ff,
    stripeColor: 0xffe3f2,
    finColor: 0x2f9fe0,
  },
  {
    key: 'puffer',
    name: 'Pufferfish',
    baseScore: 20,
    size: 3.6,
    bodyColor: 0xffe066,
    stripeColor: 0xfff8d9,
    finColor: 0xe0b400,
  },
  {
    key: 'angel',
    name: 'Angelfish',
    baseScore: 18,
    size: 4.1,
    bodyColor: 0xffd6e8,
    stripeColor: 0x9b59b6,
    finColor: 0xff8fc7,
  },
  {
    key: 'ray',
    name: 'Manta Ray',
    baseScore: 25,
    size: 4.2,
    bodyColor: 0x5b6ee1,
    stripeColor: 0x8fa1ff,
    finColor: 0x3d4bb0,
  },
];

export const OCTOPUS_BONUS = {
  key: 'octopus',
  name: 'Octopus',
  bonusScore: 50,
  size: 3.6,
  bodyColor: 0xb570ff,
  stripeColor: 0xe6cbff,
  finColor: 0x8a3fe0,
};

// Per-fish cut target: random 10%-50% in 5% steps (the smaller piece's area
// can never exceed 50% of the whole fish, by definition).
export const TARGET_PERCENT_MIN = 10;
export const TARGET_PERCENT_MAX = 50;
export const TARGET_PERCENT_STEP = 5;

export const TARGET_PERCENT_OPTIONS = [];
for (let p = TARGET_PERCENT_MIN; p <= TARGET_PERCENT_MAX; p += TARGET_PERCENT_STEP) {
  TARGET_PERCENT_OPTIONS.push(p);
}

export const FISH_CUT_TIME_LIMIT = 5; // seconds to slice each fish
export const ROUND_TIME_LIMIT = 60; // overall level time limit, seconds

export function snapToGrid(value, step = TARGET_PERCENT_STEP) {
  return Math.round(value / step) * step;
}

// Closer to the target percentage => higher score. diff is always a multiple
// of TARGET_PERCENT_STEP (0, 5, 10, ... up to 50).
export function scoreForDiff(diff) {
  return Math.max(5, Math.round(100 - diff * 2.2));
}

export function getFishType(key) {
  return CUT_FISH_TYPES.find((f) => f.key === key);
}

// --- Difficulty stages -----------------------------------------------------
// As a round's elapsed time grows, later fish get harder: they drift on a
// "current" (a slow, steady sideways push, distinct from the fish's own
// idle bob), the ring countdown shortens a little, and cuts must be faster.
// Stage is picked from elapsed seconds into the round.
export const DIFFICULTY_STAGES = [
  { minElapsed: 0, label: 'Calm Water', windAmplitude: 0, windSpeed: 0, cutTimeLimit: 5.0, bandColor: 0x2fbf71 },
  { minElapsed: 18, label: 'Light Current', windAmplitude: 26, windSpeed: 1.6, cutTimeLimit: 4.5, bandColor: 0x53c7ff },
  { minElapsed: 36, label: 'Strong Current', windAmplitude: 48, windSpeed: 2.4, cutTimeLimit: 4.0, bandColor: 0xffd23f },
  { minElapsed: 52, label: 'Riptide!', windAmplitude: 74, windSpeed: 3.2, cutTimeLimit: 3.5, bandColor: 0xff5a5a },
];

// --- Combo -----------------------------------------------------------------
// Landing a cut within COMBO_KEEP_DIFF of the target keeps the streak alive;
// anything sloppier (or a fish that times out) drops it back to zero. The
// multiplier is what makes a streak worth protecting, so it is capped — an
// uncapped one would make the last ten seconds of a good run dwarf everything
// before it.
export const COMBO_KEEP_DIFF = TARGET_PERCENT_STEP; // Perfect or one bucket off
export const COMBO_MIN_TO_SHOW = 2;
export const COMBO_STEP_BONUS = 0.15;
export const COMBO_MAX_MULTIPLIER = 2.5;

export function comboMultiplier(comboCount) {
  if (comboCount < COMBO_MIN_TO_SHOW) return 1;
  return Math.min(COMBO_MAX_MULTIPLIER, 1 + (comboCount - 1) * COMBO_STEP_BONUS);
}

export function getStageForElapsed(elapsedSeconds) {
  let stage = DIFFICULTY_STAGES[0];
  for (const s of DIFFICULTY_STAGES) {
    if (elapsedSeconds >= s.minElapsed) stage = s;
  }
  return stage;
}
