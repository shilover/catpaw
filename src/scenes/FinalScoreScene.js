import Phaser from 'phaser';
import { createButton } from '../ui/createButton.js';
import { addUnderwaterBackground, addBubbles } from '../ui/backgroundEffects.js';
import {
  getHighScore, saveHighScore, getCoopHighScore, saveCoopHighScore, pushScoreListEntry,
  getLifetimeStats, saveLifetimeStats, getUnlockedAchievements, saveUnlockedAchievements,
  getDailyRecord, saveDailyRecord, saveLevelStars, getSurvivalBest, saveSurvivalBest,
} from '../utils/storage.js';
import { getLevel } from '../data/levels.js';
import { dailyKey } from '../utils/random.js';
import { formatClock } from '../utils/format.js';
import { mergeLifetime, evaluateAchievements } from '../data/achievements.js';
import { shareResult } from '../utils/share.js';
import { LANDSCAPE_W, LANDSCAPE_H, FONT_FAMILY } from '../data/displayConfig.js';
import { startMusic } from '../audio/audio.js';
import { t } from '../i18n/index.js';

const EMPTY_STATS = {
  cutCount: 0, perfectCount: 0, nearPerfectCount: 0, missedCount: 0, octopusCount: 0, bestCombo: 0,
  speciesCut: {},
};

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
    this.reachedStage = data.reachedStage || 0;
    this.levelId = data.levelId || null;
    this.levelStars = data.stars || 0;
    this.survivedSeconds = data.survivedSeconds || 0;
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
    startMusic(this);

    // Record the round before drawing, so anything unlocked can be shown here
    // rather than only turning up the next time the menu is opened.
    this.newAchievements = this.recordRound();

    if (this.mode === 'versus') this.buildVersus(w, h);
    else if (this.mode === 'level') this.buildLevel(w, h);
    else if (this.mode === 'survival') this.buildSurvival(w, h);
    else this.buildSoloOrCoop(w, h);

    this.buildShareButton(w, h);
    this.buildToast(w, h);
    if (this.newAchievements.length) this.announceAchievements(w, h);
  }

  // Folds this round into the lifetime totals, then checks what that unlocked.
  // In Versus both halves count as play, and the winner's stats are the ones
  // that represent the round.
  recordRound() {
    const round = this.mode === 'versus'
      ? {
        ...(this.scoreA >= this.scoreB ? this.statsA : this.statsB),
        score: Math.max(this.scoreA, this.scoreB),
        mode: this.mode,
        won: this.scoreA !== this.scoreB,
        reachedStage: this.reachedStage,
      }
      : {
        ...this.stats, score: this.finalScore, mode: this.mode, reachedStage: this.reachedStage,
      };

    const lifetime = mergeLifetime(getLifetimeStats(), round);
    saveLifetimeStats(lifetime);

    const unlocked = getUnlockedAchievements();
    const fresh = evaluateAchievements(round, lifetime, unlocked);
    if (fresh.length) saveUnlockedAchievements(unlocked.concat(fresh));
    return fresh;
  }

  // Newly earned achievements slide in along the left, one under the other.
  announceAchievements(w, h) {
    this.newAchievements.slice(0, 3).forEach((id, i) => {
      const y = 150 + i * 62;
      const box = this.add.container(-320, y);
      const bg = this.add.graphics();
      bg.fillStyle(0x1c4b2a, 0.95);
      bg.fillRoundedRect(0, -24, 300, 52, 12);
      bg.lineStyle(2, 0x8affc1, 0.9);
      bg.strokeRoundedRect(0, -24, 300, 52, 12);
      const head = this.add.text(14, -12, t('achievementUnlocked'), {
        fontFamily: FONT_FAMILY, fontSize: '10px', fontStyle: 'bold', color: '#8affc1',
      }).setOrigin(0, 0.5);
      const name = this.add.text(14, 10, t('ach_' + id), {
        fontFamily: FONT_FAMILY, fontSize: '17px', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0, 0.5);
      box.add([bg, head, name]);
      box.setDepth(60);
      this.tweens.add({ targets: box, x: 18, duration: 420, delay: 300 + i * 220, ease: 'Back.easeOut' });
    });
  }

  buildShareButton(w, h) {
    createButton(this, w - 110, h - 50, 170, 54, t('share'), { color: 0x2f9fe0, fontSize: 20 })
      .on('pointerup', () => this.doShare());
  }

  async doShare() {
    if (this.sharing) return;
    this.sharing = true;
    const payload = this.mode === 'versus'
      ? { mode: 'versus', scoreA: this.scoreA, scoreB: this.scoreB }
      : {
        mode: this.mode,
        score: this.finalScore,
        perfect: this.stats.perfectCount || 0,
        combo: this.stats.bestCombo || 0,
        date: dailyKey(),
      };
    const outcome = await shareResult(this, payload);
    this.sharing = false;
    if (outcome === 'copied') this.showToast(t('shareCopied'));
    else if (outcome === 'failed') this.showToast(t('shareFailed'));
  }

  buildToast(w, h) {
    this.toast = this.add.text(w / 2, h - 150, '', {
      fontFamily: FONT_FAMILY, fontSize: '20px', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#00121fcc', padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setDepth(70).setAlpha(0);
  }

  showToast(message) {
    this.toast.setText(message).setAlpha(1);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1600, duration: 400 });
  }

  buildSoloOrCoop(w, h) {
    const isCoop = this.mode === 'coop';
    const isDaily = this.mode === 'daily';

    // Three separate records, because they are three different challenges:
    // solo is open-ended, co-op is two players on one fish, and the daily is a
    // fixed set everyone gets. Pooling them would make two of the three
    // unbeatable.
    let previousHigh;
    let isNewHigh;
    if (isDaily) {
      const today = dailyKey();
      previousHigh = getDailyRecord(today).best;
      isNewHigh = saveDailyRecord(today, this.finalScore);
    } else if (isCoop) {
      previousHigh = getCoopHighScore();
      isNewHigh = saveCoopHighScore(this.finalScore);
    } else {
      previousHigh = getHighScore();
      isNewHigh = saveHighScore(this.finalScore);
    }
    pushScoreListEntry(this.finalScore, this.mode);

    let title = t('roundOver');
    if (isCoop) title = t('teamResult');
    else if (isDaily) title = t('dailyResult');
    this.add.text(w / 2, 70, title, {
      fontFamily: FONT_FAMILY, fontSize: '28px', fontStyle: 'bold', color: '#bfe9ff',
    }).setOrigin(0.5);

    this.add.text(w / 2, 128, String(this.finalScore), {
      fontFamily: FONT_FAMILY, fontSize: '58px', fontStyle: 'bold', color: '#ffe38a',
      stroke: '#0a2a4a', strokeThickness: 6,
    }).setOrigin(0.5);

    if (isNewHigh) {
      let badgeText = t('newHighScore');
      if (isCoop) badgeText = t('newTeamBest');
      else if (isDaily) badgeText = t('newDailyBest');
      const badge = this.add.text(w / 2, 178, badgeText, {
        fontFamily: FONT_FAMILY, fontSize: '18px', fontStyle: 'bold', color: '#ffd23f',
      }).setOrigin(0.5);
      this.tweens.add({ targets: badge, scale: 1.15, duration: 500, yoyo: true, repeat: -1 });
    } else {
      const best = Math.max(previousHigh, this.finalScore);
      let label = t('highScore', { score: best });
      if (isCoop) label = t('teamBest', { score: best });
      else if (isDaily) label = t('dailyBest', { score: best });
      this.add.text(w / 2, 178, label, {
        fontFamily: FONT_FAMILY, fontSize: '15px', color: '#dff2ff',
      }).setOrigin(0.5);
    }

    this.buildBreakdown(w / 2, 220, this.stats);

    let replayTarget = 'ArcMode';
    if (isCoop) replayTarget = 'CoopMode';
    else if (isDaily) replayTarget = 'DailyChallenge';
    createButton(this, w / 2, h - 120, 240, 62, t('replay'), { color: 0xff8a3d, fontSize: 26 })
      .on('pointerup', () => this.scene.start(replayTarget));

    createButton(this, w / 2, h - 50, 240, 56, t('mainMenu'), { color: 0x8a5cff, fontSize: 20 })
      .on('pointerup', () => this.scene.start('MainMenu'));
  }

  buildLevel(w, h) {
    const level = getLevel(this.levelId);
    const improved = saveLevelStars(this.levelId, this.levelStars);
    pushScoreListEntry(this.finalScore, 'level');

    this.add.text(w / 2, 62, t('levelResult', { id: this.levelId }), {
      fontFamily: FONT_FAMILY, fontSize: '26px', fontStyle: 'bold', color: '#bfe9ff',
    }).setOrigin(0.5);

    this.add.text(w / 2, 96, level ? t(`skill_${level.skill}`) : '', {
      fontFamily: FONT_FAMILY, fontSize: '17px', color: '#8fb8cf',
    }).setOrigin(0.5);

    const starText = this.add.text(w / 2, 146, '★★★'.slice(0, this.levelStars) + '☆☆☆'.slice(0, 3 - this.levelStars), {
      fontFamily: FONT_FAMILY, fontSize: '46px',
      color: this.levelStars > 0 ? '#ffd23f' : '#446880',
    }).setOrigin(0.5);
    if (this.levelStars > 0) {
      this.tweens.add({ targets: starText, scale: 1.12, duration: 480, yoyo: true, repeat: -1 });
    }

    this.add.text(w / 2, 190, String(this.finalScore), {
      fontFamily: FONT_FAMILY, fontSize: '34px', fontStyle: 'bold', color: '#ffe38a',
    }).setOrigin(0.5);

    if (improved) {
      this.add.text(w / 2, 222, t('newLevelBest'), {
        fontFamily: FONT_FAMILY, fontSize: '16px', fontStyle: 'bold', color: '#8affc1',
      }).setOrigin(0.5);
    }

    this.buildBreakdown(w / 2, 250, this.stats);

    createButton(this, w / 2 - 130, h - 60, 230, 56, t('levelRetry'), { color: 0xff8a3d, fontSize: 20 })
      .on('pointerup', () => this.scene.start('Level', { levelId: this.levelId }));

    // Only offer the next level once this one has actually been cleared, since
    // that is exactly what unlocks it.
    const next = getLevel(this.levelId + 1);
    const canAdvance = next && this.levelStars >= 1;
    createButton(this, w / 2 + 130, h - 60, 230, 56, canAdvance ? t('levelNext') : t('levelSelect'), {
      color: canAdvance ? 0x2fbf71 : 0x8a5cff, fontSize: 20,
    }).on('pointerup', () => {
      if (canAdvance) this.scene.start('Level', { levelId: this.levelId + 1 });
      else this.scene.start('LevelSelect');
    });
  }

  buildSurvival(w, h) {
    const previous = getSurvivalBest();
    const improved = saveSurvivalBest(this.finalScore, this.survivedSeconds);
    pushScoreListEntry(this.finalScore, 'survival');

    this.add.text(w / 2, 68, t('survivalResult'), {
      fontFamily: FONT_FAMILY, fontSize: '28px', fontStyle: 'bold', color: '#bfe9ff',
    }).setOrigin(0.5);

    this.add.text(w / 2, 126, String(this.finalScore), {
      fontFamily: FONT_FAMILY, fontSize: '58px', fontStyle: 'bold', color: '#ffe38a',
      stroke: '#0a2a4a', strokeThickness: 6,
    }).setOrigin(0.5);

    // How long they lasted is the headline number in a mode with lives.
    this.add.text(w / 2, 172, t('survivedFor', { time: formatClock(this.survivedSeconds) }), {
      fontFamily: FONT_FAMILY, fontSize: '20px', fontStyle: 'bold', color: '#8affc1',
    }).setOrigin(0.5);

    if (improved) {
      const badge = this.add.text(w / 2, 204, t('newSurvivalBest'), {
        fontFamily: FONT_FAMILY, fontSize: '17px', fontStyle: 'bold', color: '#ffd23f',
      }).setOrigin(0.5);
      this.tweens.add({ targets: badge, scale: 1.14, duration: 500, yoyo: true, repeat: -1 });
    } else {
      this.add.text(w / 2, 204, t('survivalBest', {
        score: Math.max(previous.score, this.finalScore),
        time: formatClock(Math.max(previous.seconds, this.survivedSeconds)),
      }), {
        fontFamily: FONT_FAMILY, fontSize: '15px', color: '#dff2ff',
      }).setOrigin(0.5);
    }

    this.buildBreakdown(w / 2, 232, this.stats);

    createButton(this, w / 2, h - 120, 240, 62, t('replay'), { color: 0xff8a3d, fontSize: 26 })
      .on('pointerup', () => this.scene.start('Survival'));
    createButton(this, w / 2, h - 50, 240, 56, t('mainMenu'), { color: 0x8a5cff, fontSize: 20 })
      .on('pointerup', () => this.scene.start('MainMenu'));
  }

  buildVersus(w, h) {
    const winner = this.scoreA === this.scoreB ? 'draw' : (this.scoreA > this.scoreB ? 'A' : 'B');

    this.add.text(w / 2, 56, t('matchResult'), {
      fontFamily: FONT_FAMILY, fontSize: '24px', fontStyle: 'bold', color: '#bfe9ff',
    }).setOrigin(0.5);

    const resultLabel = winner === 'draw'
      ? t('draw')
      : t('playerWins', { player: winner === 'A' ? 1 : 2 });
    const resultText = this.add.text(w / 2, 96, resultLabel, {
      fontFamily: FONT_FAMILY, fontSize: '26px', fontStyle: 'bold', color: '#ffd23f',
    }).setOrigin(0.5);
    this.tweens.add({ targets: resultText, scale: 1.1, duration: 500, yoyo: true, repeat: -1 });

    const colW = w / 2 - 30;
    this.buildPlayerColumn(20, 140, colW, t('playerLabel', { player: 1 }), this.scoreA, this.statsA, winner === 'A');
    this.buildPlayerColumn(w / 2 + 10, 140, colW, t('playerLabel', { player: 2 }), this.scoreB, this.statsB, winner === 'B');

    createButton(this, w / 2, h - 116, 240, 60, t('rematch'), { color: 0xff8a3d, fontSize: 24 })
      .on('pointerup', () => this.scene.start('VersusMode'));

    createButton(this, w / 2, h - 48, 240, 54, t('mainMenu'), { color: 0x8a5cff, fontSize: 18 })
      .on('pointerup', () => this.scene.start('MainMenu'));
  }

  buildPlayerColumn(x, y, colW, label, score, stats, isWinner) {
    this.add.text(x + colW / 2, y, (isWinner ? '👑 ' : '') + label, {
      fontFamily: FONT_FAMILY, fontSize: '18px', fontStyle: 'bold', color: isWinner ? '#ffd23f' : '#ffffff',
    }).setOrigin(0.5);
    this.add.text(x + colW / 2, y + 40, String(score), {
      fontFamily: FONT_FAMILY, fontSize: '38px', fontStyle: 'bold', color: '#ffe38a',
    }).setOrigin(0.5);

    this.buildBreakdown(x + colW / 2, y + 78, stats, colW - 20);
  }

  buildBreakdown(centerX, y, stats, width = 340) {
    const rows = [
      [t('statFishCut'), stats.cutCount],
      [t('statPerfect'), stats.perfectCount],
      [t('statClose'), stats.nearPerfectCount],
      [t('statMissed'), stats.missedCount],
      [t('statOctopus'), stats.octopusCount],
      [t('statBestCombo'), stats.bestCombo || 0],
    ];
    const rowH = 34;

    const panel = this.add.graphics();
    panel.fillStyle(0x00121f, 0.35);
    panel.fillRoundedRect(centerX - width / 2, y, width, rows.length * rowH + 16, 14);

    rows.forEach(([label, value], i) => {
      const rowY = y + 14 + i * rowH + rowH / 2;
      this.add.text(centerX - width / 2 + 18, rowY, label, {
        fontFamily: FONT_FAMILY, fontSize: '15px', color: '#ffffff',
      }).setOrigin(0, 0.5);
      this.add.text(centerX + width / 2 - 18, rowY, String(value), {
        fontFamily: FONT_FAMILY, fontSize: '16px', fontStyle: 'bold', color: '#ffe38a',
      }).setOrigin(1, 0.5);
    });
  }
}
