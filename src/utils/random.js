// Seeded randomness, so a run can be reproduced exactly.
//
// The Daily Challenge needs every player to get the same fish, in the same
// order, at the same places — which is only possible if the numbers driving the
// round come from a seed rather than Math.random(). Everything that shapes the
// *challenge* draws from here; purely cosmetic jitter (debris spin, bubbles)
// does not, because it does not change what the player is asked to do.

// mulberry32: small, fast, and good enough for gameplay. Same seed in, same
// sequence out, on every browser.
export function makeSeededRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The date, as YYYY-MM-DD in the player's own timezone. Local rather than UTC
// so "today's challenge" changes at the player's midnight, which is the one
// they actually experience.
export function dailyKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Stable 32-bit hash of the date string, used as the day's seed.
export function seedFromKey(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dailySeed(date = new Date()) {
  return seedFromKey(dailyKey(date));
}

// Integer in [min, max], matching Phaser.Math.Between's inclusive range, but
// drawing from an injectable source.
export function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function randomFloat(random, min, max) {
  return random() * (max - min) + min;
}

export function pickRandom(random, list) {
  return list[Math.floor(random() * list.length)];
}
