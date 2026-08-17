import Phaser from 'phaser';
import { ROUND_TIME_LIMIT, CUT_FISH_TYPES, TARGET_PERCENT_OPTIONS } from '../data/fishData.js';
import GameplayLane from '../objects/GameplayLane.js';
import { addLaneBackground, addBubbles } from '../ui/backgroundEffects.js';
import { createButton } from '../ui/createButton.js';

const PORTRAIT_W = 540;
const PORTRAIT_H = 960;
const SPLIT_Y = PORTRAIT_H / 2;
const FISH_SCALE = 0.4;

// Co-op: the screen splits top/bottom, one player per half, facing each
// other across a shared device (the bottom half's camera is rotated 180
// degrees so it reads right-side-up from that player's seat). Both halves
// always show the SAME fish/target — whichever player cuts first decides
// the outcome, and it's applied to both sides as a joint success.
export default class CoopModeScene extends Phaser.Scene {
  constructor() {
    super('CoopMode');
  }

  create() {
    // Split-screen modes are portrait, regardless of the solo game's aspect.
    this.scale.setGameSize(PORTRAIT_W, PORTRAIT_H);
    const w = this.scale.width;
    const h = this.scale.height;
    this.w = w;
    this.h = h;
    this.roundTimeRemaining = ROUND_TIME_LIMIT;
    this.roundOver = false;
    this.advancing = false;

    const regionA = { x: 0, y: 0, width: w, height: SPLIT_Y };
    const regionB = { x: 0, y: SPLIT_Y, width: w, height: h - SPLIT_Y };

    addLaneBackground(this, regionA, false);
    addLaneBackground(this, regionB, true);
    addBubbles(this, 7, regionA);
    addBubbles(this, 7, regionB);

    this.setupCameras(regionA, regionB);

    // onRoundAdvance is a required no-op here: this scene drives spawning
    // itself (one shared fish for both lanes) instead of each lane
    // independently auto-spawning its own random fish.
    this.laneA = new GameplayLane(this, {
      ...regionA, laneId: 'coop-a', fishScaleMultiplier: FISH_SCALE,
      onCutResolved: (result) => this.onEitherResolved('A', result),
      onMissed: () => this.onEitherMissed('A'),
      onRoundAdvance: () => {},
    });
    this.laneB = new GameplayLane(this, {
      ...regionB, laneId: 'coop-b', fishScaleMultiplier: FISH_SCALE,
      onCutResolved: (result) => this.onEitherResolved('B', result),
      onMissed: () => this.onEitherMissed('B'),
      onRoundAdvance: () => {},
    });

    this.buildDivider();
    this.buildCorner(regionA);
    this.buildCorner(regionB);

    this.input.on('pointerdown', (p) => this.routePointer(p, 'down'));
    this.input.on('pointermove', (p) => this.routePointer(p, 'move'));
    this.input.on('pointerup', (p) => this.routePointer(p, 'up'));
    this.input.on('pointerupoutside', (p) => this.routePointer(p, 'up'));

    this.roundTimerEvent = this.time.addEvent({ delay: 1000, loop: true, callback: this.tickRound, callbackScope: this });

    this.spawnSharedFish();
  }

  // Two people share one device lying flat between them, each facing their
  // own near edge. The half of the screen physically nearest a player is
  // the one they need to read/tap — so *that* half must appear right-side
  // up from *their* seat. The bottom half (region B) is nearest whoever
  // views the device the "normal" way (holding it up in default portrait
  // orientation), so it stays unrotated; the top half (region A) is nearest
  // the player sitting opposite, so it's the one that needs the 180° flip.
  setupCameras(regionA, regionB) {
    this.cameras.main.setViewport(0, 0, this.w, SPLIT_Y);
    this.cameras.main.setRotation(Math.PI);
    this.cameras.main.centerOn(regionA.x + regionA.width / 2, regionA.y + regionA.height / 2);

    this.camB = this.cameras.add(0, SPLIT_Y, this.w, this.h - SPLIT_Y);
    this.camB.centerOn(regionB.x + regionB.width / 2, regionB.y + regionB.height / 2);
  }

  buildDivider() {
    const g = this.add.graphics().setDepth(55);
    g.fillStyle(0xffe38a, 0.8);
    g.fillRect(0, SPLIT_Y - 2, this.w, 4);
  }

  // Each half needs its own round-timer readout + pause button, positioned
  // in that lane's own top-right corner — a shared control straddling the
  // divider would render split across both cameras. Each half is rendered
  // exclusively by its own camera, and that camera's rotation (0 or 180)
  // already reorients everything it sees, so lane B's elements are authored
  // with the exact same unrotated local layout as lane A's.
  buildCorner(region) {
    const cx = region.x + region.width - 76;
    const cy = region.y + 22;
    const timeText = this.add.text(cx + 20, cy, '01:00', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(1, 0.5).setDepth(60);

    const btnX = region.x + region.width - 32;
    const btnY = region.y + 22;
    const btnW = 44;
    const btnH = 30;
    const btn = createButton(this, btnX, btnY, btnW, btnH, 'II', { color: 0x8a5cff, fontSize: 13 });
    btn.setDepth(60);
    btn.on('pointerup', () => this.openPause());

    if (!this.timeTexts) this.timeTexts = [];
    this.timeTexts.push(timeText);
    // Phaser's own hit-testing can miss objects seen through a second,
    // rotated camera once more than one interactive object is in play — this
    // manual rect check is a reliable backstop so pause always works.
    if (!this.pauseButtonRects) this.pauseButtonRects = [];
    this.pauseButtonRects.push({ x: btnX - btnW / 2, y: btnY - btnH / 2, w: btnW, h: btnH });
  }

  hitsAnyPauseButton(world) {
    return (this.pauseButtonRects || []).some((r) => (
      world.x >= r.x && world.x <= r.x + r.w && world.y >= r.y && world.y <= r.y + r.h
    ));
  }

  routePointer(pointer, phase) {
    const useCamB = pointer.y >= SPLIT_Y;
    const cam = useCamB ? this.camB : this.cameras.main;
    const world = cam.getWorldPoint(pointer.x, pointer.y);

    if (phase === 'up' && this.hitsAnyPauseButton(world)) {
      this.openPause();
      return;
    }

    const lane = useCamB ? this.laneB : this.laneA;
    if (phase === 'down') {
      if (lane.tryCollectOctopusAt(world)) return;
      lane.handlePointerDown(world);
    } else if (phase === 'move') {
      lane.handlePointerMove(world);
    } else {
      lane.handlePointerUp(world);
    }
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

  onEitherMissed() {
    if (this.advancing) return;
    this.advancing = true;

    const other = this.laneA.currentFish ? this.laneA : (this.laneB.currentFish ? this.laneB : null);
    if (other && other.currentFish) other.onFishTimeout();

    this.time.delayedCall(700, () => {
      if (this.roundOver) return;
      this.spawnSharedFish();
    });
  }

  tickRound() {
    if (this.roundOver) return;
    this.roundTimeRemaining -= 1;
    const elapsed = ROUND_TIME_LIMIT - this.roundTimeRemaining;
    this.laneA.setElapsed(elapsed);
    this.laneB.setElapsed(elapsed);
    this.updateTimeTexts();
    if (this.roundTimeRemaining <= 0) {
      this.roundTimeRemaining = 0;
      this.endRound();
    }
  }

  updateTimeTexts() {
    const mm = Math.floor(this.roundTimeRemaining / 60).toString().padStart(2, '0');
    const ss = Math.floor(this.roundTimeRemaining % 60).toString().padStart(2, '0');
    const label = `${mm}:${ss}`;
    const urgent = this.roundTimeRemaining <= 10;
    (this.timeTexts || []).forEach((t) => {
      t.setText(label);
      t.setColor(urgent ? '#ff5a5a' : '#ffffff');
    });
  }

  endRound() {
    if (this.roundOver) return;
    this.roundOver = true;
    if (this.roundTimerEvent) this.roundTimerEvent.remove(false);
    this.laneA.endRound();
    this.laneB.endRound();

    this.time.delayedCall(400, () => {
      this.scene.start('FinalScore', {
        mode: 'coop',
        score: this.laneA.score,
        stats: this.laneA.stats,
      });
    });
  }

  openPause() {
    if (this.roundOver) return;
    this.scene.pause();
    this.scene.launch('Pause', { parentKey: 'CoopMode' });
  }
}
