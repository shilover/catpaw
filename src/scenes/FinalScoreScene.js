import Phaser from 'phaser';
import { createButton } from '../ui/createButton.js';
import { addUnderwaterBackground, addBubbles } from '../ui/backgroundEffects.js';
import {
  getHighScore, saveHighScore, getCoopHighScore, saveCoopHighScore, pushScoreListEntry,
} from '../utils/storage.js';
import { LANDSCAPE_W, LANDSCAPE_H } from '../data/displayConfig.js';

const EMPTY_STATS = { cutCount: 0, perfectCount: 0, nearPerfectCount: 0, missedCount: 0, octopusCount: 0 };

// Total score, high-score comparison, a breakdown of the round, plus replay /
// menu buttons. Handles all three modes: solo (high score chase), co-op (shared
// score), versus (P1 vs P2).
export default class FinalScoreScene extends Phaser.Scene {
  constructor() {
    super('FinalScore');
  }

  init(data) {
    this.mode = data.mode || 'solo';
    this.finalScore = data.score || 0;
    this.stats = data.stats || EMPTY_STATS;
    this.scoreA = data.scoreA || 0;
    this.scoreB = data.scoreB || 0;
    this.statsA = data.statsA || EMPTY_STATS;
    this.statsB = data.statsB || EMPTY_STATS;
  }

  create() {
    // The split-screen modes leave the canvas in portrait. This screen's layout
    // (and the background texture it uses) is authored for landscape, so it has
    // to claim the size it needs rather than inherit whatever came before.
    this.scale.setGameSize(LANDSCAPE_W, LANDSCAPE_H);
    const w = this.scale.width;
    const h = this.scale.height;

    addUnderwaterBackground(this);
    addBubbles(this, 12);

    if (this.mode === 'versus') this.buildVersus(w, h);
    else this.buildSoloOrCoop(w, h);
  }

  buildSoloOrCoop(w, h) {
    const isCoop = this.mode === 'coop';
    // Co-op totals are two players working a shared fish, so they get their own
    // best rather than competing with (and permanently beating) solo runs.
    const previousHigh = isCoop ? getCoopHighScore() : getHighScore();
    const isNewHigh = isCoop ? saveCoopHighScore(this.finalScore) : saveHighScore(this.finalScore);
    pushScoreListEntry(this.finalScore, this.mode);

    const title = isCoop ? 'TEAM RESULT' : 'ROUND OVER';
    this.add.text(w / 2, 70, title, {
      fontFamily: 'Arial, sans-serif', fontSize: '28px', fontStyle: 'bold', color: '#bfe9ff',
    }).setOrigin(0.5);

    this.add.text(w / 2, 128, String(this.finalScore), {
      fontFamily: 'Arial, sans-serif', fontSize: '58px', fontStyle: 'bold', color: '#ffe38a',
      stroke: '#0a2a4a', strokeThickness: 6,
    }).setOrigin(0.5);

    if (isNewHigh) {
      const badge = this.add.text(w / 2, 178, isCoop ? '★ NEW TEAM BEST ★' : '★ NEW HIGH SCORE ★', {
        fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffd23f',
      }).setOrigin(0.5);
      this.tweens.add({ targets: badge, scale: 1.15, duration: 500, yoyo: true, repeat: -1 });
    } else {
      const label = isCoop ? 'Team Best' : 'High Score';
      this.add.text(w / 2, 178, label + ': ' + Math.max(previousHigh, this.finalScore), {
        fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#dff2ff',
      }).setOrigin(0.5);
    }

    this.buildBreakdown(w / 2, 220, this.stats);

    const replayTarget = isCoop ? 'CoopMode' : 'ArcMode';
    createButton(this, w / 2, h - 120, 240, 62, 'Replay', { color: 0xff8a3d, fontSize: 26 })
      .on('pointerup', () => this.scene.start(replayTarget));

    createButton(this, w / 2, h - 50, 240, 56, 'Main Menu', { color: 0x8a5cff, fontSize: 20 })
      .on('pointerup', () => this.scene.start('MainMenu'));
  }

  buildVersus(w, h) {
    const winner = this.scoreA === this.scoreB ? 'draw' : (this.scoreA > this.scoreB ? 'A' : 'B');

    this.add.text(w / 2, 56, 'MATCH RESULT', {
      fontFamily: 'Arial, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#bfe9ff',
    }).setOrigin(0.5);

    const resultLabel = winner === 'draw' ? "IT'S A DRAW!" : 'PLAYER ' + (winner === 'A' ? 1 : 2) + ' WINS!';
    const resultText = this.add.text(w / 2, 96, resultLabel, {
      fontFamily: 'Arial, sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#ffd23f',
    }).setOrigin(0.5);
    this.tweens.add({ targets: resultText, scale: 1.1, duration: 500, yoyo: true, repeat: -1 });

    const colW = w / 2 - 30;
    this.buildPlayerColumn(20, 140, colW, 'PLAYER 1', this.scoreA, this.statsA, winner === 'A');
    this.buildPlayerColumn(w / 2 + 10, 140, colW, 'PLAYER 2', this.scoreB, this.statsB, winner === 'B');

    createButton(this, w / 2, h - 116, 240, 60, 'Rematch', { color: 0xff8a3d, fontSize: 24 })
      .on('pointerup', () => this.scene.start('VersusMode'));

    createButton(this, w / 2, h - 48, 240, 54, 'Main Menu', { color: 0x8a5cff, fontSize: 18 })
      .on('pointerup', () => this.scene.start('MainMenu'));
  }

  buildPlayerColumn(x, y, colW, label, score, stats, isWinner) {
    this.add.text(x + colW / 2, y, (isWinner ? '👑 ' : '') + label, {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: isWinner ? '#ffd23f' : '#ffffff',
    }).setOrigin(0.5);
    this.add.text(x + colW / 2, y + 40, String(score), {
      fontFamily: 'Arial, sans-serif', fontSize: '38px', fontStyle: 'bold', color: '#ffe38a',
    }).setOrigin(0.5);

    this.buildBreakdown(x + colW / 2, y + 78, stats, colW - 20);
  }

  buildBreakdown(centerX, y, stats, width = 340) {
    const rows = [
      ['Fish cut', stats.cutCount],
      ['Perfect', stats.perfectCount],
      ['Close', stats.nearPerfectCount],
      ['Missed', stats.missedCount],
      ['Octopus', stats.octopusCount],
    ];
    const rowH = 34;

    const panel = this.add.graphics();
    panel.fillStyle(0x00121f, 0.35);
    panel.fillRoundedRect(centerX - width / 2, y, width, rows.length * rowH + 16, 14);

    rows.forEach(([label, value], i) => {
      const rowY = y + 14 + i * rowH + rowH / 2;
      this.add.text(centerX - width / 2 + 18, rowY, label, {
        fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#ffffff',
      }).setOrigin(0, 0.5);
      this.add.text(centerX + width / 2 - 18, rowY, String(value), {
        fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#ffe38a',
      }).setOrigin(1, 0.5);
    });
  }
}
