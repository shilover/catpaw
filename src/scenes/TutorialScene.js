import Phaser from 'phaser';
import GameplayLane from '../objects/GameplayLane.js';
import ImpactFx from '../ui/impact.js';
import { addUnderwaterBackground, addBubbles } from '../ui/backgroundEffects.js';
import { createButton } from '../ui/createButton.js';
import { LANDSCAPE_W, LANDSCAPE_H, HEADER_HEIGHT, FONT_FAMILY } from '../data/displayConfig.js';
import { CUT_FISH_TYPES } from '../data/fishData.js';
import { startMusic } from '../audio/audio.js';
import { setTutorialDone } from '../utils/storage.js';
import { t } from '../i18n/index.js';

// A first-run tutorial that teaches by playing, not by explaining.
//
// It runs the real GameplayLane — same cutting, same scoring, same feedback —
// with the pressure removed: no round clock, no per-fish countdown, and the
// ideal-cut line forced on so the very first lesson is what a target percentage
// actually looks like on a fish. Each step waits for the player to do the thing
// rather than for a timer, so nobody is rushed past the bit they are stuck on.
export default class TutorialScene extends Phaser.Scene {
  constructor() {
    super('Tutorial');
  }

  create() {
    this.scale.setGameSize(LANDSCAPE_W, LANDSCAPE_H);
    this.w = this.scale.width;
    this.h = this.scale.height;
    this.stepIndex = -1;
    this.finished = false;

    addUnderwaterBackground(this);
    addBubbles(this, 8);
    startMusic(this);

    this.impact = new ImpactFx(this);

    this.lane = new GameplayLane(this, {
      x: 0,
      y: HEADER_HEIGHT,
      width: this.w,
      height: this.h - HEADER_HEIGHT,
      laneId: 'tutorial',
      // No countdown and no self-spawning: the script owns the pacing.
      timedFish: false,
      forceCutGuide: true,
      onRoundAdvance: () => {},
      onCutResolved: (result) => this.onCutResolved(result),
      camera: this.cameras.main,
      impact: this.impact,
    });

    this.buildOverlay();

    this.input.on('pointerdown', (p) => {
      if (this.lane.tryCollectOctopusAt(p)) {
        this.onOctopusCollected();
        return;
      }
      this.lane.handlePointerDown(p);
    });
    this.input.on('pointermove', (p) => this.lane.handlePointerMove(p));
    this.input.on('pointerup', (p) => this.lane.handlePointerUp(p));
    this.input.on('pointerupoutside', (p) => this.lane.handlePointerUp(p));

    this.events.once('shutdown', () => {
      this.impact.destroy();
      this.lane.destroy();
    });

    this.steps = this.buildSteps();
    this.nextStep();
  }

  update(time, delta) {
    this.impact.update(delta);
    this.lane.update(time, delta);
  }

  buildOverlay() {
    const barH = 92;
    const y = this.h - barH / 2 - 12;

    const panel = this.add.graphics().setDepth(70);
    panel.fillStyle(0x00121f, 0.82);
    panel.fillRoundedRect(this.w / 2 - 430, y - barH / 2, 860, barH, 16);
    panel.lineStyle(2, 0x8affc1, 0.6);
    panel.strokeRoundedRect(this.w / 2 - 430, y - barH / 2, 860, barH, 16);

    this.stepTitle = this.add.text(this.w / 2, y - 22, '', {
      fontFamily: FONT_FAMILY, fontSize: '21px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(71);

    this.stepBody = this.add.text(this.w / 2, y + 14, '', {
      fontFamily: FONT_FAMILY, fontSize: '15px', color: '#dff2ff', align: 'center',
      wordWrap: { width: 800 },
    }).setOrigin(0.5).setDepth(71);

    this.progressText = this.add.text(this.w - 20, 22, '', {
      fontFamily: FONT_FAMILY, fontSize: '14px', fontStyle: 'bold', color: '#bfe9ff',
    }).setOrigin(1, 0.5).setDepth(71);

    createButton(this, 74, 22, 120, 34, t('tutorialSkip'), { color: 0x8a5cff, fontSize: 15 })
      .setDepth(71)
      .on('pointerup', () => this.finish());
  }

  // Each step names what it wants the player to do, sets up a fish for it, and
  // says which event moves things on.
  buildSteps() {
    const bySpecies = (key) => CUT_FISH_TYPES.find((f) => f.key === key) || CUT_FISH_TYPES[0];

    return [
      {
        id: 'swipe',
        // A fat 50% target: any cut through the middle passes, so the first
        // lesson is only "swipe across the fish".
        setup: () => this.lane.spawnFish(bySpecies('cute'), 50),
        advanceOn: 'cut',
      },
      {
        id: 'target',
        setup: () => this.lane.spawnFish(bySpecies('clown'), 25),
        advanceOn: 'cut',
      },
      {
        id: 'guide',
        setup: () => this.lane.spawnFish(bySpecies('angel'), 15),
        advanceOn: 'cut',
      },
      {
        id: 'octopus',
        // The octopus normally only appears on a perfect cut; here it is handed
        // over so the tap can be taught without demanding perfection first.
        setup: () => {
          this.lane.spawnFish(bySpecies('puffer'), 40);
          this.awaitingOctopus = true;
        },
        advanceOn: 'octopus',
      },
      {
        id: 'combo',
        setup: () => this.lane.spawnFish(bySpecies('ray'), 30),
        advanceOn: 'cut',
      },
    ];
  }

  nextStep() {
    this.stepIndex += 1;
    if (this.stepIndex >= this.steps.length) {
      this.finish();
      return;
    }

    const step = this.steps[this.stepIndex];
    this.stepTitle.setText(t(`tut_${step.id}_title`));
    this.stepBody.setText(t(`tut_${step.id}_body`));
    this.progressText.setText(t('tutorialProgress', {
      step: this.stepIndex + 1,
      total: this.steps.length,
    }));

    // A beat to read the instruction before the fish arrives.
    this.time.delayedCall(420, () => {
      if (this.finished) return;
      step.setup();
    });
  }

  onCutResolved() {
    if (this.finished) return;
    const step = this.steps[this.stepIndex];

    if (step.advanceOn === 'octopus') {
      // Give them an octopus regardless of how the cut went, then wait for the
      // tap rather than for another cut.
      this.time.delayedCall(280, () => {
        if (this.finished || !this.awaitingOctopus) return;
        this.lane.spawnTutorialOctopus();
      });
      return;
    }

    this.time.delayedCall(1500, () => {
      if (this.finished) return;
      this.nextStep();
    });
  }

  onOctopusCollected() {
    if (this.finished || !this.awaitingOctopus) return;
    this.awaitingOctopus = false;
    this.time.delayedCall(700, () => {
      if (this.finished) return;
      this.nextStep();
    });
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    setTutorialDone(true);

    this.stepTitle.setText(t('tut_done_title'));
    this.stepBody.setText(t('tut_done_body'));
    this.progressText.setText('');
    this.lane.endRound();

    this.time.delayedCall(1400, () => {
      this.cameras.main.fadeOut(280, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MainMenu'));
    });
  }
}
