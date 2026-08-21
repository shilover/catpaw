import Phaser from 'phaser';
import { createButton } from '../ui/createButton.js';
import { SPLIT_Y } from '../data/displayConfig.js';
import { playSfx, SFX } from '../audio/audio.js';

const BTN_W = 210;
const BTN_H = 52;

// Pause overlay, launched above the running mode rather than replacing it.
//
// In the split-screen modes the two players sit facing each other, so a single
// centred panel would be upside down for one of them and straddle the divider.
// This scene therefore mirrors the parent's camera setup: one panel per half,
// each drawn by the camera that already orients that half for its own player.
export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  init(data) {
    this.parentKey = data.parentKey || 'ArcMode';
    this.splitScreen = !!data.splitScreen;
    // Phaser reuses the scene instance across launches, so the one-shot guard
    // below has to be cleared here — otherwise the second pause of a session
    // finds it already set and every button silently does nothing.
    this.acted = false;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.hitRects = [];

    const regions = this.splitScreen
      ? [
        { x: 0, y: 0, width: w, height: SPLIT_Y },
        { x: 0, y: SPLIT_Y, width: w, height: h - SPLIT_Y },
      ]
      : [{ x: 0, y: 0, width: w, height: h }];

    if (this.splitScreen) this.setupSplitCameras(regions[0], regions[1]);

    regions.forEach((region) => this.buildPanel(region));

    this.input.on('pointerup', (p) => this.routePointer(p));
    this.input.keyboard?.once('keydown-ESC', () => this.resume());
  }

  setupSplitCameras(regionA, regionB) {
    this.cameras.main.setViewport(0, 0, this.scale.width, SPLIT_Y);
    this.cameras.main.setRotation(Math.PI);
    this.cameras.main.centerOn(regionA.x + regionA.width / 2, regionA.y + regionA.height / 2);

    this.camB = this.cameras.add(0, SPLIT_Y, this.scale.width, regionB.height);
    this.camB.centerOn(regionB.x + regionB.width / 2, regionB.y + regionB.height / 2);
  }

  buildPanel(region) {
    const cx = region.x + region.width / 2;
    const cy = region.y + region.height / 2;
    const panelW = 300;
    const panelH = 300;

    this.add.rectangle(cx, cy, region.width, region.height, 0x00121f, 0.6);

    const panel = this.add.graphics();
    panel.fillStyle(0x123a5c, 0.97);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 24);
    panel.lineStyle(3, 0xffffff, 0.5);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 24);

    this.add.text(cx, cy - panelH / 2 + 44, 'PAUSED', {
      fontFamily: 'Arial, sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);

    const rows = [
      { label: 'Resume', color: 0x2fbf71, action: () => this.resume() },
      { label: 'Restart', color: 0xff8a3d, action: () => this.restart() },
      { label: 'Main Menu', color: 0x8a5cff, action: () => this.toMenu() },
    ];

    rows.forEach((row, i) => {
      const by = cy - 26 + i * (BTN_H + 14);
      createButton(this, cx, by, BTN_W, BTN_H, row.label, { color: row.color, fontSize: 22 })
        .on('pointerup', row.action);
      // Same reason as the split-screen pause buttons in SplitScreenSceneBase:
      // Phaser's hit testing is unreliable once a second rotated camera and
      // several interactive objects are involved, so keep a manual backstop.
      this.hitRects.push({ x: cx - BTN_W / 2, y: by - BTN_H / 2, w: BTN_W, h: BTN_H, action: row.action });
    });
  }

  routePointer(pointer) {
    const cam = this.splitScreen && pointer.y >= SPLIT_Y ? this.camB : this.cameras.main;
    const world = cam.getWorldPoint(pointer.x, pointer.y);
    const hit = this.hitRects.find((r) => (
      world.x >= r.x && world.x <= r.x + r.w && world.y >= r.y && world.y <= r.y + r.h
    ));
    if (hit) {
      playSfx(this, SFX.BUTTON);
      hit.action();
    }
  }

  // A button can be reached both through Phaser's own hit test and through the
  // manual backstop above, so every action is one-shot: all three tear this
  // scene down, and running one of them twice would act on an already-stopped
  // scene.
  claim() {
    if (this.acted) return false;
    this.acted = true;
    return true;
  }

  resume() {
    if (!this.claim()) return;
    this.scene.resume(this.parentKey);
    this.scene.stop();
  }

  restart() {
    if (!this.claim()) return;
    this.scene.stop(this.parentKey);
    this.scene.stop();
    this.scene.start(this.parentKey);
  }

  toMenu() {
    if (!this.claim()) return;
    this.scene.stop(this.parentKey);
    this.scene.stop();
    this.scene.start('MainMenu');
  }
}
