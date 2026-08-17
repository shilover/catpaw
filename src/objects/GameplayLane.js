import Phaser from 'phaser';
import {
  CUT_FISH_TYPES,
  TARGET_PERCENT_OPTIONS,
  TARGET_PERCENT_STEP,
  snapToGrid,
  scoreForDiff,
  getStageForElapsed,
} from '../data/fishData.js';
import CuttableFish from './CuttableFish.js';
import BonusOctopus from './BonusOctopus.js';
import TargetBar from '../ui/targetBar.js';
import {
  buildEllipsePolygon,
  cutPolygon,
  polygonArea,
  polygonCentroid,
  pointSegmentDistance,
} from '../utils/polygonCut.js';

const MIN_SWIPE_DISTANCE = 40;
const HUD_HEIGHT = 96;
const FLOOR_MARGIN = 20;
const FISH_TEXTURE_W = 140;
const FISH_TEXTURE_H = 96;
const RING_PADDING = 8;

// One player's play area: spawns fish, tracks its own swipes/score, and
// reacts to difficulty stages + (in Versus) obstruction effects from the
// opponent. Positioned in absolute world coordinates (a rect); the owning
// Scene decides how that rect is actually presented on screen (a plain
// viewport for a solo game, or a rotated split-screen camera for 2P modes).
export default class GameplayLane {
  constructor(scene, opts) {
    this.scene = scene;
    this.regionX = opts.x;
    this.regionY = opts.y;
    this.regionW = opts.width;
    this.regionH = opts.height;
    this.laneId = opts.laneId || 'solo';
    this.showTargetBar = opts.showTargetBar !== false;
    this.onScoreChange = opts.onScoreChange || (() => {});
    this.onCutResolved = opts.onCutResolved || (() => {});
    this.onMissed = opts.onMissed || (() => {});
    // Solo/Versus lanes auto-spawn their own next fish; Co-op overrides this
    // so the scene can spawn one shared fish for both lanes at once instead.
    this.onRoundAdvance = opts.onRoundAdvance || null;
    // Split-screen lanes are much shorter than a full solo screen, so fish
    // (sized for the old full-height layout) need to shrink to fit.
    this.fishScaleMultiplier = opts.fishScaleMultiplier || 1;

    this.score = 0;
    this.stats = { cutCount: 0, perfectCount: 0, nearPerfectCount: 0, missedCount: 0, octopusCount: 0 };
    this.roundOver = false;
    this.currentFish = null;
    this.dragStart = null;
    this.elapsed = 0;
    this.stage = getStageForElapsed(0);
    this.disabled = false;

    this.gameLayer = scene.add.container(0, 0);
    this.trailGraphics = scene.add.graphics().setDepth(20);
    this.obstructionLayer = scene.add.graphics().setDepth(40);

    this.buildHud();

    this.fishTickEvent = null;
  }

  get floorY() {
    return this.regionY + this.regionH - FLOOR_MARGIN;
  }

  get hudTop() {
    return this.regionY;
  }

  buildHud() {
    const x = this.regionX;
    const w = this.regionW;
    const y = this.hudTop;

    const hudBg = this.scene.add.graphics();
    hudBg.fillStyle(0x00121f, 0.35);
    hudBg.fillRoundedRect(x, y, w, HUD_HEIGHT, { tl: 0, tr: 0, bl: 14, br: 14 });
    this.hudBg = hudBg;

    this.scoreText = this.scene.add.text(x + w / 2, y + 34, 'Score: 0', {
      fontFamily: 'Arial, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffe38a',
    }).setOrigin(0.5);

    this.stageText = this.scene.add.text(x + 16, y + 12, this.stage.label, {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#bfe9ff',
    }).setOrigin(0, 0.5);

    if (this.showTargetBar) {
      this.targetBar = new TargetBar(this.scene, x + 24, y + 66, w - 48, 16);
    }
  }

  // Fish can be scaled arbitrarily large, so the spawn position is computed
  // from its actual on-screen radius rather than a fixed margin, keeping it
  // (and its countdown ring) clear of the HUD and the sea floor.
  getSpawnBounds(fishType) {
    const approxRadius = Math.max(FISH_TEXTURE_W, FISH_TEXTURE_H) * fishType.size * 0.5 + RING_PADDING;
    const margin = 16;

    const minX = this.regionX + approxRadius + margin;
    const maxX = this.regionX + this.regionW - approxRadius - margin;
    const minY = this.hudTop + HUD_HEIGHT + approxRadius + margin;
    const maxY = this.floorY - approxRadius - margin;

    const x = minX < maxX ? Phaser.Math.Between(minX, maxX) : this.regionX + this.regionW / 2;
    const y = minY < maxY ? Phaser.Math.Between(minY, maxY) : this.regionY + this.regionH / 2;
    return { x, y };
  }

  start() {
    this.spawnFish();
  }

  setElapsed(seconds) {
    this.elapsed = seconds;
    const stage = getStageForElapsed(seconds);
    if (stage !== this.stage) {
      this.stage = stage;
      this.stageText.setText(stage.label);
      this.stageText.setColor(Phaser.Display.Color.RGBToString(
        (stage.bandColor >> 16) & 0xff, (stage.bandColor >> 8) & 0xff, stage.bandColor & 0xff, 255,
      ));
      this.flashStageBanner(stage);
    }
  }

  // A brief center-screen banner call-out whenever the current gets stronger,
  // so the difficulty bump is felt, not just read off a small HUD label.
  flashStageBanner(stage) {
    if (stage.windAmplitude === 0) return;
    const banner = this.scene.add.text(
      this.regionX + this.regionW / 2,
      this.regionY + this.regionH / 2,
      stage.label.toUpperCase(),
      {
        fontFamily: 'Arial, sans-serif', fontSize: '30px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#0a2a4a', strokeThickness: 6,
      },
    ).setOrigin(0.5).setAlpha(0).setDepth(45).setScale(0.7);

    this.scene.tweens.add({
      targets: banner,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 500,
      onComplete: () => banner.destroy(),
    });
  }

  spawnFish(forcedFishType, forcedTarget) {
    if (this.roundOver) return;
    if (this.fishTickEvent) this.fishTickEvent.remove(false);

    const baseFishType = forcedFishType || Phaser.Utils.Array.GetRandom(CUT_FISH_TYPES);
    const fishType = this.fishScaleMultiplier !== 1
      ? { ...baseFishType, size: baseFishType.size * this.fishScaleMultiplier }
      : baseFishType;
    const target = forcedTarget !== undefined ? forcedTarget : Phaser.Utils.Array.GetRandom(TARGET_PERCENT_OPTIONS);
    const { x, y } = this.getSpawnBounds(fishType);

    const fish = new CuttableFish(this.scene, fishType, { x, y });
    fish.targetPercent = target;
    fish.windAmplitude = this.stage.windAmplitude;
    fish.windSpeed = this.stage.windSpeed;
    fish.windOffset = Math.random() * Math.PI * 2;
    fish.baseX = x;
    this.gameLayer.add(fish);
    this.currentFish = fish;

    this.applyWindToFish(fish);

    if (this.targetBar) this.targetBar.setTarget(target);
    this.fishTimeRemaining = this.stage.cutTimeLimit;
    this.fishTimeLimit = this.stage.cutTimeLimit;

    this.fishTickEvent = this.scene.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        this.fishTimeRemaining -= 0.05;
        if (this.currentFish) this.currentFish.setCountdownRatio(this.fishTimeRemaining / this.fishTimeLimit);
        if (this.fishTimeRemaining <= 0) {
          this.fishTickEvent.remove(false);
          this.onFishTimeout();
        }
      },
    });

    return fish;
  }

  // Horizontal drift layered on top of the fish's own idle bob, driven by
  // the current difficulty stage's "current" strength. Always runs (even at
  // zero amplitude) so applyFishWobble's baseX nudges always take effect.
  applyWindToFish(fish) {
    if (fish.windEvent) fish.windEvent.remove(false);
    fish.windEvent = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (fish.resolved) return;
        fish.x = fish.baseX + Math.sin(this.scene.time.now / 1000 * fish.windSpeed + fish.windOffset) * fish.windAmplitude;
      },
    });
  }

  onFishTimeout() {
    const fish = this.currentFish;
    if (!fish || fish.resolved) return;
    this.currentFish = null;
    this.stats.missedCount += 1;
    this.showFeedback(fish.x, fish.y - 40, 'Missed!', '#ff5a5a');
    this.onMissed();
    if (fish.windEvent) fish.windEvent.remove(false);
    fish.playMissedAnimation(() => this.afterFishResolved());
  }

  afterFishResolved() {
    if (this.roundOver) return;
    if (this.onRoundAdvance) {
      this.onRoundAdvance();
      return;
    }
    this.scene.time.delayedCall(300, () => this.spawnFish());
  }

  handlePointerDown(worldPoint) {
    if (this.disabled) return;
    this.dragStart = { x: worldPoint.x, y: worldPoint.y };
    this.trailGraphics.clear();
  }

  handlePointerMove(worldPoint) {
    if (!this.dragStart) return;
    this.trailGraphics.clear();
    this.trailGraphics.lineStyle(4, 0xffffff, 0.85);
    this.trailGraphics.lineBetween(this.dragStart.x, this.dragStart.y, worldPoint.x, worldPoint.y);
  }

  handlePointerUp(worldPoint) {
    this.trailGraphics.clear();
    const start = this.dragStart;
    this.dragStart = null;
    if (!start || this.disabled) return;

    const end = { x: worldPoint.x, y: worldPoint.y };
    const dist = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
    if (dist < MIN_SWIPE_DISTANCE) return;

    this.tryCut(start, end);
  }

  tryCut(p1, p2) {
    const fish = this.currentFish;
    if (!fish || fish.resolved || this.roundOver) return null;

    const cx = fish.x;
    const cy = fish.y;
    const { rx, ry } = fish.getRadii();

    const distToFish = pointSegmentDistance(cx, cy, p1.x, p1.y, p2.x, p2.y);
    if (distToFish > Math.max(rx, ry) + 10) return null;

    const polygon = buildEllipsePolygon(cx, cy, rx, ry, 28);
    const halves = cutPolygon(polygon, p1, p2);
    if (!halves) return null;

    const [polyA, polyB] = halves;
    const areaA = polygonArea(polyA);
    const areaB = polygonArea(polyB);
    const total = areaA + areaB;
    if (total < 10) return null;

    const rawPercent = (Math.min(areaA, areaB) / total) * 100;
    return this.resolveCut(fish, polyA, polyB, rawPercent);
  }

  // Resolves a fish with an explicit outcome (used by Co-op so the passive
  // side plays the exact same result as whichever player actually cut).
  resolveWithPercent(rawPercent) {
    const fish = this.currentFish;
    if (!fish || fish.resolved) return null;
    const { rx, ry } = fish.getRadii();
    const polygon = buildEllipsePolygon(fish.x, fish.y, rx, ry, 28);
    const p1 = { x: fish.x - rx - 20, y: fish.y - ry * (1 - rawPercent / 50) };
    const p2 = { x: fish.x + rx + 20, y: fish.y - ry * (1 - rawPercent / 50) };
    const halves = cutPolygon(polygon, p1, p2) || [polygon, polygon];
    return this.resolveCut(fish, halves[0], halves[1], rawPercent);
  }

  resolveCut(fish, polyA, polyB, rawPercent) {
    fish.markResolved();
    if (fish.windEvent) fish.windEvent.remove(false);
    if (this.fishTickEvent) this.fishTickEvent.remove(false);
    this.currentFish = null;

    const snapped = Phaser.Math.Clamp(snapToGrid(rawPercent), 0, 50);
    const diff = Math.abs(fish.targetPercent - snapped);
    const points = scoreForDiff(diff);
    const isPerfect = diff === 0;
    const isNearPerfect = diff === TARGET_PERCENT_STEP;

    this.score += points;
    this.stats.cutCount += 1;
    if (isPerfect) this.stats.perfectCount += 1;
    else if (isNearPerfect) this.stats.nearPerfectCount += 1;
    this.scoreText.setText(`Score: ${this.score}`);
    this.onScoreChange(this.score);

    if (this.targetBar) this.targetBar.animateFillTo(snapped, { color: isPerfect ? 0xffd23f : 0x2fbf71 });

    const label = isPerfect
      ? `PERFECT! +${points}`
      : `${snapped}% (target ${fish.targetPercent}%)  +${points}`;
    this.showFeedback(fish.x, fish.y - 50, label, isPerfect ? '#ffd23f' : '#8affc1');

    this.spawnPieces(fish, polyA, polyB);

    if (isPerfect) {
      this.scene.time.delayedCall(180, () => {
        if (this.roundOver) return;
        this.activeOctopus = new BonusOctopus(this.scene, {
          x: fish.x,
          y: fish.y,
          floorY: this.floorY + 80,
          sizeMultiplier: this.fishScaleMultiplier,
          onCollect: (score, ox, oy) => {
            this.activeOctopus = null;
            this.collectOctopus(score, ox, oy);
          },
        });
      });
    }

    const result = { diff, isPerfect, isNearPerfect, points, snapped, targetPercent: fish.targetPercent, rawPercent };
    this.onCutResolved(result);

    this.scene.time.delayedCall(700, () => this.afterFishResolved());
    return result;
  }

  spawnPieces(fish, polyA, polyB) {
    const textureKey = `fish-${fish.fishType.key}`;
    const size = fish.fishType.size;
    const cx = fish.x;
    const cy = fish.y;
    fish.destroy();

    [polyA, polyB].forEach((poly) => {
      const centroid = polygonCentroid(poly);
      const localPoly = poly.map((p) => ({ x: p.x - cx, y: p.y - cy }));

      const maskGfx = this.scene.make.graphics({ x: cx, y: cy }, false);
      maskGfx.fillStyle(0xffffff, 1);
      maskGfx.fillPoints(localPoly, true);

      const piece = this.scene.add.sprite(cx, cy, textureKey).setScale(size);
      piece.setMask(maskGfx.createGeometryMask());
      this.gameLayer.add(piece);

      this.scene.physics.add.existing(piece);
      piece.body.setAllowGravity(true);
      piece.body.setGravityY(1100);
      const dirX = centroid.x < cx ? -1 : 1;
      piece.body.setVelocity(dirX * Phaser.Math.Between(90, 160), -Phaser.Math.Between(260, 340));

      const floorY = this.floorY + 80;
      const watchEvent = this.scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          maskGfx.x = piece.x;
          maskGfx.y = piece.y;
          if (piece.y > floorY) {
            watchEvent.remove(false);
            maskGfx.destroy();
            piece.destroy();
          }
        },
      });
    });
  }

  // Manual fallback for tapping the bonus octopus — see BonusOctopus.
  // containsPoint's docblock for why split-screen modes need this instead
  // of relying purely on the octopus sprite's own interactive pointerdown.
  tryCollectOctopusAt(worldPoint) {
    if (this.activeOctopus && this.activeOctopus.containsPoint(worldPoint.x, worldPoint.y)) {
      this.activeOctopus.collect();
      return true;
    }
    return false;
  }

  collectOctopus(score, x, y) {
    this.score += score;
    this.stats.octopusCount += 1;
    this.scoreText.setText(`Score: ${this.score}`);
    this.onScoreChange(this.score);
    this.showFeedback(x, y, `+${score}`, '#ffd23f');
  }

  showFeedback(x, y, str, color) {
    const t = this.scene.add.text(x, y, str, {
      fontFamily: 'Arial, sans-serif', fontSize: '22px', fontStyle: 'bold', color,
      stroke: '#00121f', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30);
    this.scene.tweens.add({
      targets: t,
      y: y - 60,
      alpha: 0,
      duration: 750,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // --- Versus-mode obstruction effects (triggered by the opponent) --------

  applyInkObstruction(durationMs = 2000) {
    this.obstructionLayer.clear();
    this.obstructionLayer.fillStyle(0x1a0033, 0.72);
    this.obstructionLayer.fillRect(this.regionX, this.regionY, this.regionW, this.regionH);
    for (let i = 0; i < 6; i++) {
      const r = Phaser.Math.Between(30, 90);
      const px = Phaser.Math.Between(this.regionX, this.regionX + this.regionW);
      const py = Phaser.Math.Between(this.regionY + HUD_HEIGHT, this.regionY + this.regionH);
      this.obstructionLayer.fillStyle(0x2a0050, 0.5);
      this.obstructionLayer.fillCircle(px, py, r);
    }
    this.showFeedback(this.regionX + this.regionW / 2, this.regionY + this.regionH / 2, 'INKED!', '#d0a4ff');

    this.scene.tweens.add({
      targets: this.obstructionLayer,
      alpha: 0,
      delay: durationMs - 400,
      duration: 400,
      onComplete: () => {
        this.obstructionLayer.clear();
        this.obstructionLayer.setAlpha(1);
      },
    });
  }

  applyFishWobble(durationMs = 1800) {
    const fish = this.currentFish;
    if (!fish || fish.resolved) return;
    const originalX = fish.baseX;
    let elapsedMs = 0;
    const wobbleEvent = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        elapsedMs += 16;
        if (!fish || fish.resolved || elapsedMs >= durationMs) {
          wobbleEvent.remove(false);
          if (fish && !fish.resolved) fish.baseX = originalX;
          return;
        }
        fish.baseX = originalX + Math.sin(elapsedMs / 40) * 22;
      },
    });
    this.showFeedback(fish.x, fish.y - 70, 'Wobbled!', '#ff9de2');
  }

  // --- lifecycle ------------------------------------------------------------

  endRound() {
    if (this.roundOver) return;
    this.roundOver = true;
    if (this.fishTickEvent) this.fishTickEvent.remove(false);
    if (this.currentFish) {
      if (this.currentFish.windEvent) this.currentFish.windEvent.remove(false);
      this.currentFish.markResolved();
      this.currentFish.destroy();
      this.currentFish = null;
    }
  }

  destroy() {
    this.endRound();
    this.gameLayer.destroy();
    this.trailGraphics.destroy();
    this.obstructionLayer.destroy();
    this.hudBg.destroy();
    this.scoreText.destroy();
    this.stageText.destroy();
    if (this.targetBar) this.targetBar.destroy();
  }
}
