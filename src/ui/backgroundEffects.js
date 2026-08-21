// Shared underwater ambience (background + rising bubbles) used by every scene,
// standing in for the UE level's water material + niagara bubble VFX.

import Phaser from 'phaser';

export function addUnderwaterBackground(scene) {
  scene.add.image(scene.scale.width / 2, scene.scale.height / 2, 'bg-underwater');
}

// A simple region-scoped gradient (no sand floor — a floor strip only makes
// sense for a single full-height lane) for split-screen modes. When `flipped` is
// true the color ramp is reversed so it still reads as "darker toward the HUD,
// lighter toward open water" once the lane's camera rotates it 180 degrees for
// the opposite-facing player.
export function addLaneBackground(scene, region, flipped = false) {
  const { x, y, width, height } = region;
  const g = scene.add.graphics();
  const steps = 24;
  const dark = Phaser.Display.Color.ValueToColor(0x0a2a4a);
  const light = Phaser.Display.Color.ValueToColor(0x1d6fa5);
  const top = flipped ? light : dark;
  const bottom = flipped ? dark : light;

  for (let i = 0; i < steps; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, steps, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(x, y + (height / steps) * i, width, height / steps + 1);
  }

  g.fillStyle(0xffffff, 0.05);
  const rayCount = Math.max(2, Math.ceil(width / 160));
  const raySpacing = width / rayCount;
  for (let i = 0; i < rayCount; i++) {
    const rx = x + raySpacing * 0.5 + i * raySpacing;
    g.fillTriangle(rx, y, rx + 50, y, rx - 30, y + height);
  }

  return g;
}

// Drifting bubbles. Driven off the scene's own update event rather than a 16ms
// repeating Timer: one frame-synced callback for the whole field instead of a
// scheduler entry, and it stops cleanly with the scene.
export function addBubbles(scene, count = 14, region = null) {
  const rx = region ? region.x : 0;
  const ry = region ? region.y : 0;
  const w = region ? region.width : scene.scale.width;
  const h = region ? region.height : scene.scale.height;
  const bubbles = [];

  for (let i = 0; i < count; i++) {
    const x = Phaser.Math.Between(rx + 10, rx + w - 10);
    const y = Phaser.Math.Between(ry, ry + h);
    const scale = Phaser.Math.FloatBetween(0.4, 1.2);
    const bubble = scene.add.image(x, y, 'bubble').setScale(scale).setAlpha(Phaser.Math.FloatBetween(0.3, 0.7));
    bubble.speed = Phaser.Math.FloatBetween(18, 42);
    bubble.wobbleOffset = Math.random() * Math.PI * 2;
    bubble.baseX = x;
    bubbles.push(bubble);
  }

  const onUpdate = (time, delta) => {
    const dt = delta / 1000;
    bubbles.forEach((b) => {
      b.y -= b.speed * dt;
      b.x = b.baseX + Math.sin(time / 900 + b.wobbleOffset) * 12;
      if (b.y < ry - 20) {
        b.y = ry + h + 20;
        b.baseX = Phaser.Math.Between(rx + 10, rx + w - 10);
      }
    });
  };

  scene.events.on('update', onUpdate);
  scene.events.once('shutdown', () => scene.events.off('update', onUpdate));
  scene.events.once('destroy', () => scene.events.off('update', onUpdate));

  return bubbles;
}
