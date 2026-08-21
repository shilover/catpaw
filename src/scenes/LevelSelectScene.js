import Phaser from 'phaser';
import { createButton } from '../ui/createButton.js';
import { addUnderwaterBackground, addBubbles } from '../ui/backgroundEffects.js';
import { LEVELS, TOTAL_STARS, isLevelUnlocked } from '../data/levels.js';
import { getLevelStars, getTotalStars } from '../utils/storage.js';
import { LANDSCAPE_W, LANDSCAPE_H, FONT_FAMILY } from '../data/displayConfig.js';
import { startMusic, playSfx, SFX } from '../audio/audio.js';
import { t } from '../i18n/index.js';

const CARD_W = 150;
const CARD_H = 176;

// The seven levels, laid out in a row. Locked ones stay visible and legible —
// a goal you cannot see is not a goal — they just cannot be entered yet.
export default class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelect');
  }

  create() {
    this.scale.setGameSize(LANDSCAPE_W, LANDSCAPE_H);
    const w = this.scale.width;
    const h = this.scale.height;

    addUnderwaterBackground(this);
    addBubbles(this, 10);
    startMusic(this);

    this.add.text(w / 2, 58, t('levels'), {
      fontFamily: FONT_FAMILY, fontSize: '34px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#0a2a4a', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(w / 2, 96, t('starsProgress', { got: getTotalStars(), total: TOTAL_STARS }), {
      fontFamily: FONT_FAMILY, fontSize: '17px', fontStyle: 'bold', color: '#ffd23f',
    }).setOrigin(0.5);

    const stars = getLevelStars();
    const gap = 20;
    const totalW = LEVELS.length * CARD_W + (LEVELS.length - 1) * gap;
    const startX = w / 2 - totalW / 2 + CARD_W / 2;

    LEVELS.forEach((level, i) => {
      this.buildCard(level, startX + i * (CARD_W + gap), h / 2 + 10, stars);
    });

    createButton(this, w / 2, h - 58, 240, 56, t('mainMenu'), { color: 0x8a5cff, fontSize: 20 })
      .on('pointerup', () => this.scene.start('MainMenu'));
  }

  buildCard(level, x, y, starsById) {
    const unlocked = isLevelUnlocked(level.id, starsById);
    const earned = starsById[level.id] || 0;

    const card = this.add.graphics();
    card.fillStyle(unlocked ? 0x123a5c : 0x0d2438, 0.94);
    card.fillRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 16);
    card.lineStyle(2, unlocked ? 0x8affc1 : 0x2b4a60, 0.9);
    card.strokeRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 16);

    this.add.text(x, y - CARD_H / 2 + 26, String(level.id), {
      fontFamily: FONT_FAMILY, fontSize: '30px', fontStyle: 'bold',
      color: unlocked ? '#ffffff' : '#54748a',
    }).setOrigin(0.5);

    this.add.text(x, y - 22, t(`skill_${level.skill}`), {
      fontFamily: FONT_FAMILY, fontSize: '16px', fontStyle: 'bold',
      color: unlocked ? '#bfe9ff' : '#54748a', align: 'center',
      wordWrap: { width: CARD_W - 18 },
    }).setOrigin(0.5);

    this.add.text(x, y + 12, t(`skill_${level.skill}_short`), {
      fontFamily: FONT_FAMILY, fontSize: '11px',
      color: unlocked ? '#8fb8cf' : '#3f5f74', align: 'center',
      wordWrap: { width: CARD_W - 18 },
    }).setOrigin(0.5);

    // Stars read at a glance whether this one is finished or merely passed.
    this.add.text(x, y + 48, '★★★'.slice(0, earned) + '☆☆☆'.slice(0, 3 - earned), {
      fontFamily: FONT_FAMILY, fontSize: '19px',
      color: earned > 0 ? '#ffd23f' : '#446880',
    }).setOrigin(0.5);

    if (unlocked) {
      createButton(this, x, y + CARD_H / 2 - 24, CARD_W - 28, 34, t('levelPlay'), {
        color: 0xff8a3d, fontSize: 15,
      }).on('pointerup', () => this.scene.start('Level', { levelId: level.id }));
    } else {
      this.add.text(x, y + CARD_H / 2 - 24, t('levelLocked'), {
        fontFamily: FONT_FAMILY, fontSize: '13px', color: '#54748a',
      }).setOrigin(0.5);
    }
  }
}
