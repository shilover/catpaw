import { TARGET_PERCENT_STEP } from '../data/fishData.js';
import GameplayLane from '../objects/GameplayLane.js';
import SplitScreenSceneBase from './SplitScreenSceneBase.js';
import { SPLIT_FISH_SCALE, SPLIT_Y, FONT_FAMILY } from '../data/displayConfig.js';

// A perfect cut only blacks out the opponent once the cutter is on a streak.
const BLACKOUT_COMBO = 3;
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
      camera: this.cameras.main, impact: this.impact,
      onCutResolved: (result) => this.onLaneResolved(this.laneA, this.laneB, result),
    });
    this.laneB = new GameplayLane(this, {
      ...regionB, laneId: 'vs-b', fishScaleMultiplier: SPLIT_FISH_SCALE,
      camera: this.camB, impact: this.impact,
      onCutResolved: (result) => this.onLaneResolved(this.laneB, this.laneA, result),
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

  // Three obstructions, each attacking something different, and earned in
  // ascending order of difficulty:
  //   near miss  -> wobble  (attacks the target's stability)
  //   perfect    -> ink     (attacks vision)
  //   perfect on -> blackout(attacks information)
  //   a streak
  // Tiering the strongest one behind a streak also gives the combo system
  // something to do in Versus, where chasing points alone never mattered much.
  onLaneResolved(cutter, opponent, result) {
    if (this.roundOver) return;

    if (result.isPerfect) {
      opponent.applyInkObstruction(2000);
      if (cutter.combo >= BLACKOUT_COMBO) opponent.applyTargetBlackout();
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
      reachedStage: this.laneA.stage.minElapsed,
    });
  }
}
