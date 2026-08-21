import Phaser from 'phaser';
import { CUT_FISH_TYPES, OCTOPUS_BONUS } from '../data/fishData.js';
import {
  SAND_HEIGHT, FISH_TEXTURE_W, FISH_TEXTURE_H, FISH_SUPERSAMPLE, PAPER_SCRAP_KEY,
} from '../data/displayConfig.js';
import { initAudio } from '../audio/audio.js';
import { paperize } from '../utils/paper.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.buildBackground();
    this.buildBubble();
    this.buildSpark();
    this.buildPaw();
    this.buildPaperScrap();

    CUT_FISH_TYPES.forEach((fish) => {
      this.buildFishTexture(`fish-${fish.key}`, fish);
    });
    this.buildFishTexture(`fish-${OCTOPUS_BONUS.key}`, OCTOPUS_BONUS);

    // Sounds are synthesised the same way the textures are drawn — from code,
    // at boot. Cheap enough to do inline; there is nothing to download.
    initAudio(this);

    this.scene.start('MainMenu');
  }

  buildBackground() {
    const w = this.scale.width;
    const h = this.scale.height;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    const steps = 40;
    const top = Phaser.Display.Color.ValueToColor(0x0a2a4a);
    const bottom = Phaser.Display.Color.ValueToColor(0x1d6fa5);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, steps, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (h / steps) * i, w, h / steps + 1);
    }

    // soft light rays, spaced to spread evenly across the full (widescreen) width
    const rayCount = Math.ceil(w / 160);
    const raySpacing = w / rayCount;
    g.fillStyle(0xffffff, 0.05);
    for (let i = 0; i < rayCount; i++) {
      const x = raySpacing * 0.5 + i * raySpacing;
      g.fillTriangle(x, 0, x + 70, 0, x - 40, h);
    }

    // sandy sea floor
    g.fillStyle(0x2f5d3a, 1);
    g.fillRect(0, h - SAND_HEIGHT, w, SAND_HEIGHT);
    g.fillStyle(0x3d7248, 1);
    for (let x = -20; x < w + 40; x += 40) {
      g.fillEllipse(x, h - SAND_HEIGHT, 50, 12);
    }

    g.generateTexture('bg-underwater', w, h);
    g.destroy();
    // The backdrop is one big uncut sheet: grain, but no torn outline.
    paperize(this.textures.get('bg-underwater'), {
      seed: 3, grain: 0.06, tearEdges: false, edgeShade: 0,
    });
  }

  buildBubble() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(10, 10, 10);
    g.lineStyle(1.5, 0xffffff, 0.6);
    g.strokeCircle(10, 10, 9);
    g.generateTexture('bubble', 20, 20);
    g.destroy();
  }

  buildSpark() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture('spark', 12, 12);
    g.destroy();
  }

  buildPaw() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(20, 26, 24, 18);
    g.fillCircle(8, 10, 6.5);
    g.fillCircle(19, 4, 6.5);
    g.fillCircle(31, 4, 6.5);
    g.fillCircle(38, 12, 6);
    g.generateTexture('paw', 46, 40);
    g.destroy();
    paperize(this.textures.get('paw'), { seed: 9, grain: 0.1, tear: 2 });
  }

  // A single torn flake, drawn white so it can be tinted to whichever fish it
  // came off. Deliberately irregular: a rectangle reads as confetti, not paper.
  buildPaperScrap() {
    const w = 22;
    const h = 16;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(1, 5);
    g.lineTo(9, 1);
    g.lineTo(20, 4);
    g.lineTo(17, 12);
    g.lineTo(6, 15);
    g.closePath();
    g.fillPath();
    g.generateTexture(PAPER_SCRAP_KEY, w, h);
    g.destroy();
    paperize(this.textures.get(PAPER_SCRAP_KEY), { seed: 41, grain: 0.16, tear: 1, edgeShade: 0.18 });
  }

  buildFishTexture(key, fish) {
    const w = FISH_TEXTURE_W;
    const h = FISH_TEXTURE_H;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // Every drawing routine below works in design units; scaling the Graphics
    // itself rasterises the same artwork into a texture FISH_SUPERSAMPLE times
    // larger, so the sprites (which shrink back down by the same factor) keep
    // their edges when blown up to playing size.
    g.setScale(FISH_SUPERSAMPLE);
    // Centered on the canvas itself so the sprite's origin (0.5, 0.5) lands
    // exactly on the drawn body's geometric center — the slicing math in
    // ArcModeScene assumes fish.x/fish.y IS that center.
    const cx = w / 2;
    const cy = h / 2;

    const drawers = {
      octopus: this.drawOctopus,
      cute: this.drawCuteFish,
      puffer: this.drawPufferFish,
      angel: this.drawAngelFish,
      ray: this.drawRay,
    };
    const drawer = drawers[fish.key] || this.drawClownFish;
    drawer.call(this, g, cx, cy, fish);

    g.generateTexture(key, w * FISH_SUPERSAMPLE, h * FISH_SUPERSAMPLE);
    g.destroy();

    // Each fish is a hand-cut shape: fibre grain, a pressed rim, and a torn
    // outline. The tear is scaled with the supersample so it stays the same
    // size on screen no matter what the texture resolution is.
    paperize(this.textures.get(key), {
      seed: hashSeed(key),
      grain: 0.14,
      tear: FISH_SUPERSAMPLE,
      edgeShade: 0.24,
    });
  }

  drawClownFish(g, cx, cy, fish) {
    // tail
    g.fillStyle(fish.finColor, 1);
    g.fillTriangle(cx - 60, cy, cx - 38, cy - 22, cx - 38, cy + 22);
    // body
    g.fillStyle(fish.bodyColor, 1);
    g.fillEllipse(cx, cy, 78, 52);
    // stripes
    g.fillStyle(fish.stripeColor, 1);
    g.fillEllipse(cx - 12, cy, 9, 50);
    g.fillEllipse(cx + 10, cy, 9, 50);
    g.fillEllipse(cx + 30, cy, 8, 40);
    // top fin
    g.fillStyle(fish.finColor, 1);
    g.fillTriangle(cx - 5, cy - 25, cx + 12, cy - 44, cx + 22, cy - 24);
    // bottom fin
    g.fillTriangle(cx - 8, cy + 24, cx + 6, cy + 40, cx + 18, cy + 22);
    // eye
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx + 32, cy - 6, 9);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(cx + 35, cy - 6, 4.5);
  }

  drawCuteFish(g, cx, cy, fish) {
    // tail
    g.fillStyle(fish.finColor, 1);
    g.fillTriangle(cx - 52, cy, cx - 32, cy - 16, cx - 32, cy + 16);
    // body (rounder / chubbier)
    g.fillStyle(fish.bodyColor, 1);
    g.fillEllipse(cx + 6, cy, 66, 56);
    // top fin
    g.fillStyle(fish.finColor, 1);
    g.fillTriangle(cx, cy - 24, cx + 12, cy - 40, cx + 20, cy - 20);
    // blush cheeks
    g.fillStyle(0xffb3c6, 0.8);
    g.fillEllipse(cx + 18, cy + 10, 12, 8);
    // big eye
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx + 30, cy - 8, 12);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(cx + 33, cy - 8, 6);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx + 35, cy - 11, 2);
  }

  drawOctopus(g, cx, cy, fish) {
    // tentacles
    g.fillStyle(fish.finColor, 1);
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const baseX = cx - 30 + t * 60;
      const tipX = baseX + (t - 0.5) * 26;
      const ctrl1 = { x: baseX + (tipX - baseX) * 0.6 + 10, y: cy + 34 };
      const ctrl2 = { x: baseX + (tipX - baseX) * 0.6 - 6, y: cy + 34 };
      const tip = { x: tipX, y: cy + 48 };

      g.beginPath();
      g.moveTo(baseX - 8, cy + 10);
      g.lineTo(baseX + 8, cy + 10);
      quadraticLineTo(g, { x: baseX + 8, y: cy + 10 }, ctrl1, tip);
      quadraticLineTo(g, tip, ctrl2, { x: baseX - 8, y: cy + 10 });
      g.closePath();
      g.fillPath();
    }
    // head
    g.fillStyle(fish.bodyColor, 1);
    g.fillCircle(cx, cy - 4, 34);
    // highlight patches
    g.fillStyle(fish.stripeColor, 0.7);
    g.fillEllipse(cx - 12, cy - 18, 14, 10);
    // eyes
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx - 12, cy - 4, 10);
    g.fillCircle(cx + 14, cy - 4, 10);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(cx - 10, cy - 4, 5);
    g.fillCircle(cx + 16, cy - 4, 5);
  }

  drawPufferFish(g, cx, cy, fish) {
    // tail
    g.fillStyle(fish.finColor, 1);
    g.fillTriangle(cx - 54, cy, cx - 36, cy - 14, cx - 36, cy + 14);
    // spikes radiating around a mostly-round body
    g.fillStyle(fish.finColor, 1);
    const spikeR = 40;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const tx = cx + Math.cos(angle) * (spikeR + 12);
      const ty = cy + Math.sin(angle) * (spikeR + 12);
      const px = cx + Math.cos(angle + 0.18) * (spikeR - 6);
      const py = cy + Math.sin(angle + 0.18) * (spikeR - 6);
      const qx = cx + Math.cos(angle - 0.18) * (spikeR - 6);
      const qy = cy + Math.sin(angle - 0.18) * (spikeR - 6);
      g.fillTriangle(px, py, qx, qy, tx, ty);
    }
    // round body
    g.fillStyle(fish.bodyColor, 1);
    g.fillCircle(cx, cy, spikeR);
    // belly highlight
    g.fillStyle(fish.stripeColor, 0.6);
    g.fillEllipse(cx + 2, cy + 10, 30, 18);
    // big surprised eyes
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx + 18, cy - 10, 10);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(cx + 21, cy - 10, 5);
  }

  drawAngelFish(g, cx, cy, fish) {
    // long trailing top + bottom sail fins
    g.fillStyle(fish.finColor, 1);
    g.fillTriangle(cx - 6, cy - 14, cx - 2, cy - 58, cx + 20, cy - 18);
    g.fillTriangle(cx - 6, cy + 14, cx - 2, cy + 58, cx + 20, cy + 18);
    // forked tail
    g.fillTriangle(cx - 58, cy - 20, cx - 30, cy - 4, cx - 58, cy + 2);
    g.fillTriangle(cx - 58, cy + 20, cx - 30, cy + 4, cx - 58, cy - 2);
    // tall diamond-ish body
    g.fillStyle(fish.bodyColor, 1);
    g.fillEllipse(cx + 4, cy, 56, 60);
    // vertical stripe bands
    g.fillStyle(fish.stripeColor, 0.85);
    g.fillEllipse(cx - 6, cy, 8, 56);
    g.fillEllipse(cx + 16, cy, 8, 50);
    // eye
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx + 30, cy - 4, 8);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(cx + 32, cy - 4, 4);
  }

  drawRay(g, cx, cy, fish) {
    // whip tail
    g.fillStyle(fish.finColor, 1);
    g.lineStyle(5, fish.finColor, 1);
    g.beginPath();
    g.moveTo(cx - 44, cy);
    g.lineTo(cx - 66, cy + 10);
    g.strokePath();
    // wide diamond "wings"
    g.fillStyle(fish.bodyColor, 1);
    g.fillTriangle(cx - 44, cy, cx + 20, cy - 40, cx + 44, cy);
    g.fillTriangle(cx - 44, cy, cx + 20, cy + 40, cx + 44, cy);
    g.fillEllipse(cx, cy, 60, 30);
    // top highlight pattern
    g.fillStyle(fish.stripeColor, 0.65);
    g.fillEllipse(cx + 4, cy, 34, 14);
    // eyes near the front edge
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx + 30, cy - 6, 7);
    g.fillCircle(cx + 30, cy + 6, 7);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(cx + 32, cy - 6, 3.5);
    g.fillCircle(cx + 32, cy + 6, 3.5);
  }

}

// Phaser 4's Graphics has no quadraticCurveTo; approximate one by sampling the
// bezier and stepping through it with lineTo segments instead.
function quadraticLineTo(g, p0, ctrl, p1, segments = 8) {
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    const x = mt * mt * p0.x + 2 * mt * t * ctrl.x + t * t * p1.x;
    const y = mt * mt * p0.y + 2 * mt * t * ctrl.y + t * t * p1.y;
    g.lineTo(x, y);
  }
}

// Stable per-key seed, so each fish gets its own grain but always the same one.
function hashSeed(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h % 9973) + 1;
}
