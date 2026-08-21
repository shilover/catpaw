import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUT_FISH_TYPES,
  OCTOPUS_BONUS,
  TARGET_PERCENT_OPTIONS,
  TARGET_PERCENT_MIN,
  TARGET_PERCENT_MAX,
  TARGET_PERCENT_STEP,
  snapToGrid,
  scoreForDiff,
  getStageForElapsed,
  comboMultiplier,
  COMBO_MIN_TO_SHOW,
  COMBO_MAX_MULTIPLIER,
  DIFFICULTY_STAGES,
  ROUND_TIME_LIMIT,
} from '../src/data/fishData.js';

// fishData holds every tunable number in the game and no Phaser code, so the
// rules it encodes can be checked directly.

test('every target option is on the 5% grid and inside the legal range', () => {
  assert.ok(TARGET_PERCENT_OPTIONS.length > 0);
  for (const p of TARGET_PERCENT_OPTIONS) {
    assert.equal(p % TARGET_PERCENT_STEP, 0, `${p} is off-grid`);
    assert.ok(p >= TARGET_PERCENT_MIN && p <= TARGET_PERCENT_MAX, `${p} out of range`);
  }
  // The smaller of two pieces can never exceed half the fish.
  assert.ok(TARGET_PERCENT_MAX <= 50);
});

test('snapToGrid rounds to the nearest bucket', () => {
  assert.equal(snapToGrid(0), 0);
  assert.equal(snapToGrid(12), 10);
  assert.equal(snapToGrid(12.5), 15);
  assert.equal(snapToGrid(13), 15);
  assert.equal(snapToGrid(47.4), 45);
});

test('scoreForDiff peaks on an exact hit and never drops below the floor', () => {
  assert.equal(scoreForDiff(0), 100);
  // Monotonically worse as the cut drifts from the target.
  let previous = scoreForDiff(0);
  for (let diff = TARGET_PERCENT_STEP; diff <= 50; diff += TARGET_PERCENT_STEP) {
    const current = scoreForDiff(diff);
    assert.ok(current <= previous, `score must not rise at diff ${diff}`);
    assert.ok(current >= 5, `score floor breached at diff ${diff}`);
    previous = current;
  }
  // The worst possible miss still pays the floor rather than zero or negative.
  assert.equal(scoreForDiff(50), 5);
});

test('difficulty stages are ordered and monotonically harsher', () => {
  for (let i = 1; i < DIFFICULTY_STAGES.length; i++) {
    const prev = DIFFICULTY_STAGES[i - 1];
    const stage = DIFFICULTY_STAGES[i];
    assert.ok(stage.minElapsed > prev.minElapsed, 'stages must be in time order');
    assert.ok(stage.windAmplitude >= prev.windAmplitude, 'current must not weaken');
    assert.ok(stage.cutTimeLimit <= prev.cutTimeLimit, 'time limit must not grow');
  }
  // Every stage has to be reachable inside a round, or it is dead config.
  const last = DIFFICULTY_STAGES[DIFFICULTY_STAGES.length - 1];
  assert.ok(last.minElapsed < ROUND_TIME_LIMIT, 'final stage never triggers');
});

test('getStageForElapsed picks the last stage whose threshold has passed', () => {
  assert.equal(getStageForElapsed(0), DIFFICULTY_STAGES[0]);
  assert.equal(getStageForElapsed(-5), DIFFICULTY_STAGES[0], 'clamps below zero');

  for (const stage of DIFFICULTY_STAGES) {
    assert.equal(getStageForElapsed(stage.minElapsed), stage, `at ${stage.minElapsed}s`);
    assert.equal(getStageForElapsed(stage.minElapsed + 0.5), stage, `just after ${stage.minElapsed}s`);
  }
  const last = DIFFICULTY_STAGES[DIFFICULTY_STAGES.length - 1];
  assert.equal(getStageForElapsed(9999), last, 'stays on the last stage');
});

test('comboMultiplier only kicks in once a streak is real, and is capped', () => {
  assert.equal(comboMultiplier(0), 1);
  assert.equal(comboMultiplier(1), 1, 'a single cut is not a combo');
  assert.ok(comboMultiplier(COMBO_MIN_TO_SHOW) > 1, 'the first real combo pays');

  let previous = comboMultiplier(COMBO_MIN_TO_SHOW);
  for (let combo = COMBO_MIN_TO_SHOW + 1; combo <= 60; combo++) {
    const current = comboMultiplier(combo);
    assert.ok(current >= previous, `multiplier must not fall at ${combo}`);
    assert.ok(current <= COMBO_MAX_MULTIPLIER, `cap breached at ${combo}`);
    previous = current;
  }
  assert.equal(comboMultiplier(1000), COMBO_MAX_MULTIPLIER, 'saturates at the cap');
});

test('fish definitions are complete and uniquely keyed', () => {
  const keys = new Set();
  for (const fish of CUT_FISH_TYPES) {
    assert.ok(fish.key, 'fish needs a key');
    assert.ok(!keys.has(fish.key), `duplicate fish key ${fish.key}`);
    keys.add(fish.key);
    assert.ok(fish.size > 0, `${fish.key} needs a positive size`);
    assert.equal(typeof fish.name, 'string');
    for (const colour of ['bodyColor', 'stripeColor', 'finColor']) {
      assert.equal(typeof fish[colour], 'number', `${fish.key}.${colour}`);
    }
  }
  assert.ok(!keys.has(OCTOPUS_BONUS.key), 'the octopus is a bonus, not a cuttable fish');
  assert.ok(OCTOPUS_BONUS.bonusScore > 0);
});
