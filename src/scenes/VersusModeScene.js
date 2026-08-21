import { TARGET_PERCENT_STEP } from '../data/fishData.js';
import GameplayLane from '../objects/GameplayLane.js';
import SplitScreenSceneBase from './SplitScreenSceneBase.js';
import { SPLIT_FISH_SCALE, SPLIT_Y, FONT_FAMILY } from '../data/displayConfig.js';
import { t } from '../i18n/index.js';

// Versus: same top/bottom split-screen setup as Co-op, but each half spawns its
// own independent fish and keeps its own score. A perfect cut splats ink across
// the opponent's half (obscuring it for a moment); a near-miss (one 5% bucket
// off) makes the opponent's current fish wobble.
export default class VersusModeScene extends SplitScreenSceneBase {
  constructor() {
    super('VersusMode', { dividerColor: 0xff8a3d });
  }

  createLanes(regionA, regionB) {
    this.laneA = new GameplayLane(this, {
      ...regionA, laneId: 'vs-a', fishScaleMultiplier: SPLIT_FISH_SCALE,
      onCutResolved: (result) => this.onLaneResolved(this.laneB, result),
    });
    this.laneB = new GameplayLane(this, {
      ...regionB, laneId: 'vs-b', fishScaleMultiplier: SPLIT_FISH_SCALE,
      onCutResolved: (result) => this.onLaneResolved(this.laneA, result),
    });
  }

  // Each half is rendered exclusively by its own camera, and that camera's
  // rotation (0 or 180) already reorients everything it sees — so lane B's label
  // is authored with the same unrotated local layout as lane A's.
  buildExtras() {
    this.add.text(12, SPLIT_Y - 14, t('playerOne'), {
      fontFamily: FONT_FAMILY, fontSize: '14px', fontStyle: 'bold', color: '#ffe38a',
    }).setOrigin(0, 1).setDepth(56);
    this.add.text(12, SPLIT_Y + 14, t('playerTwo'), {
      fontFamily: FONT_FAMILY, fontSize: '14px', fontStyle: 'bold', color: '#ffe38a',
    }).setOrigin(0, 0).setDepth(56);
  }

  afterCreate() {
    this.laneA.start();
    this.laneB.start();
  }

  onLaneResolved(opponent, result) {
    if (this.roundOver) return;
    if (result.isPerfect) {
      opponent.applyInkObstruction(2000);
    } else if (result.diff === TARGET_PERCENT_STEP) {
      opponent.applyFishWobble(1800);
    }
  }

  goToResults() {
    this.scene.start('FinalScore', {
      mode: 'versus',
      scoreA: this.laneA.score,
      scoreB: this.laneB.score,
      statsA: this.laneA.stats,
      statsB: this.laneB.stats,
    });
  }
}
