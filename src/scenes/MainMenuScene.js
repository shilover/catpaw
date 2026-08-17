import Phaser from 'phaser';
import { createButton } from '../ui/createButton.js';
import { addUnderwaterBackground, addBubbles } from '../ui/backgroundEffects.js';
import { getHighScore, getScoreList, isMusicEnabled, setMusicEnabled } from '../utils/storage.js';
import { LANDSCAPE_W, LANDSCAPE_H } from '../data/displayConfig.js';

// Mirrors BPUI_MainMenu: background_main, title_00, button_arc / button_vs,
// button_setting_music / button_setting_Contactme / button_setting_list.
export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    this.scale.setGameSize(LANDSCAPE_W, LANDSCAPE_H);
    const w = this.scale.width;
    const h = this.scale.height;

    addUnderwaterBackground(this);
    addBubbles(this, 20);

    this.add.image(w / 2, h * 0.13, 'paw').setScale(1.7).setAlpha(0.9);

    this.add.text(w / 2, h * 0.29, 'TINY FISH', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0a2a4a',
      strokeThickness: 9,
    }).setOrigin(0.5);

    this.add.text(w / 2, h * 0.29 + 46, 'Cat Paw Club', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      fontStyle: 'italic',
      color: '#bfe9ff',
    }).setOrigin(0.5);

    const highScore = getHighScore();
    this.add.text(w / 2, h * 0.29 + 78, `High Score: ${highScore}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffe38a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Three side-by-side mode buttons — makes better use of the widescreen
    // layout than a stacked portrait column.
    const buttonY = h * 0.58;
    const arcX = w / 2 - 300;
    const coopX = w / 2;
    const vsX = w / 2 + 300;

    createButton(this, arcX, buttonY, 260, 84, 'ARC MODE', {
      color: 0xff8a3d,
      fontSize: 28,
    }).on('pointerup', () => this.goTo('ArcMode'));
    this.add.text(arcX, buttonY + 56, 'Solo', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#cccccc',
    }).setOrigin(0.5);

    createButton(this, coopX, buttonY, 260, 84, 'CO-OP', {
      color: 0x2fbf71,
      fontSize: 28,
    }).on('pointerup', () => this.goTo('CoopMode'));
    this.add.text(coopX, buttonY + 56, '2P — same fish, cut together', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#cccccc',
    }).setOrigin(0.5);

    createButton(this, vsX, buttonY, 260, 84, 'VERSUS', {
      color: 0xff5a5a,
      fontSize: 28,
    }).on('pointerup', () => this.goTo('VersusMode'));
    this.add.text(vsX, buttonY + 56, '2P — highest score wins', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#cccccc',
    }).setOrigin(0.5);

    this.buildSettingsRow(w, h);

    // decorative fish filling the wide margins either side of the menu
    this.add.image(w * 0.09, h * 0.55, 'fish-clown').setScale(0.7).setFlipX(true).setAlpha(0.85);
    this.add.image(w * 0.91, h * 0.55, 'fish-octopus').setScale(0.6).setAlpha(0.85);
    this.add.image(w * 0.14, h * 0.82, 'fish-cute').setScale(0.55).setAlpha(0.8);
    this.add.image(w * 0.86, h * 0.82, 'fish-clown').setScale(0.5).setFlipX(true).setAlpha(0.8);
  }

  goTo(sceneKey) {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(sceneKey));
  }

  buildSettingsRow(w, h) {
    const y = h - 70;
    let musicOn = isMusicEnabled();

    const musicBtn = createButton(this, w / 2 - 90, y, 64, 64, musicOn ? '♪' : '✕', {
      color: musicOn ? 0x2fbf71 : 0x888888,
      fontSize: 26,
    });
    musicBtn.on('pointerup', () => {
      musicOn = !musicOn;
      setMusicEnabled(musicOn);
      this.scene.restart();
    });

    createButton(this, w / 2, y, 64, 64, 'ℹ', { color: 0x2f9fe0, fontSize: 26 }).on('pointerup', () => {
      this.showContactPopup(w, h);
    });

    createButton(this, w / 2 + 90, y, 64, 64, '≡', { color: 0x8a5cff, fontSize: 26 }).on('pointerup', () => {
      this.showScoreListPopup(w, h);
    });
  }

  showContactPopup(w, h) {
    this.showPopup(
      w,
      h,
      'Cat Paw Club',
      'Swipe across the fish to slice it!\nMatch the target % on the bar —\nthe closer, the higher your score.\nA perfect cut pops a bonus octopus.\n\nCo-op & Versus split the screen\ntop/bottom for two players.\nIn Versus, a perfect cut inks the\nopponent; a near-miss wobbles\ntheir fish.\n\nA Phaser 4 tribute build.',
      360,
    );
  }

  showScoreListPopup(w, h) {
    const list = getScoreList();
    const body = list.length
      ? list.slice(0, 5).map((entry, i) => `${i + 1}. ${entry.score}`).join('\n')
      : 'No runs yet — go catch some fish!';
    this.showPopup(w, h, 'Recent Scores', body);
  }

  showPopup(w, h, title, body, panelHeight = 280) {
    const overlay = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55).setInteractive();
    const panel = this.add.graphics();
    const top = h / 2 - panelHeight / 2;
    panel.fillStyle(0x123a5c, 0.96);
    panel.fillRoundedRect(w / 2 - 190, top, 380, panelHeight, 20);
    panel.lineStyle(3, 0xffffff, 0.5);
    panel.strokeRoundedRect(w / 2 - 190, top, 380, panelHeight, 20);

    const titleText = this.add.text(w / 2, top + 36, title, {
      fontFamily: 'Arial, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    const bodyText = this.add.text(w / 2, top + panelHeight / 2 + 6, body, {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#dff2ff', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);

    overlay.add([dim, panel, titleText, bodyText]);
    const closeBtn = createButton(this, w / 2, top + panelHeight - 40, 140, 50, 'Close', { color: 0xff8a3d });
    overlay.add(closeBtn);
    closeBtn.on('pointerup', () => overlay.destroy());
    dim.on('pointerdown', () => overlay.destroy());
  }
}
