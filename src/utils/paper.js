// Paper treatment for the procedurally drawn artwork.
//
// The game is about cutting things out, so everything is dressed as coloured
// paper on a craft table: a fibre grain across the fill, a slightly darker
// pressed edge, and a torn — not laser-cut — outline. It all runs once at boot
// over the canvas that `Graphics.generateTexture` already produced, so there is
// no runtime cost and still no asset to download.

// Deterministic hash noise. Same texture every run, which matters because the
// cut geometry is measured against these shapes.
function hashNoise(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695040888963407) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

// Smooth low-frequency field, for blotchy pulp variation rather than TV static.
function mottle(x, y, scale, seed) {
  const gx = Math.floor(x / scale);
  const gy = Math.floor(y / scale);
  const fx = (x / scale) - gx;
  const fy = (y / scale) - gy;
  const smooth = (t) => t * t * (3 - 2 * t);
  const sx = smooth(fx);
  const sy = smooth(fy);
  const a = hashNoise(gx, gy, seed);
  const b = hashNoise(gx + 1, gy, seed);
  const c = hashNoise(gx, gy + 1, seed);
  const d = hashNoise(gx + 1, gy + 1, seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

const OPAQUE_CUTOFF = 8;

// Approximate distance (in pixels, capped at `maxDistance`) from every opaque
// pixel to the nearest transparent one. A couple of min-plus sweeps is plenty
// for the few pixels of edge shading we want, and far cheaper than a real
// distance transform.
function edgeDistance(alpha, w, h, maxDistance) {
  const dist = new Uint8Array(w * h);
  for (let i = 0; i < dist.length; i++) {
    dist[i] = alpha[i] > OPAQUE_CUTOFF ? maxDistance : 0;
  }
  for (let pass = 0; pass < maxDistance; pass++) {
    // Forward sweep, then backward, so information travels both ways.
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (dist[i] === 0) continue;
        const best = Math.min(dist[i - 1], dist[i - w]);
        if (best + 1 < dist[i]) dist[i] = best + 1;
      }
    }
    for (let y = h - 2; y > 0; y--) {
      for (let x = w - 2; x > 0; x--) {
        const i = y * w + x;
        if (dist[i] === 0) continue;
        const best = Math.min(dist[i + 1], dist[i + w]);
        if (best + 1 < dist[i]) dist[i] = best + 1;
      }
    }
  }
  return dist;
}

/**
 * Dresses an already-drawn canvas texture as a piece of cut paper, in place.
 *
 * @param {Phaser.Textures.CanvasTexture|HTMLCanvasElement} target
 * @param {object} [options]
 * @param {number} [options.seed]        Varies the grain between sheets.
 * @param {number} [options.grain]       Fibre strength, 0 disables.
 * @param {number} [options.tear]        Max pixels of ragged edge to eat away.
 * @param {number} [options.edgeShade]   How much to darken the pressed rim.
 * @param {boolean} [options.tearEdges]  Set false for full-bleed art (the
 *                                       background sheet has no cut outline).
 */
export function paperize(target, options = {}) {
  const canvas = target.getCanvas ? target.getCanvas() : target;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return;

  const {
    seed = 1,
    grain = 0.13,
    tear = 3,
    edgeShade = 0.22,
    tearEdges = true,
  } = options;

  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;

  // 1. Tear the outline. Eroding by a noisy amount leaves the deckled edge of
  //    something cut by hand instead of a clean vector boundary.
  if (tearEdges && tear > 0) {
    const alpha = new Uint8Array(w * h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
    const dist = edgeDistance(alpha, w, h, tear + 1);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const d = dist[i];
        if (d === 0 || d > tear) continue;
        // A smooth field decides how deep the tear bites at this point along
        // the edge, so the raggedness reads as fibres rather than noise.
        const bite = mottle(x, y, 9, seed + 77) * tear;
        if (d <= bite) data[i * 4 + 3] = 0;
      }
    }
  }

  // 2. Grain and pressed edge over whatever is still opaque.
  const alphaAfter = new Uint8Array(w * h);
  for (let i = 0; i < alphaAfter.length; i++) alphaAfter[i] = data[i * 4 + 3];
  const rim = edgeDistance(alphaAfter, w, h, 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = i * 4;
      if (data[p + 3] <= OPAQUE_CUTOFF) continue;

      // Fine fibres plus a broad pulp blotch.
      const fibre = hashNoise(x, y, seed) - 0.5;
      const blotch = mottle(x, y, 26, seed + 5) - 0.5;
      let factor = 1 + fibre * grain + blotch * grain * 0.9;

      // The cut rim of a sheet catches less light than its face.
      const d = rim[i];
      if (d > 0 && d <= 3) factor *= 1 - edgeShade * (1 - (d - 1) / 3);

      data[p] = Math.max(0, Math.min(255, data[p] * factor));
      data[p + 1] = Math.max(0, Math.min(255, data[p + 1] * factor));
      data[p + 2] = Math.max(0, Math.min(255, data[p + 2] * factor));
    }
  }

  ctx.putImageData(image, 0, 0);
  if (target.refresh) target.refresh();
}

// The colour of paper stock seen edge-on: what a fresh cut exposes. Used both
// for the cut edge on debris and for the torn rim highlight.
export const PAPER_CORE = '#f7f1df';
