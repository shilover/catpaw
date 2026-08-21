import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS, TOTAL_STARS, getLevel, starsFor, isLevelUnlocked,
} from '../src/data/levels.js';
import {
  CUT_FISH_TYPES, bodyRadii, bodyAspect, speciesByKeys, pickWeightedFish,
} from '../src/data/fishData.js';

// --- body shape ------------------------------------------------------------
// Level 2 only exists because species differ in shape. If that ever collapses
// back to one ellipse, the level silently becomes level 1 again.

test('species have genuinely different body shapes', () => {
  const aspects = CUT_FISH_TYPES.map(bodyAspect);
  const min = Math.min(...aspects);
  const max = Math.max(...aspects);
  assert.ok(max / min >= 1.8, `aspect spread is only ${(max / min).toFixed(2)}x`);
  // At least one clearly taller than wide, and one clearly wider than tall.
  assert.ok(min < 0.9, 'no portrait species');
  assert.ok(max > 1.5, 'no landscape species');
});

test('body shapes differ but their areas do not', () => {
  // Otherwise level 2 would be testing fish size, not fish shape: a bigger
  // fish is simply easier to cut accurately.
  const areas = CUT_FISH_TYPES.map((f) => {
    const { rx, ry } = bodyRadii(f);
    return Math.PI * rx * ry;
  });
  const min = Math.min(...areas);
  const max = Math.max(...areas);
  assert.ok(max / min <= 1.06, `area spread is ${(max / min).toFixed(3)}x — too uneven`);
});

test('bodyRadii scales with size and falls back safely', () => {
  const fish = CUT_FISH_TYPES[0];
  const single = bodyRadii({ ...fish, size: 1 });
  const double = bodyRadii({ ...fish, size: 2 });
  assert.ok(Math.abs(double.rx - single.rx * 2) < 1e-9);
  assert.ok(Math.abs(double.ry - single.ry * 2) < 1e-9);

  // A species without explicit dimensions still gets a usable ellipse.
  const fallback = bodyRadii({ size: 1 });
  assert.ok(fallback.rx > 0 && fallback.ry > 0);
});

test('speciesByKeys filters, and degrades to the full cast on bad input', () => {
  assert.deepEqual(speciesByKeys(['ray']).map((f) => f.key), ['ray']);
  assert.equal(speciesByKeys([]).length, CUT_FISH_TYPES.length);
  assert.equal(speciesByKeys(null).length, CUT_FISH_TYPES.length);
  assert.equal(speciesByKeys(['nope']).length, CUT_FISH_TYPES.length, 'unknown keys must not empty the pool');
});

test('pickWeightedFish honours a restricted pool', () => {
  const pool = speciesByKeys(['puffer']);
  for (let i = 0; i < 50; i++) {
    assert.equal(pickWeightedFish(() => i / 50, pool).key, 'puffer');
  }
});

// --- level table -----------------------------------------------------------

test('there is exactly one level per skill, with no duplicates', () => {
  const ids = LEVELS.map((l) => l.id);
  const skills = LEVELS.map((l) => l.skill);
  assert.equal(new Set(ids).size, ids.length, 'duplicate level id');
  assert.equal(new Set(skills).size, skills.length, 'two levels testing the same skill');
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b), 'ids must be in order');
  assert.equal(TOTAL_STARS, LEVELS.length * 3);
});

test('every level is fully specified and internally consistent', () => {
  const seeds = new Set();
  for (const level of LEVELS) {
    assert.ok(level.duration >= 30, `level ${level.id} is too short to judge`);
    assert.ok(!seeds.has(level.seed), `level ${level.id} reuses a seed`);
    seeds.add(level.seed);

    const { metric, values } = level.stars;
    assert.ok(['score', 'bestCombo'].includes(metric), `level ${level.id} bad metric`);
    assert.equal(values.length, 3, `level ${level.id} needs three thresholds`);
    for (let i = 1; i < values.length; i++) {
      assert.ok(values[i] > values[i - 1], `level ${level.id} thresholds must ascend`);
    }

    const { rules } = level;
    assert.ok(rules.targets && rules.targets.length, `level ${level.id} has no targets`);
    for (const target of rules.targets) {
      assert.ok(target >= 10 && target <= 50, `level ${level.id} target ${target} out of range`);
      assert.equal(target % 5, 0, `level ${level.id} target ${target} is off-grid`);
    }
    // Restricted casts must name species that actually exist.
    if (rules.species) {
      for (const key of rules.species) {
        assert.ok(CUT_FISH_TYPES.some((f) => f.key === key), `level ${level.id} unknown species ${key}`);
      }
    }
    assert.ok(rules.cutTime > 0, `level ${level.id} needs a cut time`);
  }
});

test('the shape level actually rotates through every species', () => {
  const shape = LEVELS.find((l) => l.skill === 'shape');
  assert.ok(shape.rules.cycleSpecies, 'shape level must cycle, not roll dice');
  assert.equal(shape.rules.species.length, CUT_FISH_TYPES.length, 'shape level must use every species');
  assert.equal(shape.rules.targets.length, 1, 'shape level must hold the target fixed');
});

test('the angle level demands an angle, and nothing else does', () => {
  const withAngle = LEVELS.filter((l) => l.rules.cutAngle);
  assert.equal(withAngle.length, 1, 'exactly one level should be about angle');
  assert.equal(withAngle[0].skill, 'angle');
  assert.ok(withAngle[0].rules.cutAngle.tolerance > 0);
});

test('each level turns up its own dial and leaves the rest alone', () => {
  const byName = Object.fromEntries(LEVELS.map((l) => [l.skill, l.rules]));
  // The current level should have the strongest current...
  const currents = LEVELS.map((l) => (l.rules.wind ? l.rules.wind.amplitude : 0));
  assert.equal(Math.max(...currents), byName.current.wind.amplitude, 'current level is not the windiest');
  // ...the speed level the shortest clock...
  const times = LEVELS.map((l) => l.rules.cutTime);
  assert.equal(Math.min(...times), byName.speed.cutTime, 'speed level is not the fastest');
  // ...and the margin level the smallest fish.
  assert.ok(byName.margin.fishScale && byName.margin.fishScale < 1, 'margin level needs small fish');
  const scaled = LEVELS.filter((l) => l.rules.fishScale && l.rules.fishScale !== 1);
  assert.equal(scaled.length, 1, 'only the margin level should resize fish');
  // The precision level must be the clean baseline: no current, no angle rule.
  assert.equal(byName.precision.wind.amplitude, 0);
  assert.ok(!byName.precision.cutAngle);
});

// --- stars and unlocking ---------------------------------------------------

test('starsFor counts thresholds reached, on the level metric', () => {
  const scoreLevel = LEVELS.find((l) => l.stars.metric === 'score');
  const [one, two, three] = scoreLevel.stars.values;
  assert.equal(starsFor(scoreLevel, { score: one - 1 }), 0);
  assert.equal(starsFor(scoreLevel, { score: one }), 1);
  assert.equal(starsFor(scoreLevel, { score: two }), 2);
  assert.equal(starsFor(scoreLevel, { score: three + 5000 }), 3);

  const comboLevel = LEVELS.find((l) => l.stars.metric === 'bestCombo');
  assert.ok(comboLevel, 'one level should be scored on consistency');
  // A huge score must not earn stars on a combo level.
  assert.equal(starsFor(comboLevel, { score: 99999, bestCombo: 0 }), 0);
  assert.equal(starsFor(comboLevel, { bestCombo: comboLevel.stars.values[2] }), 3);
});

test('starsFor is safe on missing data', () => {
  assert.equal(starsFor(null, { score: 100 }), 0);
  assert.equal(starsFor(LEVELS[0], {}), 0);
});

test('levels unlock one at a time, and one star is enough', () => {
  assert.ok(isLevelUnlocked(1, {}), 'the first level is always open');
  assert.ok(!isLevelUnlocked(2, {}), 'later levels start closed');
  assert.ok(!isLevelUnlocked(2, { 1: 0 }), 'a played-but-failed level does not unlock the next');
  assert.ok(isLevelUnlocked(2, { 1: 1 }), 'one star opens the next level');
  assert.ok(!isLevelUnlocked(3, { 1: 3 }), 'clearing level 1 must not skip level 2');
  assert.ok(isLevelUnlocked(3, { 1: 3, 2: 1 }));
});

test('getLevel finds real levels and refuses invented ones', () => {
  assert.equal(getLevel(1).id, 1);
  assert.equal(getLevel(LEVELS.length).id, LEVELS.length);
  assert.equal(getLevel(0), null);
  assert.equal(getLevel(99), null);
});
