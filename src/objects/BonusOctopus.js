import Phaser from 'phaser';
import { OCTOPUS_BONUS } from '../data/fishData.js';
import { fishSpriteScale } from '../data/displayConfig.js';

// The "perfect cut" reward: pops out in a parabolic arc (arcade physics
// projectile) and must be tapped before it falls back off screen.
//
// Collection goes through `containsPoint` from the owning lane, never through
// the sprite's own `setInteractive`. Phaser's per-object hit testing proved
// unreliable in the split-screen modes once a second, rotated camera and more
// than one interactive object were in play, and having two collection paths
// meant a single pointerdown in solo mode both grabbed the octopus and started a
// swipe. One path, used by every mode.
export default class BonusOctopus {
  constructor(scene, { x, y, floorY, onCollect, onExpire, sizeMultiplier = 1 }) {
    this.scene = scene;
    this.collected = false;
    this.expired = false;
    this.onCollect = onCollect || (() => {});
    this.onExpire = onExpire || (() => {});
    this.floorY = floorY !== undefined ? floorY : scene.scale.height + 80;

    this.sprite = scene.physics.add.sprite(x, y, 'fish-' + OCTOPUS_BONUS.key);
    this.sprite.setScale(fishSpriteScale(OCTOPUS_BONUS.size) * sizeMultiplier);
    this.sprite.body.setAllowGravity(true);
    this.sprite.body.setGravityY(1000);

    const dir = Math.random() < 0.5 ? -1 : 1;
    this.sprite.body.setVelocity(dir * Phaser.Math.Between(70, 150), -Phaser.Math.Between(430, 540));

    this.hitRadius = Math.max(this.sprite.displayWidth, this.sprite.displayHeight) * 0.5;

    this.glow = scene.add.sprite(x, y, 'fish-' + OCTOPUS_BONUS.key)
      .setScale(fishSpriteScale(OCTOPUS_BONUS.size) * sizeMultiplier * 1.25)
      .setAlpha(0.3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.glowTween = scene.tweens.add({ targets: this.glow, alpha: 0.05, duration: 260, yoyo: true, repeat: -1 });
  }

  // Driven by the owning lane's update().
  update() {
    if (this.collected || this.expired) return;
    this.glow.setPosition(this.sprite.x, this.sprite.y);
    if (this.sprite.y > this.floorY) this.expire();
  }

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
    this.onExpire();
    this.cleanup();
  }

  cleanup() {
    if (this.glowTween) {
      this.glowTween.remove();
      this.glowTween = null;
    }
    if (this.glow) {
      this.glow.destroy();
      this.glow = null;
    }
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
