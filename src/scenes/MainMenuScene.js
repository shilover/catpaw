import Phaser from 'phaser';
import { createButton } from '../ui/createButton.js';
import { addUnderwaterBackground, addBubbles } from '../ui/backgroundEffects.js';
import {
  getHighScore, getCoopHighScore, getScoreList,
  isMusicEnabled, setMusicEnabled, isSfxEnabled, setSfxEnabled,
} from '../utils/storage.js';
import { LANDSCAPE_W, LANDSCAPE_H, FISH_SUPERSAMPLE } from '../data/displayConfig.js';
import { startMusic, syncMusic, playSfx, SFX } from '../audio/audio.js';

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
    startMusic(this);

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

    this.add.text(w / 2, h * 0.29 + 78, `High Score: ${getHighScore()}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffe38a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Co-op keeps its own best, so both are worth showing.
    this.add.text(w / 2, h * 0.29 + 104, `Team Best: ${getCoopHighScore()}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#8affc1',
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

    // Decorative fish filling the wide margins either side of the menu. Scales
    // are in design units; the fish textures are supersampled, so divide.
    const deco = (v) => v / FISH_SUPERSAMPLE;
    this.add.image(w * 0.09, h * 0.55, 'fish-clown').setScale(deco(0.7)).setFlipX(true).setAlpha(0.85);
    this.add.image(w * 0.91, h * 0.55, 'fish-octopus').setScale(deco(0.6)).setAlpha(0.85);
    this.add.image(w * 0.14, h * 0.82, 'fish-cute').setScale(deco(0.55)).setAlpha(0.8);
    this.add.image(w * 0.86, h * 0.82, 'fish-clown').setScale(deco(0.5)).setFlipX(true).setAlpha(0.8);
  }

  goTo(sceneKey) {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(sceneKey));
  }

  buildSettingsRow(w, h) {
    const y = h - 70;

    // Music and effects switch independently — see storage.isSfxEnabled.
    // Toggling used to `scene.restart()`, rebuilding the background, bubbles and
    // every decorative fish purely to recolour one icon; now only the button
    // itself is rebuilt, and the change is applied to the audio immediately.
    this.buildToggle(w / 2 - 135, y, isMusicEnabled, (on) => {
      setMusicEnabled(on);
      syncMusic(this);
    }, '♪');

    this.buildToggle(w / 2 - 45, y, isSfxEnabled, setSfxEnabled, '🔊');

    createButton(this, w / 2 + 45, y, 64, 64, 'ℹ', { color: 0x2f9fe0, fontSize: 26 }).on('pointerup', () => {
      this.showContactPopup(w, h);
    });

    createButton(this, w / 2 + 135, y, 64, 64, '≡', { color: 0x8a5cff, fontSize: 26 }).on('pointerup', () => {
      this.showScoreListPopup(w, h);
    });
  }

  buildToggle(x, y, read, write, onLabel) {
    let on = read();
    const build = () => {
      const btn = createButton(this, x, y, 64, 64, on ? onLabel : '✕', {
        color: on ? 0x2fbf71 : 0x888888,
        fontSize: 26,
      });
      btn.on('pointerup', () => {
        on = !on;
        write(on);
        // Confirm the new state audibly, but only when turning effects back on.
        if (on) playSfx(this, SFX.BUTTON);
        btn.destroy();
        build();
      });
    };
    build();
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
    // Entries carry a mode now, and the list mixes solo with co-op runs, so the
    // rows would otherwise be ambiguous.
    const body = list.length
      ? list.slice(0, 5).map((entry, i) => {
        const mode = entry.mode === 'coop' ? 'Co-op' : 'Solo';
        const when = entry.date ? new Date(entry.date).toLocaleDateString() : '';
        return `${i + 1}.  ${entry.score}   ${mode}  ${when}`;
      }).join('\n')
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
