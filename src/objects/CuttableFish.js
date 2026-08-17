import Phaser from 'phaser';

// A single fish waiting to be sliced. It idles in place (gentle bob) while a
// per-fish countdown ring depletes; ArcModeScene owns the actual cut
// geometry/timer and drives this object via its public methods.
export default class CuttableFish extends Phaser.GameObjects.Container {
  constructor(scene, fishType, { x, y }) {
    super(scene, x, y);
    this.scene = scene;
    this.fishType = fishType;
    this.baseY = y;
    this.resolved = false;
    this.bobOffset = Math.random() * Math.PI * 2;

    this.sprite = scene.add.sprite(0, 0, `fish-${fishType.key}`).setScale(fishType.size);
    this.ring = scene.add.graphics();
    this.add([this.ring, this.sprite]);

    this.ringRadius = Math.max(this.sprite.width, this.sprite.height) * fishType.size * 0.5 + 8;
    this.setCountdownRatio(1);

    scene.add.existing(this);

    this.bobEvent = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (this.resolved) return;
        this.y = this.baseY + Math.sin(scene.time.now / 320 + this.bobOffset) * 7;
      },
    });
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
    if (this.bobEvent) this.bobEvent.remove(false);
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

  destroy(fromScene) {
    if (this.bobEvent) this.bobEvent.remove(false);
    super.destroy(fromScene);
  }
}
