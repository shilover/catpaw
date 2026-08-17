import Phaser from 'phaser';
import { OCTOPUS_BONUS } from '../data/fishData.js';

// The "perfect cut" reward: pops out in a parabolic arc (arcade physics
// projectile) and must be tapped before it falls back off screen.
export default class BonusOctopus {
  constructor(scene, { x, y, floorY, onCollect, sizeMultiplier = 1 }) {
    this.scene = scene;
    this.collected = false;
    this.expired = false;
    this.onCollect = onCollect || (() => {});
    this.floorY = floorY !== undefined ? floorY : scene.scale.height + 80;

    this.sprite = scene.physics.add.sprite(x, y, `fish-${OCTOPUS_BONUS.key}`);
    this.sprite.setScale(OCTOPUS_BONUS.size * sizeMultiplier);
    this.sprite.body.setAllowGravity(true);
    this.sprite.body.setGravityY(1000);

    const dir = Math.random() < 0.5 ? -1 : 1;
    this.sprite.body.setVelocity(dir * Phaser.Math.Between(70, 150), -Phaser.Math.Between(430, 540));

    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on('pointerdown', () => this.collect());
    this.hitRadius = Math.max(this.sprite.displayWidth, this.sprite.displayHeight) * 0.5;

    this.glow = scene.add.sprite(x, y, `fish-${OCTOPUS_BONUS.key}`)
      .setScale(OCTOPUS_BONUS.size * sizeMultiplier * 1.25)
      .setAlpha(0.3)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: this.glow, alpha: 0.05, duration: 260, yoyo: true, repeat: -1 });

    this.watchEvent = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (this.collected || this.expired) return;
        this.glow.setPosition(this.sprite.x, this.sprite.y);
        if (this.sprite.y > this.floorY) this.expire();
      },
    });
  }

  // Manual fallback hit-test (used by split-screen modes — see GameplayLane
  // / CoopModeScene / VersusModeScene — where Phaser's own per-object hit
  // testing has proven unreliable once a second, rotated camera is involved
  // and more than one interactive object exists in the scene).
  containsPoint(worldX, worldY) {
    if (this.collected || this.expired) return false;
    return Phaser.Math.Distance.Between(worldX, worldY, this.sprite.x, this.sprite.y) <= this.hitRadius;
  }

  collect() {
    if (this.collected || this.expired) return;
    this.collected = true;
    this.onCollect(OCTOPUS_BONUS.bonusScore, this.sprite.x, this.sprite.y);
    this.cleanup();
  }

  expire() {
    if (this.collected || this.expired) return;
    this.expired = true;
    this.cleanup();
  }

  cleanup() {
    if (this.watchEvent) this.watchEvent.remove(false);
    if (this.glow) this.glow.destroy();
    if (this.sprite) this.sprite.destroy();
  }
}
