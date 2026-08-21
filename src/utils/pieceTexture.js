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

export function createPieceTexture(scene, sourceKey, texW, texH, polygonTexSpace) {
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
  ctx.globalCompositeOperation = 'source-over';

  canvasTexture.refresh();
  return key;
}

export function destroyPieceTexture(scene, key) {
  if (key && scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
}
