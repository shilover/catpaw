import Phaser from 'phaser';
import { CUT_FISH_TYPES, TARGET_PERCENT_OPTIONS } from '../data/fishData.js';
import GameplayLane from '../objects/GameplayLane.js';
import SplitScreenSceneBase from './SplitScreenSceneBase.js';
import { SPLIT_FISH_SCALE } from '../data/displayConfig.js';

// Co-op: the screen splits top/bottom, one player per half, facing each other
// across a shared device. Both halves always show the SAME fish/target —
// whichever player cuts first decides the outcome, and it is applied to both
// sides as a joint success.
export default class CoopModeScene extends SplitScreenSceneBase {
  constructor() {
    super('CoopMode', { dividerColor: 0xffe38a });
  }

  createLanes(regionA, regionB) {
    this.advancing = false;

    // onRoundAdvance is a required no-op here: this scene drives spawning itself
    // (one shared fish for both lanes) instead of each lane independently
    // auto-spawning its own random fish.
    this.laneA = new GameplayLane(this, {
      ...regionA, laneId: 'coop-a', fishScaleMultiplier: SPLIT_FISH_SCALE,
      onCutResolved: (result) => this.onEitherResolved('A', result),
      onMissed: () => this.onEitherMissed('A'),
      onRoundAdvance: () => {},
    });
    this.laneB = new GameplayLane(this, {
      ...regionB, laneId: 'coop-b', fishScaleMultiplier: SPLIT_FISH_SCALE,
      onCutResolved: (result) => this.onEitherResolved('B', result),
      onMissed: () => this.onEitherMissed('B'),
      onRoundAdvance: () => {},
    });
  }

  afterCreate() {
    this.spawnSharedFish();
  }

  spawnSharedFish() {
    if (this.roundOver) return;
    this.advancing = false;
    const fishType = Phaser.Utils.Array.GetRandom(CUT_FISH_TYPES);
    const target = Phaser.Utils.Array.GetRandom(TARGET_PERCENT_OPTIONS);
    this.laneA.spawnFish(fishType, target);
    this.laneB.spawnFish(fishType, target);
  }

  onEitherResolved(who, result) {
    if (this.advancing) return;
    this.advancing = true;

    const other = who === 'A' ? this.laneB : this.laneA;
    other.resolveWithPercent(result.rawPercent);

    this.time.delayedCall(900, () => {
      if (this.roundOver) return;
      this.spawnSharedFish();
    });
  }

  onEitherMissed(who) {
    if (this.advancing) return;
    this.advancing = true;

    // The fish is shared, so the other half has to time out on the same beat
    // rather than keep counting down on a fish that is already gone.
    const other = who === 'A' ? this.laneB : this.laneA;
    if (other.currentFish) other.onFishTimeout();

    this.time.delayedCall(700, () => {
      if (this.roundOver) return;
      this.spawnSharedFish();
    });
  }

  goToResults() {
    // Both lanes resolve the same fish with the same percentage, so their cut
    // points are identical — summing the two raw scores would double every cut.
    // The only score a player earns alone is the bonus octopus, so the team
    // total is one lane's score plus the other's bonus. (Reporting laneA.score
    // alone used to silently drop every octopus P2 collected.)
    const teamScore = this.laneA.score + this.laneB.bonusScore;
    const stats = {
      ...this.laneA.stats,
      octopusCount: this.laneA.stats.octopusCount + this.laneB.stats.octopusCount,
    };

    this.scene.start('FinalScore', { mode: 'coop', score: teamScore, stats });
  }
}
