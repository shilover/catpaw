import ArcModeScene from './ArcModeScene.js';
import { FONT_FAMILY, HEADER_HEIGHT } from '../data/displayConfig.js';
import { playSfx, SFX } from '../audio/audio.js';
import { t } from '../i18n/index.js';

const LIVES = 3;

// How hard it gets, and how fast. The endless modes stop escalating once the
// last difficulty stage is reached; here the dials keep moving, because the run
// only ends when the player runs out of lives and a ceiling would mean a good
// player never ends at all.
const RAMP_SECONDS = 180;
const CUT_TIME_START = 5.0;
const CUT_TIME_FLOOR = 1.5;
const WIND_START = 0;
const WIND_MAX = 130;
const WIND_SPEED_START = 0.8;
const WIND_SPEED_MAX = 4.2;

// Survival: no clock, three lives, difficulty that never stops climbing.
//
// Every other mode runs for a fixed sixty seconds no matter how badly it goes,
// which means chasing a high score carries no tension — a bad run costs points,
// never the run itself. Here a missed fish costs a life, so the score is a
// record of how long you kept it together.
export default class SurvivalScene extends ArcModeScene {
  constructor() {
    super('Survival');
  }

  get resultMode() {
    return 'survival';
  }

  get hasRoundTimer() {
    return false;
  }

  get laneRules() {
    // Seeded from the ramp at time zero; updated every frame as it climbs.
    return {
      cutTime: CUT_TIME_START,
      wind: { amplitude: WIND_START, speed: WIND_SPEED_START },
    };
  }

  get laneCallbacks() {
    return { onMissed: () => this.loseLife() };
  }

  create() {
    super.create();
    this.lives = LIVES;
    this.survivedMs = 0;

    // The round timer readout has nothing to count down to here; it becomes the
    // elapsed clock instead, which is the number this mode is actually about.
    this.roundTimeText.setText('00:00');

    this.livesText = this.add.text(16, HEADER_HEIGHT / 2, '', {
      fontFamily: FONT_FAMILY, fontSize: '17px', fontStyle: 'bold', color: '#ff8a8a',
    }).setOrigin(0, 0.5).setDepth(50);
    this.refreshLives();
  }

  refreshLives() {
    this.livesText.setText(t('livesLeft', {
      hearts: '♥'.repeat(this.lives) + '♡'.repeat(Math.max(0, LIVES - this.lives)),
    }));
  }

  update(time, delta) {
    super.update(time, delta);
    if (this.roundOver) return;

    this.survivedMs += delta;
    const seconds = this.survivedMs / 1000;
    this.applyRamp(seconds);

    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(Math.floor(seconds % 60)).padStart(2, '0');
    this.roundTimeText.setText(`${mm}:${ss}`);
    // Keeps the difficulty banner and stage label in step with the ramp.
    this.lane.setElapsed(seconds);
  }

  // Read by the lane the next time it spawns, so the pressure rises between
  // fish rather than mid-cut.
  applyRamp(seconds) {
    const progress = Math.min(1, seconds / RAMP_SECONDS);
    const rules = this.lane.rules;
    rules.cutTime = CUT_TIME_START - (CUT_TIME_START - CUT_TIME_FLOOR) * progress;
    rules.wind.amplitude = WIND_START + (WIND_MAX - WIND_START) * progress;
    rules.wind.speed = WIND_SPEED_START + (WIND_SPEED_MAX - WIND_SPEED_START) * progress;
  }

  loseLife() {
    if (this.roundOver) return;
    this.lives -= 1;
    this.refreshLives();
    playSfx(this, SFX.COMBO_BREAK);

    this.cameras.main.shake(180, 0.008);
    if (this.lives > 0) return;
    this.endRound();
  }

  endRound() {
    if (this.roundOver) return;
    this.roundOver = true;
    this.lane.endRound();

    this.time.delayedCall(700, () => {
      this.scene.start('FinalScore', {
        mode: 'survival',
        score: this.lane.score,
        stats: this.lane.stats,
        survivedSeconds: Math.floor(this.survivedMs / 1000),
        reachedStage: this.lane.stage.minElapsed,
      });
    });
  }
}
