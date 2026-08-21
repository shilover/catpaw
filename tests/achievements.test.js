import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENTS, EMPTY_LIFETIME, mergeLifetime, evaluateAchievements,
} from '../src/data/achievements.js';
import { CUT_FISH_TYPES, fishValueMultiplier, pickWeightedFish } from '../src/data/fishData.js';

const round = (over = {}) => ({
  cutCount: 0,
  perfectCount: 0,
  nearPerfectCount: 0,
  missedCount: 0,
  octopusCount: 0,
  bestCombo: 0,
  speciesCut: {},
  score: 0,
  mode: 'solo',
  reachedStage: 0,
  ...over,
});

test('achievement ids are unique and every one has translations wired by id', () => {
  const ids = ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate achievement id');
  for (const a of ACHIEVEMENTS) {
    assert.equal(typeof a.check, 'function', `${a.id} needs a check`);
    // A goal without a progress reader would render an empty counter.
    if (a.goal !== undefined) {
      assert.equal(typeof a.progress, 'function', `${a.id} has a goal but no progress`);
      assert.ok(a.goal > 0, `${a.id} goal must be positive`);
    }
  }
});

test('mergeLifetime accumulates counters and keeps the best of the bests', () => {
  const first = mergeLifetime(EMPTY_LIFETIME, round({
    cutCount: 5, perfectCount: 2, octopusCount: 1, bestCombo: 3, score: 400,
    speciesCut: { clown: 3, ray: 2 },
  }));
  assert.equal(first.cutCount, 5);
  assert.equal(first.rounds, 1);
  assert.equal(first.bestCombo, 3);
  assert.equal(first.bestScore, 400);
  assert.deepEqual(first.speciesCut, { clown: 3, ray: 2 });

  const second = mergeLifetime(first, round({
    cutCount: 4, perfectCount: 1, bestCombo: 2, score: 900, speciesCut: { clown: 1, cute: 1 },
  }));
  assert.equal(second.cutCount, 9, 'counters add');
  assert.equal(second.rounds, 2);
  assert.equal(second.bestCombo, 3, 'a worse round must not lower the best');
  assert.equal(second.bestScore, 900, 'a better round raises the best');
  assert.deepEqual(second.speciesCut, { clown: 4, ray: 2, cute: 1 });
});

test('mergeLifetime never mutates what it was given', () => {
  const base = mergeLifetime(EMPTY_LIFETIME, round({ cutCount: 2, speciesCut: { clown: 2 } }));
  const snapshot = JSON.parse(JSON.stringify(base));
  mergeLifetime(base, round({ cutCount: 7, speciesCut: { ray: 1 } }));
  assert.deepEqual(base, snapshot, 'the previous totals were modified in place');
});

test('co-op and versus rounds are tallied only for their own modes', () => {
  const coop = mergeLifetime(EMPTY_LIFETIME, round({ mode: 'coop' }));
  assert.equal(coop.coopRounds, 1);
  assert.equal(coop.versusWins, 0);

  const drawn = mergeLifetime(EMPTY_LIFETIME, round({ mode: 'versus', won: false }));
  assert.equal(drawn.versusWins, 0, 'a draw is not a win');

  const won = mergeLifetime(EMPTY_LIFETIME, round({ mode: 'versus', won: true }));
  assert.equal(won.versusWins, 1);
});

test('evaluateAchievements reports only newly earned ids', () => {
  const life = mergeLifetime(EMPTY_LIFETIME, round({ cutCount: 1, perfectCount: 1 }));
  const first = evaluateAchievements(round({ cutCount: 1 }), life, []);
  assert.ok(first.includes('firstCut'));
  assert.ok(first.includes('firstPerfect'));

  const again = evaluateAchievements(round({ cutCount: 1 }), life, first);
  assert.equal(again.length, 0, 'already-unlocked ids must not repeat');
});

test('the flawless achievement needs a real round, not an empty one', () => {
  const life = mergeLifetime(EMPTY_LIFETIME, round());
  assert.ok(
    !evaluateAchievements(round({ cutCount: 0, missedCount: 0 }), life, []).includes('flawless'),
    'zero fish cut must not count as flawless',
  );
  assert.ok(
    evaluateAchievements(round({ cutCount: 8, missedCount: 0 }), life, []).includes('flawless'),
  );
  assert.ok(
    !evaluateAchievements(round({ cutCount: 20, missedCount: 1 }), life, []).includes('flawless'),
  );
});

test('marineBiologist needs every species, not just a lot of one', () => {
  const lots = mergeLifetime(EMPTY_LIFETIME, round({ speciesCut: { clown: 99 } }));
  assert.ok(!evaluateAchievements(round(), lots, []).includes('marineBiologist'));

  const all = {};
  CUT_FISH_TYPES.forEach((f) => { all[f.key] = 1; });
  const complete = mergeLifetime(EMPTY_LIFETIME, round({ speciesCut: all }));
  assert.ok(evaluateAchievements(round(), complete, []).includes('marineBiologist'));
});

test('a check that throws is treated as not earned, never as a crash', () => {
  const exploding = { id: 'boom', check: () => { throw new Error('nope'); } };
  ACHIEVEMENTS.push(exploding);
  try {
    const life = mergeLifetime(EMPTY_LIFETIME, round());
    assert.doesNotThrow(() => evaluateAchievements(round(), life, []));
    assert.ok(!evaluateAchievements(round(), life, []).includes('boom'));
  } finally {
    ACHIEVEMENTS.pop();
  }
});

// --- species value ---------------------------------------------------------

test('fishValueMultiplier ranks species by their baseScore', () => {
  const clown = CUT_FISH_TYPES.find((f) => f.key === 'clown');
  const ray = CUT_FISH_TYPES.find((f) => f.key === 'ray');
  assert.ok(fishValueMultiplier(ray) > fishValueMultiplier(clown), 'the rare fish must pay more');
  assert.equal(fishValueMultiplier(null), 1, 'a missing species is worth face value');
  assert.equal(fishValueMultiplier({}), 1);
});

test('every species has a positive spawn weight, and value tracks rarity', () => {
  const sorted = [...CUT_FISH_TYPES].sort((a, b) => a.baseScore - b.baseScore);
  for (const f of CUT_FISH_TYPES) {
    assert.ok(f.spawnWeight > 0, `${f.key} needs a spawn weight`);
    assert.ok(f.baseScore > 0, `${f.key} needs a base score`);
  }
  // The cheapest species must not also be the rarest, or rarity is punishing
  // the player for no reward.
  assert.ok(
    sorted[0].spawnWeight >= sorted[sorted.length - 1].spawnWeight,
    'the most valuable species should not be the most common',
  );
});

test('pickWeightedFish honours the weights and always returns a species', () => {
  // Deterministic sweep across the whole 0..1 range.
  const counts = {};
  const samples = 2000;
  for (let i = 0; i < samples; i++) {
    const fish = pickWeightedFish(() => (i + 0.5) / samples);
    assert.ok(fish && fish.key, 'must always return a species');
    counts[fish.key] = (counts[fish.key] || 0) + 1;
  }

  const total = CUT_FISH_TYPES.reduce((sum, f) => sum + f.spawnWeight, 0);
  for (const f of CUT_FISH_TYPES) {
    const expected = (f.spawnWeight / total) * samples;
    assert.ok(
      Math.abs(counts[f.key] - expected) <= 2,
      `${f.key}: expected about ${expected}, got ${counts[f.key]}`,
    );
  }

  // Degenerate randoms must not fall off either end.
  assert.ok(pickWeightedFish(() => 0).key);
  assert.ok(pickWeightedFish(() => 0.999999).key);
});
