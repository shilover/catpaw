// The physical half of a cut landing: a beat of frozen time, a camera kick, and
// a spray of paper scraps.
//
// Hit-stop is done by pausing the arcade world and counting down real delta in
// the owning scene's update, rather than by touching `time.timeScale`. Scaling
// the clock would also scale the timer meant to undo it, and at timeScale 0 the
// restore would simply never fire.

import Phaser from 'phaser';
import { PAPER_SCRAP_KEY } from '../data/displayConfig.js';

export default class ImpactFx {
  constructor(scene) {
    this.scene = scene;
    this.stopRemaining = 0;
  }

  get frozen() {
    return this.stopRemaining > 0;
  }

  // `hitStop` in ms, `shake` in ms with `intensity` as a fraction of the
  // viewport. `camera` matters in split-screen, where each half has its own.
  punch({ hitStop = 0, shake = 0, intensity = 0.004, camera = null } = {}) {
    if (hitStop > 0) {
      // Take the longer of the two if a second hit lands mid-freeze.
      this.stopRemaining = Math.max(this.stopRemaining, hitStop);
      const world = this.scene.physics && this.scene.physics.world;
      if (world) world.pause();
    }
    if (shake > 0) {
      const cam = camera || this.scene.cameras.main;
      if (cam) cam.shake(shake, intensity);
    }
  }

  update(delta) {
    if (this.stopRemaining <= 0) return;
    this.stopRemaining -= delta;
    if (this.stopRemaining > 0) return;

    this.stopRemaining = 0;
    const world = this.scene.physics && this.scene.physics.world;
    if (world) world.resume();
  }

  // Release the freeze without waiting it out, so a scene never shuts down with
  // the shared physics world left paused.
  destroy() {
    if (this.stopRemaining > 0) {
      this.stopRemaining = 0;
      const world = this.scene.physics && this.scene.physics.world;
      if (world) world.resume();
    }
  }
}

/**
 * Paper scraps thrown off the blade. Tweened rather than given physics bodies:
 * they are pure decoration with a fixed lifetime, and this way they need no
 * cleanup list and cannot outlive their scene.
 *
 * @param {Phaser.Scene} scene
 * @param {object} opts  x, y, tint, cutDir (unit vector along the blade),
 *                       count, spread (px), scale
 */
export function spawnPaperScraps(scene, {
  x, y, tint = 0xffffff, cutDir = { x: 1, y: 0 }, count = 10, spread = 150, scale = 1,
}) {
  if (!scene.textures.exists(PAPER_SCRAP_KEY)) return;

  for (let i = 0; i < count; i++) {
    // Thrown along the blade, mostly forwards or backwards, with a little lift.
    const along = (i % 2 === 0 ? 1 : -1) * Phaser.Math.FloatBetween(0.4, 1);
    const drift = Phaser.Math.FloatBetween(-0.45, 0.45);
    const dx = (cutDir.x * along - cutDir.y * drift) * Phaser.Math.FloatBetween(0.5, 1) * spread;
    const dy = (cutDir.y * along + cutDir.x * drift) * Phaser.Math.FloatBetween(0.5, 1) * spread;

    const scrap = scene.add.image(x, y, PAPER_SCRAP_KEY)
      .setTint(tint)
      .setScale(Phaser.Math.FloatBetween(0.6, 1.25) * scale)
      .setAngle(Phaser.Math.Between(0, 360))
      .setDepth(28);

    const life = Phaser.Math.Between(420, 720);
    scene.tweens.add({
      targets: scrap,
      x: x + dx,
      // Scraps are light, so they drift down rather than fall.
      y: y + dy + Phaser.Math.Between(40, 110),
      angle: scrap.angle + Phaser.Math.Between(-260, 260),
      alpha: 0,
      scale: scrap.scale * 0.7,
      duration: life,
      ease: 'Quad.easeOut',
      onComplete: () => scrap.destroy(),
    });
  }
}
