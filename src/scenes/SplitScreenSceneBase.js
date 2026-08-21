import Phaser from 'phaser';
import { ROUND_TIME_LIMIT } from '../data/fishData.js';
import { addLaneBackground, addBubbles } from '../ui/backgroundEffects.js';
import { createButton } from '../ui/createButton.js';
import { PORTRAIT_W, PORTRAIT_H, SPLIT_Y } from '../data/displayConfig.js';
import { formatClock } from '../utils/format.js';

const PAUSE_BTN_W = 44;
const PAUSE_BTN_H = 30;

// Everything Co-op and Versus share: the portrait canvas, the two lane regions,
// the facing-each-other camera setup, per-half corner HUDs, pointer routing and
// the round clock. Subclasses supply the lanes and decide what happens when the
// round ends.
//
// The physical setup this models: two people share one device lying flat between
// them, each facing their own near edge. The half of the screen physically
// nearest a player is the one they read and tap, so *that* half must appear
// right-side up from *their* seat. The bottom half (region B) is nearest whoever
// holds the device the normal way, so it stays unrotated; the top half (region
// A) is nearest the player sitting opposite and gets the 180 degree flip.
export default class SplitScreenSceneBase extends Phaser.Scene {
  constructor(key, { dividerColor }) {
    super(key);
    this.sceneKey = key;
    this.dividerColor = dividerColor;
  }

  create() {
    // Split-screen modes are portrait, regardless of the solo game's aspect.
    this.scale.setGameSize(PORTRAIT_W, PORTRAIT_H);
    this.w = this.scale.width;
    this.h = this.scale.height;
    this.roundTimeRemaining = ROUND_TIME_LIMIT;
    this.roundOver = false;

    const regionA = { x: 0, y: 0, width: this.w, height: SPLIT_Y };
    const regionB = { x: 0, y: SPLIT_Y, width: this.w, height: this.h - SPLIT_Y };
    this.regionA = regionA;
    this.regionB = regionB;

    addLaneBackground(this, regionA, false);
    addLaneBackground(this, regionB, true);
    addBubbles(this, 7, regionA);
    addBubbles(this, 7, regionB);

    this.setupCameras(regionA, regionB);

    // Subclass builds this.laneA / this.laneB.
    this.createLanes(regionA, regionB);

    this.buildDivider();
    this.timeTexts = [];
    this.pauseButtonRects = [];
    this.buildCorner(regionA);
    this.buildCorner(regionB);
    if (this.buildExtras) this.buildExtras();

    this.input.on('pointerdown', (p) => this.routePointer(p, 'down'));
    this.input.on('pointermove', (p) => this.routePointer(p, 'move'));
    this.input.on('pointerup', (p) => this.routePointer(p, 'up'));
    this.input.on('pointerupoutside', (p) => this.routePointer(p, 'up'));

    this.roundTimerEvent = this.time.addEvent({ delay: 1000, loop: true, callback: this.tickRound, callbackScope: this });

    this.events.once('shutdown', () => {
      this.laneA.destroy();
      this.laneB.destroy();
    });

    if (this.afterCreate) this.afterCreate();
  }

  update(time, delta) {
    this.laneA.update(time, delta);
    this.laneB.update(time, delta);
  }

  setupCameras(regionA, regionB) {
    this.cameras.main.setViewport(0, 0, this.w, SPLIT_Y);
    this.cameras.main.setRotation(Math.PI);
    this.cameras.main.centerOn(regionA.x + regionA.width / 2, regionA.y + regionA.height / 2);

    this.camB = this.cameras.add(0, SPLIT_Y, this.w, this.h - SPLIT_Y);
    this.camB.centerOn(regionB.x + regionB.width / 2, regionB.y + regionB.height / 2);
  }

  buildDivider() {
    const g = this.add.graphics().setDepth(55);
    g.fillStyle(this.dividerColor, 0.8);
    g.fillRect(0, SPLIT_Y - 2, this.w, 4);
  }

  // Each half needs its own round-timer readout + pause button in that lane's
  // own top-right corner — a shared control straddling the divider would render
  // split across both cameras. Each half is rendered exclusively by its own
  // camera and that camera's rotation (0 or 180) already reorients everything it
  // sees, so both lanes' elements are authored with the same unrotated local
  // layout; giving them their own angle would rotate them twice.
  buildCorner(region) {
    const cx = region.x + region.width - 76;
    const cy = region.y + 22;
    const timeText = this.add.text(cx + 20, cy, formatClock(ROUND_TIME_LIMIT), {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(1, 0.5).setDepth(60);

    const btnX = region.x + region.width - 32;
    const btnY = region.y + 22;
    const btn = createButton(this, btnX, btnY, PAUSE_BTN_W, PAUSE_BTN_H, 'II', { color: 0x8a5cff, fontSize: 13 });
    btn.setDepth(60);
    btn.on('pointerup', () => this.openPause());

    this.timeTexts.push(timeText);
    // Phaser's own hit-testing can miss objects seen through a second, rotated
    // camera once more than one interactive object is in play — this manual rect
    // check is a reliable backstop so pause always works.
    this.pauseButtonRects.push({ x: btnX - PAUSE_BTN_W / 2, y: btnY - PAUSE_BTN_H / 2, w: PAUSE_BTN_W, h: PAUSE_BTN_H });
  }

  hitsAnyPauseButton(world) {
    return this.pauseButtonRects.some((r) => (
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
    const label = formatClock(this.roundTimeRemaining);
    const urgent = this.roundTimeRemaining <= 10;
    this.timeTexts.forEach((t) => {
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

    this.time.delayedCall(400, () => this.goToResults());
  }

  openPause() {
    if (this.roundOver) return;
    this.scene.pause();
    this.scene.launch('Pause', { parentKey: this.sceneKey, splitScreen: true });
  }
}
