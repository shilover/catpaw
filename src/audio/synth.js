// Procedural sound synthesis.
//
// The whole game draws its own art at boot rather than shipping assets, and the
// audio follows the same rule: every sound here is rendered into an AudioBuffer
// at startup from a handful of oscillators and noise bursts. No files, no
// loader, no licensing questions — and the cast is small enough that the whole
// set renders in a few milliseconds.
//
// Buffers are created on the Sound Manager's own AudioContext and handed to
// Phaser's audio cache, so playback goes through `this.sound` and inherits its
// mute/volume handling and its browser-autoplay unlocking.

// --- building blocks ------------------------------------------------------

// `rate` may be lower than the context's own; the browser resamples on
// playback. That matters for the music bed, which is eight seconds long and was
// costing more to synthesise than everything else put together.
function render(ctx, seconds, fill, rate = ctx.sampleRate) {
  const length = Math.max(1, Math.floor(seconds * rate));
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = fill(i / rate, i / length);
  }
  return buffer;
}

// Exponential-ish decay, the shape most percussive sounds want.
function decay(progress, power = 4) {
  return Math.pow(1 - progress, power);
}

// A short fade at both ends: without it a buffer that starts or stops
// mid-waveform produces an audible click.
function edges(progress, fade = 0.02) {
  const inFade = Math.min(1, progress / fade);
  const outFade = Math.min(1, (1 - progress) / fade);
  return Math.min(inFade, outFade);
}

// Deterministic value noise, so a given sound is identical every run.
function noise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state / 0x7fffffff) - 1;
  };
}

function sine(t, freq) {
  return Math.sin(2 * Math.PI * freq * t);
}

// A cheap one-pole low-pass, applied per sample as the buffer is filled.
function lowpass(alpha) {
  let previous = 0;
  return (sample) => {
    previous += alpha * (sample - previous);
    return previous;
  };
}

// --- the cast -------------------------------------------------------------

// Blade whoosh: filtered noise sweeping from bright to dull.
function makeSwipe(ctx) {
  const rand = noise(11);
  const filter = lowpass(0.28);
  return render(ctx, 0.18, (t, p) => filter(rand()) * decay(p, 3) * edges(p) * 0.28);
}

// The cut itself: a noise transient over a quick downward tone.
function makeCut(ctx) {
  const rand = noise(23);
  const filter = lowpass(0.5);
  return render(ctx, 0.26, (t, p) => {
    const body = sine(t, 420 - 260 * p) * 0.5;
    const grit = filter(rand()) * decay(p, 8) * 0.6;
    return (body * decay(p, 5) + grit) * edges(p) * 0.42;
  });
}

// Perfect cut: a bright major triad that rings out.
function makePerfect(ctx) {
  const partials = [784, 988, 1175, 1568];
  return render(ctx, 0.62, (t, p) => {
    let sum = 0;
    partials.forEach((f, i) => {
      // Stagger the entries so it reads as an arpeggio, not a stab.
      const start = i * 0.045;
      if (t < start) return;
      sum += sine(t - start, f) * decay((t - start) / 0.5, 3);
    });
    return (sum / partials.length) * edges(p) * 0.5;
  });
}

// Bonus octopus collected: a quick upward blip.
function makeBonus(ctx) {
  return render(ctx, 0.3, (t, p) => {
    const freq = 520 + 760 * p * p;
    return (sine(t, freq) * 0.7 + sine(t, freq * 2) * 0.3) * decay(p, 3) * edges(p) * 0.4;
  });
}

// Missed fish: a dull descending thud.
function makeMiss(ctx) {
  const rand = noise(37);
  const filter = lowpass(0.08);
  return render(ctx, 0.42, (t, p) => {
    const tone = sine(t, 260 - 150 * p);
    return (tone * 0.7 + filter(rand()) * 0.3) * decay(p, 3) * edges(p) * 0.38;
  });
}

// Countdown urgency tick.
function makeTick(ctx) {
  return render(ctx, 0.07, (t, p) => sine(t, 1400) * decay(p, 6) * edges(p, 0.08) * 0.22);
}

// Difficulty stage change: two rising notes.
function makeStage(ctx) {
  return render(ctx, 0.5, (t, p) => {
    const freq = t < 0.14 ? 440 : 660;
    const local = t < 0.14 ? t / 0.14 : (t - 0.14) / 0.36;
    return sine(t, freq) * decay(local, 2) * edges(p) * 0.32;
  });
}

// UI press.
function makeButton(ctx) {
  return render(ctx, 0.09, (t, p) => sine(t, 660) * decay(p, 5) * edges(p, 0.1) * 0.24);
}

// Combo step. `index` climbs a pentatonic ladder so a longer streak literally
// sounds like it is going somewhere.
const COMBO_STEPS = [523, 587, 659, 784, 880, 1047, 1175, 1319];
function makeCombo(ctx, index) {
  const freq = COMBO_STEPS[Math.min(index, COMBO_STEPS.length - 1)];
  return render(ctx, 0.24, (t, p) => (
    (sine(t, freq) * 0.75 + sine(t, freq * 2) * 0.25) * decay(p, 4) * edges(p) * 0.34
  ));
}

// Combo broken: a short downward slide.
function makeComboBreak(ctx) {
  return render(ctx, 0.3, (t, p) => sine(t, 400 - 210 * p) * decay(p, 3) * edges(p) * 0.3);
}

// Looping underwater music bed: a slow chord pad with a drifting filter, sized
// so the loop point lands on a whole number of cycles for every partial and
// therefore does not click when it wraps.
// A slow chord pad has nothing above a few hundred Hz, so rendering it at CD
// rate is wasted work — this is a quarter of the samples for no audible loss.
const MUSIC_SAMPLE_RATE = 11025;

function makeMusic(ctx) {
  const seconds = 8;
  // A minor 9th spread over two octaves — 55 Hz base, all integer multiples of
  // 1/seconds so the loop is seamless.
  const voices = [110, 165, 220, 262, 330, 440];
  const rand = noise(101);
  const filter = lowpass(0.02);
  return render(ctx, seconds, (t, p) => {
    let sum = 0;
    voices.forEach((f, i) => {
      // Each voice swells on its own slow cycle, an integer number of times per
      // loop so the envelope wraps cleanly too.
      const cycles = 1 + (i % 3);
      const swell = 0.5 - 0.5 * Math.cos(2 * Math.PI * cycles * p);
      sum += sine(t, f) * swell / voices.length;
    });
    const shimmer = filter(rand()) * 0.05;
    return (sum * 0.7 + shimmer) * 0.42;
  }, Math.min(MUSIC_SAMPLE_RATE, ctx.sampleRate));
}

// --- registry -------------------------------------------------------------

export const SFX = {
  SWIPE: 'sfx-swipe',
  CUT: 'sfx-cut',
  PERFECT: 'sfx-perfect',
  BONUS: 'sfx-bonus',
  MISS: 'sfx-miss',
  TICK: 'sfx-tick',
  STAGE: 'sfx-stage',
  BUTTON: 'sfx-button',
  COMBO_BREAK: 'sfx-combo-break',
};

export const MUSIC_KEY = 'music-reef';
export const COMBO_STEP_COUNT = COMBO_STEPS.length;
export const comboKey = (index) => 'sfx-combo-' + Math.min(index, COMBO_STEPS.length - 1);

function audioContextFor(scene) {
  const manager = scene.sound;
  const ctx = manager && manager.context;
  // NoAudioSoundManager (or a browser with Web Audio disabled) has no context;
  // the game has to stay playable without sound.
  return ctx && typeof ctx.createBuffer === 'function' ? ctx : null;
}

// The effects: short, cheap, and needed the moment anything is tapped, so these
// are rendered during boot. Safe to call more than once. Returns how many
// buffers were built.
export function buildSfx(scene) {
  const ctx = audioContextFor(scene);
  if (!ctx) return 0;

  const cache = scene.cache.audio;
  const factories = {
    [SFX.SWIPE]: makeSwipe,
    [SFX.CUT]: makeCut,
    [SFX.PERFECT]: makePerfect,
    [SFX.BONUS]: makeBonus,
    [SFX.MISS]: makeMiss,
    [SFX.TICK]: makeTick,
    [SFX.STAGE]: makeStage,
    [SFX.BUTTON]: makeButton,
    [SFX.COMBO_BREAK]: makeComboBreak,
  };

  let built = 0;
  Object.entries(factories).forEach(([key, make]) => {
    if (cache.exists(key)) return;
    cache.add(key, make(ctx));
    built++;
  });

  for (let i = 0; i < COMBO_STEPS.length; i++) {
    const key = comboKey(i);
    if (cache.exists(key)) continue;
    cache.add(key, makeCombo(ctx, i));
    built++;
  }

  return built;
}

// The music bed, kept out of the boot path: eight seconds of pad cost more to
// synthesise than every effect combined, and nothing needs it until a menu is
// already on screen.
export function buildMusic(scene) {
  const ctx = audioContextFor(scene);
  if (!ctx) return false;
  const cache = scene.cache.audio;
  if (cache.exists(MUSIC_KEY)) return true;
  cache.add(MUSIC_KEY, makeMusic(ctx));
  return true;
}

export function hasMusic(scene) {
  return !!(scene.cache && scene.cache.audio && scene.cache.audio.exists(MUSIC_KEY));
}
