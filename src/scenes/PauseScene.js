import Phaser from 'phaser';
import { createButton } from '../ui/createButton.js';

// Mirrors BPUI_Pause (bPaused / SetGamePaused), launched as an overlay above
// BPUI_ArcMode rather than replacing it.
export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  init(data) {
    this.parentKey = data.parentKey || 'ArcMode';
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, 0x00121f, 0.6).setInteractive();

    const panel = this.add.graphics();
    panel.fillStyle(0x123a5c, 0.97);
    panel.fillRoundedRect(w / 2 - 160, h / 2 - 160, 320, 320, 24);
    panel.lineStyle(3, 0xffffff, 0.5);
    panel.strokeRoundedRect(w / 2 - 160, h / 2 - 160, 320, 320, 24);

    this.add.text(w / 2, h / 2 - 112, 'PAUSED', {
      fontFamily: 'Arial, sans-serif', fontSize: '34px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);

    createButton(this, w / 2, h / 2 - 30, 220, 60, 'Resume', { color: 0x2fbf71, fontSize: 24 })
      .on('pointerup', () => this.resume());

    createButton(this, w / 2, h / 2 + 45, 220, 60, 'Restart', { color: 0xff8a3d, fontSize: 24 })
      .on('pointerup', () => this.restart());

    createButton(this, w / 2, h / 2 + 120, 220, 60, 'Main Menu', { color: 0x8a5cff, fontSize: 24 })
      .on('pointerup', () => this.toMenu());

    this.input.keyboard?.once('keydown-ESC', () => this.resume());
  }

  resume() {
    this.scene.resume(this.parentKey);
    this.scene.stop();
  }

  restart() {
    this.scene.stop(this.parentKey);
    this.scene.stop();
    this.scene.start(this.parentKey);
  }

  toMenu() {
    this.scene.stop(this.parentKey);
    this.scene.stop();
    this.scene.start('MainMenu');
  }
}
