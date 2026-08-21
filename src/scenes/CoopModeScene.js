import Phaser from 'phaser';
import {
  TARGET_PERCENT_OPTIONS, TARGET_PERCENT_STEP, pickWeightedFish, COOP_ADVANCE_MS,
} from '../data/fishData.js';
import GameplayLane from '../objects/GameplayLane.js';
import SplitScreenSceneBase from './SplitScreenSceneBase.js';
import { SPLIT_FISH_SCALE } from '../data/displayConfig.js';
import { t } from '../i18n/index.js';

// Points for both players when their two cuts land in the same 5% bucket.
const SYNC_BONUS = 60;

// Co-op: the screen splits top/bottom, one player per half, facing each other
// across a shared device. Both halves get the same species at the same target.
//
// **Both players have to cut.** The round used to resolve on whichever of them
// swiped first and copy that outcome onto the other half, which meant the second
// player's skill changed nothing at all — they were a spectator sitting beside
// someone playing solo. Now each half is scored on its own cut, and landing in
// the same bucket as your partner pays a bonus, so the two of them have a reason
// to talk to each other about where the line goes.
export default class CoopModeScene extends SplitScreenSceneBase {
  constructor() {
    super('CoopMode', { dividerColor: 0xffe38a });
  }

  createLanes(regionA, regionB) {
    this.settled = { A: null, B: null };

    // onRoundAdvance is a required no-op here: this scene drives spawning itself
    // (one shared fish for both lanes) instead of each lane independently
    // auto-spawning its own random fish.
    this.laneA = new GameplayLane(this, {
      ...regionA,
      laneId: 'coop-a',
      fishScaleMultiplier: SPLIT_FISH_SCALE,
      camera: this.cameras.main,
      impact: this.impact,
      onCutResolved: (result) => this.onLaneSettled('A', result),
      onMissed: () => this.onLaneSettled('A', null),
      onRoundAdvance: () => {},
    });
    this.laneB = new GameplayLane(this, {
      ...regionB,
      laneId: 'coop-b',
      fishScaleMultiplier: SPLIT_FISH_SCALE,
      camera: this.camB,
      impact: this.impact,
      onCutResolved: (result) => this.onLaneSettled('B', result),
      onMissed: () => this.onLaneSettled('B', null),
      onRoundAdvance: () => {},
    });
  }

  afterCreate() {
    this.spawnSharedFish();
  }

  spawnSharedFish() {
    if (this.roundOver) return;
    this.settled = { A: null, B: null };
    const fishType = pickWeightedFish();
    const target = Phaser.Utils.Array.GetRandom(TARGET_PERCENT_OPTIONS);
    this.laneA.spawnFish(fishType, target);
    this.laneB.spawnFish(fishType, target);
  }

  // Called once per half, whether that half cut its fish or let it time out.
  onLaneSettled(who, result) {
    if (this.roundOver || this.settled[who]) return;
    this.settled[who] = result || { missed: true };

    // Each half keeps its own fish and its own clock until it acts, so nobody
    // is rushed off their shot by a quicker partner.
    if (!this.settled.A || !this.settled.B) return;
    this.resolveSharedFish();
  }

  resolveSharedFish() {
    const a = this.settled.A;
    const b = this.settled.B;
    const together = !a.missed && !b.missed
      && Math.abs(a.snapped - b.snapped) <= TARGET_PERCENT_STEP;

    if (together) {
      this.laneA.awardBonus(SYNC_BONUS, t('syncBonus'));
      this.laneB.awardBonus(SYNC_BONUS, t('syncBonus'));
    }

    this.time.delayedCall(COOP_ADVANCE_MS, () => {
      if (this.roundOver) return;
      this.spawnSharedFish();
    });
  }

  goToResults() {
    // Both players now cut their own fish, so the two scores are independent
    // and simply add up. (While one cut was being copied onto the other half,
    // summing would have double-counted every point.)
    const stats = {
      cutCount: this.laneA.stats.cutCount + this.laneB.stats.cutCount,
      perfectCount: this.laneA.stats.perfectCount + this.laneB.stats.perfectCount,
      nearPerfectCount: this.laneA.stats.nearPerfectCount + this.laneB.stats.nearPerfectCount,
      missedCount: this.laneA.stats.missedCount + this.laneB.stats.missedCount,
      octopusCount: this.laneA.stats.octopusCount + this.laneB.stats.octopusCount,
      bestCombo: Math.max(this.laneA.stats.bestCombo, this.laneB.stats.bestCombo),
      speciesCut: { ...this.laneA.stats.speciesCut },
    };

    this.scene.start('FinalScore', {
      mode: 'coop',
      score: this.laneA.score + this.laneB.score,
      stats,
      reachedStage: this.laneA.stage.minElapsed,
    });
  }
}
