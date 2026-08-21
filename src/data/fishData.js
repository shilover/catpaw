// Mirrors DT_FishList / FIshStruct rows (Name, Score, Size) for the
// "cuttable" species — the octopus (DT_BounsList) is reserved for the
// perfect-cut bonus pop-up, not a regular target.

export const CUT_FISH_TYPES = [
  {
    key: 'clown',
    spawnWeight: 10,
    name: 'Clownfish',
    baseScore: 10,
    size: 4.0,
    bodyColor: 0xff7a29,
    stripeColor: 0xffffff,
    finColor: 0xff5a00,
  },
  {
    key: 'cute',
    spawnWeight: 7,
    name: 'CuteFish',
    baseScore: 15,
    size: 3.8,
    bodyColor: 0x53c7ff,
    stripeColor: 0xffe3f2,
    finColor: 0x2f9fe0,
  },
  {
    key: 'puffer',
    spawnWeight: 5,
    name: 'Pufferfish',
    baseScore: 20,
    size: 3.6,
    bodyColor: 0xffe066,
    stripeColor: 0xfff8d9,
    finColor: 0xe0b400,
  },
  {
    key: 'angel',
    spawnWeight: 5,
    name: 'Angelfish',
    baseScore: 18,
    size: 4.1,
    bodyColor: 0xffd6e8,
    stripeColor: 0x9b59b6,
    finColor: 0xff8fc7,
  },
  {
    key: 'ray',
    spawnWeight: 3,
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
// --- Species value ---------------------------------------------------------
// `baseScore` is what a species is worth relative to the others. It is turned
// into a multiplier against a reference so the numbers on screen stay in the
// range players are used to, instead of a Manta Ray paying 2.5x a Clownfish for
// the same cut. Rarity is the other half of the trade: see `spawnWeight` above,
// where the valuable species are deliberately scarcer.
export const FISH_VALUE_REFERENCE = 15;

export function fishValueMultiplier(fishType) {
  if (!fishType || !fishType.baseScore) return 1;
  return fishType.baseScore / FISH_VALUE_REFERENCE;
}

// Weighted pick, so rarity actually means something. `random` is injectable to
// keep this testable.
export function pickWeightedFish(random = Math.random) {
  const total = CUT_FISH_TYPES.reduce((sum, f) => sum + (f.spawnWeight || 1), 0);
  let roll = random() * total;
  for (const fish of CUT_FISH_TYPES) {
    roll -= (fish.spawnWeight || 1);
    if (roll < 0) return fish;
  }
  return CUT_FISH_TYPES[CUT_FISH_TYPES.length - 1];
}

export const TARGET_PERCENT_MIN = 10;
export const TARGET_PERCENT_MAX = 50;
export const TARGET_PERCENT_STEP = 5;

export const TARGET_PERCENT_OPTIONS = [];
for (let p = TARGET_PERCENT_MIN; p <= TARGET_PERCENT_MAX; p += TARGET_PERCENT_STEP) {
  TARGET_PERCENT_OPTIONS.push(p);
}

export const FISH_CUT_TIME_LIMIT = 5; // seconds to slice each fish
export const ROUND_TIME_LIMIT = 60; // overall level time limit, seconds

// --- Pacing ---------------------------------------------------------------
// How long the game sits still between one fish being resolved and the next
// appearing. This used to total a full second (700ms + 300ms), which at roughly
// twenty fish a round meant a third of the round was spent waiting. The result
// popup now overlaps the next fish instead of queueing behind it.
export const CUT_SETTLE_MS = 260;
export const NEXT_FISH_DELAY_MS = 140;
// Co-op resolves both halves off one cut, so it holds fractionally longer to let
// the shared result register on both sides.
export const COOP_ADVANCE_MS = 420;
export const COOP_MISS_ADVANCE_MS = 460;

// --- Teaching -------------------------------------------------------------
// How many lifetime cuts the ideal-cut line keeps showing for on 'auto'. Long
// enough to internalise what a given percentage looks like, short enough that
// it stops being scenery.
export const GUIDE_AUTO_CUTS = 30;

// --- Impact ---------------------------------------------------------------
// A perfect cut is the moment the whole game is built around, so it gets a beat
// of frozen time and a camera kick. Ordinary cuts get neither — if everything
// punches, nothing does.
export const PERFECT_HIT_STOP_MS = 55;
export const PERFECT_SHAKE_MS = 90;
export const PERFECT_SHAKE_INTENSITY = 0.005;
export const CUT_SCRAP_COUNT = 9;
export const PERFECT_SCRAP_COUNT = 16;

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
  { minElapsed: 0, labelKey: 'stageCalm', windAmplitude: 0, windSpeed: 0, cutTimeLimit: 5.0, bandColor: 0x2fbf71 },
  { minElapsed: 14, labelKey: 'stageLight', windAmplitude: 26, windSpeed: 1.6, cutTimeLimit: 4.5, bandColor: 0x53c7ff },
  { minElapsed: 30, labelKey: 'stageStrong', windAmplitude: 48, windSpeed: 2.4, cutTimeLimit: 4.0, bandColor: 0xffd23f },
  { minElapsed: 45, labelKey: 'stageRiptide', windAmplitude: 74, windSpeed: 3.2, cutTimeLimit: 3.5, bandColor: 0xff5a5a },
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
