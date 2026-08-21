import Phaser from 'phaser';
import { FONT_FAMILY } from '../data/displayConfig.js';

// The cut-accuracy bar: a 0%-50% scale (the smaller piece can never be more
// than half the fish) with a tick every 5%, a marker for the fish's target
// percentage, and an animated fill showing where the player's cut landed.
export default class TargetBar {
  constructor(scene, x, y, width, height) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.maxPercent = 50;
    this.fillPercent = 0;

    this.frame = scene.add.graphics();
    this.fill = scene.add.graphics();
    this.targetMarker = scene.add.graphics();
    this.ticks = scene.add.graphics();
    this.labels = scene.add.container(0, 0);

    this.drawFrameAndTicks();
    this.targetMarker.setVisible(false);
  }

  percentToX(percent) {
    return this.x + (Phaser.Math.Clamp(percent, 0, this.maxPercent) / this.maxPercent) * this.width;
  }

  drawFrameAndTicks() {
    const { x, y, width, height } = this;
    this.frame.clear();
    this.frame.fillStyle(0x00121f, 0.4);
    this.frame.fillRoundedRect(x, y, width, height, height / 2);
    this.frame.lineStyle(2, 0xffffff, 0.5);
    this.frame.strokeRoundedRect(x, y, width, height, height / 2);

    this.ticks.clear();
    this.labels.removeAll(true);
    for (let p = 0; p <= this.maxPercent; p += 5) {
      const tx = this.percentToX(p);
      const isMajor = p % 10 === 0;
      this.ticks.lineStyle(isMajor ? 3 : 1.5, 0xffffff, isMajor ? 0.85 : 0.4);
      const tickTop = y + (isMajor ? -4 : 2);
      this.ticks.lineBetween(tx, tickTop, tx, y + height - (isMajor ? -4 : 2));
      if (isMajor) {
        const label = this.scene.add.text(tx, y - 14, `${p}%`, {
          fontFamily: FONT_FAMILY, fontSize: '12px', color: '#bfe9ff',
        }).setOrigin(0.5, 1);
        this.labels.add(label);
      }
    }
  }

  setTarget(percent) {
    this.targetPercent = percent;
    this.targetMarker.setVisible(true);
    this.targetMarker.clear();
    const tx = this.percentToX(percent);
    this.targetMarker.fillStyle(0xffe38a, 1);
    this.targetMarker.fillTriangle(tx - 8, this.y - 10, tx + 8, this.y - 10, tx, this.y + 2);
    this.targetMarker.lineStyle(2, 0x0a2a4a, 0.6);
    this.targetMarker.strokeTriangle(tx - 8, this.y - 10, tx + 8, this.y - 10, tx, this.y + 2);

    this.fillPercent = 0;
    this.redrawFill();
  }

  redrawFill(color = 0x2fbf71) {
    this.fill.clear();
    const w = (Phaser.Math.Clamp(this.fillPercent, 0, this.maxPercent) / this.maxPercent) * this.width;
    if (w > 2) {
      this.fill.fillStyle(color, 0.9);
      this.fill.fillRoundedRect(this.x, this.y, w, this.height, this.height / 2);
    }
  }

  animateFillTo(percent, { color = 0x2fbf71, duration = 550 } = {}) {
    const state = { value: this.fillPercent };
    this.scene.tweens.add({
      targets: state,
      value: percent,
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.fillPercent = state.value;
        this.redrawFill(color);
      },
    });
  }

  destroy() {
    this.frame.destroy();
    this.fill.destroy();
    this.targetMarker.destroy();
    this.ticks.destroy();
    this.labels.destroy();
  }
}
