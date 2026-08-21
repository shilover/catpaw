import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeSeededRandom, dailyKey, seedFromKey, dailySeed, randomInt, randomFloat, pickRandom,
} from '../src/utils/random.js';
import {
  DIFFICULTY_STAGES, ROUND_TIME_LIMIT, CUT_SETTLE_MS, NEXT_FISH_DELAY_MS,
  COOP_ADVANCE_MS, TARGET_PERCENT_OPTIONS,
} from '../src/data/fishData.js';

// The Daily Challenge rests entirely on this: same seed, same round, for
// everybody, everywhere.

test('the same seed always replays the same sequence', () => {
  const a = makeSeededRandom(12345);
  const b = makeSeededRandom(12345);
  for (let i = 0; i < 500; i++) {
    assert.equal(a(), b(), `diverged at draw ${i}`);
  }
});

test('different seeds give different sequences', () => {
  const a = makeSeededRandom(1);
  const b = makeSeededRandom(2);
  const left = Array.from({ length: 40 }, a);
  const right = Array.from({ length: 40 }, b);
  assert.notDeepEqual(left, right);
});

test('output stays inside [0, 1) across a long run', () => {
  const random = makeSeededRandom(99);
  let min = 1;
  let max = 0;
  for (let i = 0; i < 20000; i++) {
    const v = random();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  // A generator stuck in a corner of the range would break spawn placement.
  assert.ok(min < 0.01 && max > 0.99, `poor spread: ${min}..${max}`);
});

test('a seed of zero still produces a usable generator', () => {
  const random = makeSeededRandom(0);
  const draws = Array.from({ length: 10 }, random);
  assert.ok(draws.every((v) => v >= 0 && v < 1));
  assert.ok(new Set(draws).size > 1, 'must not emit a constant');
});

test('dailyKey formats the local date, zero-padded', () => {
  assert.equal(dailyKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(dailyKey(new Date(2026, 11, 31)), '2026-12-31');
});

test('the seed is stable for a day and changes between days', () => {
  const morning = dailySeed(new Date(2026, 7, 21, 0, 0, 1));
  const evening = dailySeed(new Date(2026, 7, 21, 23, 59, 59));
  assert.equal(morning, evening, 'the challenge must not change mid-day');
  assert.notEqual(morning, dailySeed(new Date(2026, 7, 22, 12, 0, 0)));
});

test('seedFromKey is deterministic and fits in 32 unsigned bits', () => {
  assert.equal(seedFromKey('2026-08-21'), seedFromKey('2026-08-21'));
  const seed = seedFromKey('2026-08-21');
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
});

test('randomInt covers its inclusive bounds and never escapes them', () => {
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const v = randomInt(() => i / 400, 3, 7);
    assert.ok(v >= 3 && v <= 7, `escaped: ${v}`);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [3, 4, 5, 6, 7], 'both ends must be reachable');
  assert.equal(randomInt(() => 0, 5, 5), 5, 'a single-value range is allowed');
});

test('randomFloat and pickRandom stay in range', () => {
  assert.equal(randomFloat(() => 0, 2, 6), 2);
  assert.ok(randomFloat(() => 0.999999, 2, 6) < 6);
  assert.equal(pickRandom(() => 0, TARGET_PERCENT_OPTIONS), TARGET_PERCENT_OPTIONS[0]);
  const last = TARGET_PERCENT_OPTIONS[TARGET_PERCENT_OPTIONS.length - 1];
  assert.equal(pickRandom(() => 0.999999, TARGET_PERCENT_OPTIONS), last);
});

// --- pacing ---------------------------------------------------------------

test('the gap between fish is short enough not to eat the round', () => {
  const gap = CUT_SETTLE_MS + NEXT_FISH_DELAY_MS;
  assert.ok(gap > 0, 'some settle time is needed to read the result');
  // At roughly one fish every few seconds, a full second of dead air was a
  // third of the round. Keep it well under half a second.
  assert.ok(gap <= 500, `dead time between fish is ${gap}ms`);
  assert.ok(COOP_ADVANCE_MS >= gap, 'co-op must not advance before a solo lane would');
});

test('every difficulty stage gets meaningful time in a round', () => {
  const last = DIFFICULTY_STAGES[DIFFICULTY_STAGES.length - 1];
  assert.ok(
    ROUND_TIME_LIMIT - last.minElapsed >= 12,
    `the hardest stage only lasts ${ROUND_TIME_LIMIT - last.minElapsed}s`,
  );
  // No stage should be a blink either.
  for (let i = 1; i < DIFFICULTY_STAGES.length; i++) {
    const span = DIFFICULTY_STAGES[i].minElapsed - DIFFICULTY_STAGES[i - 1].minElapsed;
    assert.ok(span >= 10, `stage ${i - 1} only lasts ${span}s`);
  }
});
