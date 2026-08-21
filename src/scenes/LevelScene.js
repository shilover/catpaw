import ArcModeScene from './ArcModeScene.js';
import { getLevel, starsFor } from '../data/levels.js';
import { makeSeededRandom } from '../utils/random.js';
import { FONT_FAMILY, HEADER_HEIGHT } from '../data/displayConfig.js';
import { t } from '../i18n/index.js';

// One level of the seven. Structurally it is Arc Mode with the rules swapped
// out: a fixed seed, a restricted cast, and whichever single dial the level is
// about turned up while the rest are held flat.
export default class LevelScene extends ArcModeScene {
  constructor() {
    super('Level');
  }

  init(data) {
    this.levelId = (data && data.levelId) || 1;
    this.level = getLevel(this.levelId);
  }

  get resultMode() {
    return 'level';
  }

  get roundDuration() {
    return (this.level && this.level.duration) || super.roundDuration;
  }

  createLaneRandom() {
    // Fixed per level, so the run is the same challenge for everyone.
    return makeSeededRandom(this.level ? this.level.seed : 1);
  }

  get laneRules() {
    return (this.level && this.level.rules) || {};
  }

  create() {
    super.create();

    const rules = this.laneRules;
    this.add.text(16, HEADER_HEIGHT / 2, t('levelBadge', {
      id: this.levelId,
      name: t(`skill_${this.level.skill}`),
    }), {
      fontFamily: FONT_FAMILY, fontSize: '15px', fontStyle: 'bold', color: '#ffd23f',
    }).setOrigin(0, 0.5).setDepth(50);

    // What this level is asking for, stated plainly and left on screen — a
    // level whose point you have to infer is just a confusing round.
    this.add.text(this.w / 2, HEADER_HEIGHT + 4, t(`skill_${this.level.skill}_hint`), {
      fontFamily: FONT_FAMILY, fontSize: '14px', color: '#bfe9ff',
    }).setOrigin(0.5, 0).setDepth(50);

    if (rules.cutAngle) this.buildAngleHint(rules.cutAngle);
  }

  buildAngleHint(cutAngle) {
    this.add.text(this.w / 2, HEADER_HEIGHT + 26, t('angleRequirement', {
      degrees: cutAngle.degrees,
    }), {
      fontFamily: FONT_FAMILY, fontSize: '14px', fontStyle: 'bold', color: '#ffd23f',
    }).setOrigin(0.5, 0).setDepth(50);
  }

  endRound() {
    if (this.roundOver) return;
    this.roundOver = true;
    if (this.roundTimerEvent) this.roundTimerEvent.remove(false);
    this.lane.endRound();

    const stats = { ...this.lane.stats, score: this.lane.score };
    const stars = starsFor(this.level, stats);

    this.time.delayedCall(400, () => {
      this.scene.start('FinalScore', {
        mode: 'level',
        levelId: this.levelId,
        stars,
        score: this.lane.score,
        stats: this.lane.stats,
        reachedStage: this.lane.stage.minElapsed,
      });
    });
  }
}
