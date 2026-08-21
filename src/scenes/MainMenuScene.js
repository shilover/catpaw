import Phaser from 'phaser';
import { createButton } from '../ui/createButton.js';
import { addUnderwaterBackground, addBubbles } from '../ui/backgroundEffects.js';
import {
  getHighScore, getCoopHighScore, getScoreList,
  isMusicEnabled, setMusicEnabled, isSfxEnabled, setSfxEnabled,
} from '../utils/storage.js';
import { LANDSCAPE_W, LANDSCAPE_H, FISH_SUPERSAMPLE, FONT_FAMILY } from '../data/displayConfig.js';
import { startMusic, syncMusic, playSfx, SFX } from '../audio/audio.js';
import { t, nextLanguage, setLanguage, languageLabel } from '../i18n/index.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { getLifetimeStats, getUnlockedAchievements } from '../utils/storage.js';

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

    this.add.text(w / 2, h * 0.29, t('title'), {
      fontFamily: FONT_FAMILY,
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0a2a4a',
      strokeThickness: 9,
    }).setOrigin(0.5);

    this.add.text(w / 2, h * 0.29 + 46, t('studio'), {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      fontStyle: 'italic',
      color: '#bfe9ff',
    }).setOrigin(0.5);

    this.add.text(w / 2, h * 0.29 + 78, t('highScore', { score: getHighScore() }), {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: '#ffe38a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Co-op keeps its own best, so both are worth showing.
    this.add.text(w / 2, h * 0.29 + 104, t('teamBest', { score: getCoopHighScore() }), {
      fontFamily: FONT_FAMILY,
      fontSize: '15px',
      color: '#8affc1',
    }).setOrigin(0.5);

    // Three side-by-side mode buttons — makes better use of the widescreen
    // layout than a stacked portrait column.
    const buttonY = h * 0.58;
    const arcX = w / 2 - 300;
    const coopX = w / 2;
    const vsX = w / 2 + 300;

    createButton(this, arcX, buttonY, 260, 84, t('arcMode'), {
      color: 0xff8a3d,
      fontSize: 28,
    }).on('pointerup', () => this.goTo('ArcMode'));
    this.add.text(arcX, buttonY + 56, t('arcTagline'), {
      fontFamily: FONT_FAMILY, fontSize: '14px', color: '#cccccc',
    }).setOrigin(0.5);

    createButton(this, coopX, buttonY, 260, 84, t('coopMode'), {
      color: 0x2fbf71,
      fontSize: 28,
    }).on('pointerup', () => this.goTo('CoopMode'));
    this.add.text(coopX, buttonY + 56, t('coopTagline'), {
      fontFamily: FONT_FAMILY, fontSize: '14px', color: '#cccccc',
    }).setOrigin(0.5);

    createButton(this, vsX, buttonY, 260, 84, t('versusMode'), {
      color: 0xff5a5a,
      fontSize: 28,
    }).on('pointerup', () => this.goTo('VersusMode'));
    this.add.text(vsX, buttonY + 56, t('versusTagline'), {
      fontFamily: FONT_FAMILY, fontSize: '14px', color: '#cccccc',
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
    this.buildToggle(w / 2 - 225, y, isMusicEnabled, (on) => {
      setMusicEnabled(on);
      syncMusic(this);
    }, '♪');

    this.buildToggle(w / 2 - 135, y, isSfxEnabled, setSfxEnabled, '🔊');

    // Language is the one setting that really does change every string on
    // screen, so rebuilding the scene is the honest way to apply it.
    createButton(this, w / 2 - 30, y, 96, 64, languageLabel(), { color: 0xff8a3d, fontSize: 18 })
      .on('pointerup', () => {
        setLanguage(nextLanguage());
        this.scene.restart();
      });

    createButton(this, w / 2 + 45, y, 64, 64, '🏆', { color: 0xffb020, fontSize: 26 }).on('pointerup', () => {
      this.showAchievementsPopup(w, h);
    });

    createButton(this, w / 2 + 135, y, 64, 64, 'ℹ', { color: 0x2f9fe0, fontSize: 26 }).on('pointerup', () => {
      this.showContactPopup(w, h);
    });

    createButton(this, w / 2 + 225, y, 64, 64, '≡', { color: 0x8a5cff, fontSize: 26 }).on('pointerup', () => {
      this.showScoreListPopup(w, h);
    });
  }

  // The full achievement list: unlocked ones in colour, locked ones dimmed but
  // still readable, because a goal you cannot see is not a goal. Anything with
  // a numeric target also shows how far along you are.
  showAchievementsPopup(w, h) {
    const unlocked = new Set(getUnlockedAchievements());
    const lifetime = getLifetimeStats();
    const emptyRound = { cutCount: 0, missedCount: 0, reachedStage: 0 };

    const panelW = 560;
    const rowH = 40;
    // Header (88) + rows + room for the close button beneath the last row.
    const panelH = 88 + ACHIEVEMENTS.length * rowH + 78;
    const overlay = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6).setInteractive();
    const top = h / 2 - panelH / 2;

    const panel = this.add.graphics();
    panel.fillStyle(0x123a5c, 0.97);
    panel.fillRoundedRect(w / 2 - panelW / 2, top, panelW, panelH, 20);
    panel.lineStyle(3, 0xffffff, 0.5);
    panel.strokeRoundedRect(w / 2 - panelW / 2, top, panelW, panelH, 20);
    overlay.add([dim, panel]);

    overlay.add(this.add.text(w / 2, top + 32, t('achievements'), {
      fontFamily: FONT_FAMILY, fontSize: '24px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5));
    overlay.add(this.add.text(w / 2, top + 58, t('achievementsProgress', {
      done: unlocked.size, total: ACHIEVEMENTS.length,
    }), {
      fontFamily: FONT_FAMILY, fontSize: '14px', color: '#8affc1',
    }).setOrigin(0.5));

    const left = w / 2 - panelW / 2 + 24;
    ACHIEVEMENTS.forEach((ach, i) => {
      const rowY = top + 88 + i * rowH + rowH / 2;
      const done = unlocked.has(ach.id);

      overlay.add(this.add.text(left, rowY, done ? '★' : '☆', {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: done ? '#ffd23f' : '#5b7c92',
      }).setOrigin(0, 0.5));

      overlay.add(this.add.text(left + 30, rowY - 9, t('ach_' + ach.id), {
        fontFamily: FONT_FAMILY, fontSize: '16px', fontStyle: 'bold',
        color: done ? '#ffffff' : '#8fa9bb',
      }).setOrigin(0, 0.5));

      overlay.add(this.add.text(left + 30, rowY + 10, t('ach_' + ach.id + '_desc'), {
        fontFamily: FONT_FAMILY, fontSize: '12px', color: done ? '#dff2ff' : '#6b8598',
      }).setOrigin(0, 0.5));

      if (!done && ach.goal && ach.progress) {
        let current = 0;
        try {
          current = ach.progress(emptyRound, { ...lifetime, speciesCut: lifetime.speciesCut || {} }) || 0;
        } catch {
          current = 0;
        }
        overlay.add(this.add.text(w / 2 + panelW / 2 - 24, rowY, Math.min(current, ach.goal) + ' / ' + ach.goal, {
          fontFamily: FONT_FAMILY, fontSize: '13px', fontStyle: 'bold', color: '#ffe38a',
        }).setOrigin(1, 0.5));
      }
    });

    const closeBtn = createButton(this, w / 2, top + panelH - 38, 140, 46, t('close'), { color: 0xff8a3d });
    overlay.add(closeBtn);
    closeBtn.on('pointerup', () => overlay.destroy());
    dim.on('pointerdown', () => overlay.destroy());
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
      t('studio'),
      t('howToPlay'),
      380,
    );
  }

  showScoreListPopup(w, h) {
    const list = getScoreList();
    // Entries carry a mode now, and the list mixes solo with co-op runs, so the
    // rows would otherwise be ambiguous.
    const body = list.length
      ? list.slice(0, 5).map((entry, i) => {
        const mode = entry.mode === 'coop' ? t('modeCoop') : t('modeSolo');
        const when = entry.date ? new Date(entry.date).toLocaleDateString() : '';
        return `${i + 1}.  ${entry.score}   ${mode}  ${when}`;
      }).join('\n')
      : t('noRuns');
    this.showPopup(w, h, t('recentScores'), body);
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
      fontFamily: FONT_FAMILY, fontSize: '24px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    const bodyText = this.add.text(w / 2, top + panelHeight / 2 + 6, body, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: '#dff2ff', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);

    overlay.add([dim, panel, titleText, bodyText]);
    const closeBtn = createButton(this, w / 2, top + panelHeight - 40, 140, 50, t('close'), { color: 0xff8a3d });
    overlay.add(closeBtn);
    closeBtn.on('pointerup', () => overlay.destroy());
    dim.on('pointerdown', () => overlay.destroy());
  }
}
