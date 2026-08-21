// Bakes a cut piece into its own texture, once, at the moment of the cut.
//
// Masking a sprite with the cut polygon is a dead end in Phaser 4:
// `GeometryMask` is Canvas-only (its own docblock says so, see
// src/display/mask/GeometryMask.js) and the WebGL replacement,
// `filters.internal.addMask(gameObject)`, renders the mask GameObject into a
// DynamicTexture sized to the object's filter framebuffer — a world-positioned
// mask Graphics lands off-frame there and the piece renders completely empty
// (verified by screenshot).
//
// Compositing on a 2D canvas instead is renderer-agnostic, costs two draw calls
// once per cut rather than a per-frame mask-follow timer, and leaves a plain
// Sprite behind. Fish textures are always canvas-backed — `Graphics
// .generateTexture` goes through `textures.createCanvas` under both renderers —
// so the source is always drawable.

import { PAPER_CORE } from './paper.js';

// Thickness of the pale core exposed along a fresh cut, in texture pixels.
const CUT_EDGE_WIDTH = 7;

let sequence = 0;

// Converts a world-space polygon into the piece texture's own pixel space.
// The piece sprite sits at (centerX, centerY) with origin 0.5 and the given
// uniform scale, so this is just "undo the scale, re-centre on the texture".
export function toTextureSpace(polygon, centerX, centerY, scale, texW, texH) {
  return polygon.map((p) => ({
    x: (p.x - centerX) / scale + texW / 2,
    y: (p.y - centerY) / scale + texH / 2,
  }));
}

// Tells the blade line apart from the body outline. The piece polygon is the
// body ellipse clipped by the cut, so all of its edges lie on the ellipse
// except the one the blade made. Ellipse edges have midpoints a hair inside the
// boundary (cos of half a segment, ~0.994 for a 28-gon); the cut chord's
// midpoint sits far further in, so a threshold cleanly separates the two.
const ELLIPSE_EDGE_CUTOFF = 0.97;

function isCutEdge(a, b, cx, cy, rx, ry) {
  const mx = (a.x + b.x) / 2 - cx;
  const my = (a.y + b.y) / 2 - cy;
  const normalized = Math.sqrt((mx / rx) ** 2 + (my / ry) ** 2);
  return normalized < ELLIPSE_EDGE_CUTOFF;
}

export function createPieceTexture(scene, sourceKey, texW, texH, polygonTexSpace, bodyRx, bodyRy) {
  const source = scene.textures.get(sourceKey);
  if (!source) return null;

  const key = `piece-${sourceKey}-${sequence++}`;
  const canvasTexture = scene.textures.createCanvas(key, texW, texH);
  if (!canvasTexture) return null;

  const ctx = canvasTexture.context;
  ctx.clearRect(0, 0, texW, texH);
  ctx.drawImage(source.getSourceImage(), 0, 0);

  // 'destination-in' keeps only the pixels covered by the shape drawn next,
  // i.e. clips the fish to the cut polygon.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  polygonTexSpace.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();

  // Freshly cut paper shows its pale core along the blade line — but only
  // there. The rest of this outline is the fish's own torn edge, which should
  // keep the deckled look it was given at boot. 'source-atop' additionally
  // keeps the stroke from bleeding outside the piece.
  if (bodyRx > 0 && bodyRy > 0) {
    const cx = texW / 2;
    const cy = texH / 2;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = PAPER_CORE;
    ctx.lineWidth = CUT_EDGE_WIDTH;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < polygonTexSpace.length; i++) {
      const a = polygonTexSpace[i];
      const b = polygonTexSpace[(i + 1) % polygonTexSpace.length];
      if (!isCutEdge(a, b, cx, cy, bodyRx, bodyRy)) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'source-over';

  canvasTexture.refresh();
  return key;
}

export function destroyPieceTexture(scene, key) {
  if (key && scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
}
