import Phaser from 'phaser';
import { t } from '../i18n/index.js';
import { fishValueMultiplier } from '../data/fishData.js';
import {
  RING_PADDING, FISH_TEXTURE_W, FISH_TEXTURE_H, fishSpriteScale,
  PAPER_TILT_DEGREES, PAPER_SHADOW_OFFSET, PAPER_SHADOW_ALPHA, FONT_FAMILY,
} from '../data/displayConfig.js';

// A single fish waiting to be sliced. It idles in place (gentle bob) while a
// per-fish countdown ring depletes. GameplayLane owns the cut geometry and the
// timer, and drives this object from its own update(): nothing in here runs on a
// timer of its own.
export default class CuttableFish extends Phaser.GameObjects.Container {
  constructor(scene, fishType, { x, y }) {
    super(scene, x, y);
    this.scene = scene;
    this.fishType = fishType;
    this.baseY = y;
    this.resolved = false;
    this.bobOffset = Math.random() * Math.PI * 2;

    const spriteScale = fishSpriteScale(fishType.size);

    // A paper cut-out lying on a surface: a soft offset shadow, and never quite
    // square to the world. The tilt is small enough not to disturb the cut
    // maths, which measures the body ellipse from the sprite's own radii.
    this.shadow = scene.add.sprite(
      PAPER_SHADOW_OFFSET * fishType.size, PAPER_SHADOW_OFFSET * fishType.size, 'fish-' + fishType.key,
    ).setScale(spriteScale).setTint(0x00161f).setAlpha(PAPER_SHADOW_ALPHA);

    this.sprite = scene.add.sprite(0, 0, 'fish-' + fishType.key).setScale(spriteScale);
    this.ring = scene.add.graphics();
    this.add([this.ring, this.shadow, this.sprite]);

    this.tilt = Phaser.Math.FloatBetween(-PAPER_TILT_DEGREES, PAPER_TILT_DEGREES);
    this.shadow.setAngle(this.tilt);
    this.sprite.setAngle(this.tilt);

    // Design units, not texture pixels: the texture is supersampled, the sprite
    // is scaled back down, and the ring has to match what is actually on screen.
    this.ringRadius = Math.max(FISH_TEXTURE_W, FISH_TEXTURE_H) * fishType.size * 0.5 + RING_PADDING;
    this.setCountdownRatio(1);

    // Species differ in what they pay, so say so on the fish itself rather than
    // leaving the player to reverse-engineer it from the score popups.
    const value = fishValueMultiplier(fishType);
    this.nameLabel = scene.add.text(0, -this.ringRadius - 16, t('fishCaption', {
      name: t('fish_' + fishType.key),
      value: value.toFixed(2),
    }), {
      fontFamily: FONT_FAMILY, fontSize: '15px', fontStyle: 'bold',
      color: value >= 1 ? '#ffd23f' : '#cfe9ff',
      stroke: '#00121f', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add(this.nameLabel);

    scene.add.existing(this);
  }

  // Called every frame by the owning lane while the fish is alive.
  updateIdle(time) {
    if (this.resolved) return;
    this.y = this.baseY + Math.sin(time / 320 + this.bobOffset) * 7;
  }

  getRadii() {
    const rx = (this.sprite.width * this.sprite.scaleX) * 0.42;
    const ry = (this.sprite.height * this.sprite.scaleY) * 0.42;
    return { rx, ry };
  }

  setCountdownRatio(ratio) {
    const r = Phaser.Math.Clamp(ratio, 0, 1);
    this.ring.clear();
    this.ring.lineStyle(4, 0xffffff, 0.25);
    this.ring.strokeCircle(0, 0, this.ringRadius);
    if (r > 0) {
      const color = r < 0.3 ? 0xff5a5a : 0xffe38a;
      this.ring.lineStyle(4, color, 0.9);
      this.ring.beginPath();
      this.ring.arc(0, 0, this.ringRadius, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * r), false);
      this.ring.strokePath();
    }
  }

  markResolved() {
    this.resolved = true;
  }

  playMissedAnimation(onComplete) {
    this.markResolved();
    this.scene.tweens.add({
      targets: this,
      y: this.y + 260,
      angle: Phaser.Math.Between(-40, 40),
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.destroy();
        if (onComplete) onComplete();
      },
    });
  }
}
