import Phaser from 'phaser';
import { ROUND_TIME_LIMIT } from '../data/fishData.js';
import GameplayLane from '../objects/GameplayLane.js';
import { addUnderwaterBackground, addBubbles } from '../ui/backgroundEffects.js';
import { createButton } from '../ui/createButton.js';
import { LANDSCAPE_W, LANDSCAPE_H, HEADER_HEIGHT, FONT_FAMILY } from '../data/displayConfig.js';
import { formatClock } from '../utils/format.js';
import { startMusic, playSfx, SFX } from '../audio/audio.js';
import ImpactFx from '../ui/impact.js';

// Solo Arc Mode: one fish at a time, a per-fish countdown, swipe to slice it,
// and score based on how close the cut ratio lands to a random target shown on
// the accuracy bar. Difficulty ramps up over the round (see
// fishData.DIFFICULTY_STAGES). Runs until the overall level timer expires.
export default class ArcModeScene extends Phaser.Scene {
  // Subclassed by the Daily Challenge, which is the same round driven by a
  // seeded random source.
  constructor(key = 'ArcMode') {
    super(key);
    this.sceneKey = key;
  }

  // Overridden by the Daily Challenge.
  get resultMode() {
    return 'solo';
  }

  createLaneRandom() {
    return Math.random;
  }

  // Levels run shorter, fixed-length rounds.
  get roundDuration() {
    return ROUND_TIME_LIMIT;
  }

  // Levels restrict the cast, the targets, the current and the clock.
  get laneRules() {
    return {};
  }

  create() {
    this.scale.setGameSize(LANDSCAPE_W, LANDSCAPE_H);
    this.w = this.scale.width;
    this.h = this.scale.height;
    this.roundTimeRemaining = this.roundDuration;
    this.roundOver = false;

    addUnderwaterBackground(this);
    addBubbles(this, 8);
    startMusic(this);

    // Reserve a slim header strip above the lane's own HUD (score/stage/target
    // bar) for the overall round timer + pause button, so neither layer collides
    // with the other.
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x00121f, 0.45);
    headerBg.fillRect(0, 0, this.w, HEADER_HEIGHT);

    this.impact = new ImpactFx(this);

    this.lane = new GameplayLane(this, {
      x: 0, y: HEADER_HEIGHT, width: this.w, height: this.h - HEADER_HEIGHT,
      laneId: 'solo',
      random: this.createLaneRandom(),
      rules: this.laneRules,
      fishScaleMultiplier: this.laneRules.fishScale || 1,
      camera: this.cameras.main,
      impact: this.impact,
    });
    this.lane.start();

    this.roundTimeText = this.add.text(this.w - 76, HEADER_HEIGHT / 2, formatClock(this.roundDuration), {
      fontFamily: FONT_FAMILY, fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(1, 0.5).setDepth(50);

    this.pauseButton = createButton(this, this.w - 34, HEADER_HEIGHT / 2, 48, 32, 'II', { color: 0x8a5cff, fontSize: 14 });
    this.pauseButton.setDepth(50);
    this.pauseButton.on('pointerup', () => this.openPause());

    this.input.on('pointerdown', (p) => {
      // The octopus and the blade share one gesture, so it has to be claimed by
      // the octopus first or a tap on it would also start a swipe.
      if (this.lane.tryCollectOctopusAt(p)) return;
      this.lane.handlePointerDown(p);
    });
    this.input.on('pointermove', (p) => this.lane.handlePointerMove(p));
    this.input.on('pointerup', (p) => this.lane.handlePointerUp(p));
    this.input.on('pointerupoutside', (p) => this.lane.handlePointerUp(p));

    this.roundTimerEvent = this.time.addEvent({ delay: 1000, loop: true, callback: this.tickRound, callbackScope: this });

    this.events.once('shutdown', () => {
      // Releases the hit-stop too, so the shared physics world is never left
      // paused behind us.
      this.impact.destroy();
      this.lane.destroy();
    });
  }

  update(time, delta) {
    this.impact.update(delta);
    this.lane.update(time, delta);
  }

  tickRound() {
    if (this.roundOver) return;
    this.roundTimeRemaining -= 1;
    this.lane.setElapsed(this.roundDuration - this.roundTimeRemaining);
    if (this.roundTimeRemaining <= 0) {
      this.roundTimeRemaining = 0;
      this.updateRoundTimeText();
      this.endRound();
      return;
    }
    this.updateRoundTimeText();
  }

  updateRoundTimeText() {
    this.roundTimeText.setText(formatClock(this.roundTimeRemaining));
    const urgent = this.roundTimeRemaining <= 10;
    this.roundTimeText.setColor(urgent ? '#ff5a5a' : '#ffffff');
    if (urgent && this.roundTimeRemaining > 0) playSfx(this, SFX.TICK);
  }

  endRound() {
    if (this.roundOver) return;
    this.roundOver = true;
    if (this.roundTimerEvent) this.roundTimerEvent.remove(false);
    this.lane.endRound();

    this.time.delayedCall(400, () => {
      this.scene.start('FinalScore', {
        mode: this.resultMode,
        score: this.lane.score,
        stats: this.lane.stats,
        reachedStage: this.lane.stage.minElapsed,
      });
    });
  }

  openPause() {
    if (this.roundOver) return;
    this.scene.pause();
    this.scene.launch('Pause', { parentKey: this.sceneKey });
  }
}
