import Phaser from 'phaser';
import { ROUND_TIME_LIMIT } from '../data/fishData.js';
import GameplayLane from '../objects/GameplayLane.js';
import { addUnderwaterBackground, addBubbles } from '../ui/backgroundEffects.js';
import { createButton } from '../ui/createButton.js';
import { LANDSCAPE_W, LANDSCAPE_H } from '../data/displayConfig.js';

// Solo Arc Mode: one fish at a time, a per-fish countdown, swipe to slice
// it, and score based on how close the cut ratio lands to a random target
// shown on the accuracy bar. Difficulty ramps up over the round (see
// fishData.DIFFICULTY_STAGES). Runs until the overall level timer expires.
export default class ArcModeScene extends Phaser.Scene {
  constructor() {
    super('ArcMode');
  }

  create() {
    this.scale.setGameSize(LANDSCAPE_W, LANDSCAPE_H);
    this.w = this.scale.width;
    this.h = this.scale.height;
    this.roundTimeRemaining = ROUND_TIME_LIMIT;
    this.roundOver = false;

    addUnderwaterBackground(this);
    addBubbles(this, 8);

    // Reserve a slim header strip above the lane's own HUD (score/stage/
    // target bar) for the overall round timer + pause button, so neither
    // layer collides with the other.
    const headerH = 44;
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x00121f, 0.45);
    headerBg.fillRect(0, 0, this.w, headerH);

    this.lane = new GameplayLane(this, {
      x: 0, y: headerH, width: this.w, height: this.h - headerH,
      laneId: 'solo',
    });
    this.lane.start();

    this.roundTimeText = this.add.text(this.w - 76, headerH / 2, '01:00', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(1, 0.5).setDepth(50);

    this.pauseButton = createButton(this, this.w - 34, headerH / 2, 48, 32, 'II', { color: 0x8a5cff, fontSize: 14 });
    this.pauseButton.setDepth(50);
    this.pauseButton.on('pointerup', () => this.openPause());

    this.input.on('pointerdown', (p) => this.lane.handlePointerDown(p));
    this.input.on('pointermove', (p) => this.lane.handlePointerMove(p));
    this.input.on('pointerup', (p) => this.lane.handlePointerUp(p));
    this.input.on('pointerupoutside', (p) => this.lane.handlePointerUp(p));

    this.roundTimerEvent = this.time.addEvent({ delay: 1000, loop: true, callback: this.tickRound, callbackScope: this });
  }

  tickRound() {
    if (this.roundOver) return;
    this.roundTimeRemaining -= 1;
    this.lane.setElapsed(ROUND_TIME_LIMIT - this.roundTimeRemaining);
    if (this.roundTimeRemaining <= 0) {
      this.roundTimeRemaining = 0;
      this.updateRoundTimeText();
      this.endRound();
      return;
    }
    this.updateRoundTimeText();
  }

  updateRoundTimeText() {
    const mm = Math.floor(this.roundTimeRemaining / 60).toString().padStart(2, '0');
    const ss = Math.floor(this.roundTimeRemaining % 60).toString().padStart(2, '0');
    this.roundTimeText.setText(`${mm}:${ss}`);
    this.roundTimeText.setColor(this.roundTimeRemaining <= 10 ? '#ff5a5a' : '#ffffff');
  }

  endRound() {
    if (this.roundOver) return;
    this.roundOver = true;
    if (this.roundTimerEvent) this.roundTimerEvent.remove(false);
    this.lane.endRound();

    this.time.delayedCall(400, () => {
      this.scene.start('FinalScore', { mode: 'solo', score: this.lane.score, stats: this.lane.stats });
    });
  }

  openPause() {
    if (this.roundOver) return;
    this.scene.pause();
    this.scene.launch('Pause', { parentKey: 'ArcMode' });
  }
}
