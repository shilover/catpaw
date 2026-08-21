import Phaser from 'phaser';
import {
  TARGET_PERCENT_OPTIONS,
  TARGET_PERCENT_STEP,
  snapToGrid,
  scoreForDiff,
  getStageForElapsed,
  comboMultiplier,
  fishValueMultiplier,
  pickWeightedFish,
  COMBO_KEEP_DIFF,
  COMBO_MIN_TO_SHOW,
  CUT_SETTLE_MS,
  NEXT_FISH_DELAY_MS,
  PERFECT_HIT_STOP_MS,
  PERFECT_SHAKE_MS,
  PERFECT_SHAKE_INTENSITY,
  CUT_SCRAP_COUNT,
  PERFECT_SCRAP_COUNT,
} from '../data/fishData.js';
import CuttableFish from './CuttableFish.js';
import BonusOctopus from './BonusOctopus.js';
import TargetBar from '../ui/targetBar.js';
import { createPieceTexture, destroyPieceTexture, toTextureSpace } from '../utils/pieceTexture.js';
import { playSfx, playCombo, SFX } from '../audio/audio.js';
import { spawnPaperScraps } from '../ui/impact.js';
import { randomInt, pickRandom } from '../utils/random.js';
import {
  buildEllipsePolygon,
  cutPolygon,
  polygonArea,
  polygonCentroid,
  pointSegmentDistance,
  horizontalChordOffsetForPercent,
} from '../utils/polygonCut.js';
import { t } from '../i18n/index.js';
import {
  HUD_HEIGHT,
  FLOOR_MARGIN,
  FISH_TEXTURE_W,
  FISH_TEXTURE_H,
  FISH_PIXEL_W,
  FISH_PIXEL_H,
  fishSpriteScale,
  RING_PADDING,
  FONT_FAMILY,
} from '../data/displayConfig.js';

// A swipe shorter than this fraction of the lane's smaller side counts as a tap,
// not a cut. Relative rather than absolute so the threshold means the same thing
// in a full-height solo lane and in a half-height split-screen one.
const MIN_SWIPE_FRACTION = 0.09;
// The swipe is sampled into a polyline; points closer together than this add
// cost without adding shape.
const TRAIL_MIN_STEP = 6;
const TRAIL_MAX_POINTS = 64;
// Redrawing the countdown ring rebuilds a Graphics, so skip frames where the arc
// would not visibly move.
const RING_REDRAW_EPSILON = 0.004;

// One player's play area: spawns fish, tracks its own swipes/score, and reacts
// to difficulty stages + (in Versus) obstruction effects from the opponent.
// Positioned in absolute world coordinates (a rect); the owning Scene decides
// how that rect is actually presented on screen (a plain viewport for a solo
// game, or a rotated split-screen camera for 2P modes).
//
// Everything here is frame-driven: the owning Scene must call `update(time,
// delta)` every frame, and `destroy()` on shutdown.
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
    // Solo/Versus lanes auto-spawn their own next fish; Co-op overrides this so
    // the scene can spawn one shared fish for both lanes at once instead.
    this.onRoundAdvance = opts.onRoundAdvance || null;
    this.fishScaleMultiplier = opts.fishScaleMultiplier || 1;
    // Everything that shapes the challenge draws from here, so a seeded source
    // makes the whole round reproducible (see the Daily Challenge).
    this.random = opts.random || Math.random;
    // Which camera to kick on a perfect cut; split-screen lanes each own one.
    this.camera = opts.camera || null;
    // Scene-level impact effects, shared by both lanes in split-screen.
    this.impact = opts.impact || null;

    this.score = 0;
    // Split out of `score` so Co-op can tell shared progress (both lanes resolve
    // the same fish, so their cut points are identical) apart from what this
    // player alone earned by grabbing bonus octopuses.
    this.bonusScore = 0;
    this.stats = {
      cutCount: 0, perfectCount: 0, nearPerfectCount: 0, missedCount: 0, octopusCount: 0, bestCombo: 0,
      // key -> how many of that species were cut this round.
      speciesCut: {},
    };
    // Consecutive cuts landed within COMBO_KEEP_DIFF of their target. Drives the
    // score multiplier, the HUD counter and the rising combo sound.
    this.combo = 0;
    this.roundOver = false;
    this.currentFish = null;
    this.swipePoints = null;
    this.elapsed = 0;
    this.stage = getStageForElapsed(0);
    this.disabled = false;

    this.fishTimeRemaining = 0;
    this.fishTimeLimit = 1;
    this.lastRingRatio = -1;
    // Cut debris still in flight, culled in update(). Each piece owns a one-off
    // canvas texture that has to be released along with the sprite.
    this.pieces = [];
    this.activeOctopus = null;
    this.wobble = null;

    this.gameLayer = scene.add.container(0, 0);
    this.trailGraphics = scene.add.graphics().setDepth(20);
    this.obstructionLayer = scene.add.graphics().setDepth(40);

    this.buildHud();
  }

  get floorY() {
    return this.regionY + this.regionH - FLOOR_MARGIN;
  }

  get hudTop() {
    return this.regionY;
  }

  get minSwipeDistance() {
    return Math.min(this.regionW, this.regionH) * MIN_SWIPE_FRACTION;
  }

  buildHud() {
    const x = this.regionX;
    const w = this.regionW;
    const y = this.hudTop;

    const hudBg = this.scene.add.graphics();
    hudBg.fillStyle(0x00121f, 0.35);
    hudBg.fillRoundedRect(x, y, w, HUD_HEIGHT, { tl: 0, tr: 0, bl: 14, br: 14 });
    this.hudBg = hudBg;

    this.scoreText = this.scene.add.text(x + w / 2, y + 34, t('score', { score: 0 }), {
      fontFamily: FONT_FAMILY, fontSize: '24px', fontStyle: 'bold', color: '#ffe38a',
    }).setOrigin(0.5);

    this.stageText = this.scene.add.text(x + 16, y + 12, t(this.stage.labelKey), {
      fontFamily: FONT_FAMILY, fontSize: '13px', fontStyle: 'bold', color: '#bfe9ff',
    }).setOrigin(0, 0.5);

    // Below the HUD strip rather than inside it: the strip already stacks the
    // stage label, the score and the target bar's percentage labels into 96px,
    // and anything else put in there collides with the bar's "0%" tick.
    this.comboText = this.scene.add.text(x + 16, y + HUD_HEIGHT + 20, '', {
      fontFamily: FONT_FAMILY, fontSize: '18px', fontStyle: 'bold', color: '#ffd23f',
      stroke: '#00121f', strokeThickness: 4,
    }).setOrigin(0, 0.5);

    if (this.showTargetBar) {
      this.targetBar = new TargetBar(this.scene, x + 24, y + 66, w - 48, 16);
    }
  }

  refreshComboText() {
    if (this.combo < COMBO_MIN_TO_SHOW) {
      this.comboText.setText('');
      return;
    }
    this.comboText.setText(t('combo', {
      count: this.combo,
      multiplier: comboMultiplier(this.combo).toFixed(2),
    }));
    this.comboText.setScale(1.35);
    this.scene.tweens.add({ targets: this.comboText, scale: 1, duration: 180, ease: 'Back.easeOut' });
  }

  // Fish can be scaled arbitrarily large, so the spawn position is computed from
  // the fish's actual on-screen radius rather than a fixed margin, keeping it
  // (and its countdown ring) clear of the HUD and the sea floor.
  getSpawnBounds(fishType) {
    const approxRadius = Math.max(FISH_TEXTURE_W, FISH_TEXTURE_H) * fishType.size * 0.5 + RING_PADDING;
    const margin = 16;

    const minX = this.regionX + approxRadius + margin;
    const maxX = this.regionX + this.regionW - approxRadius - margin;
    const minY = this.hudTop + HUD_HEIGHT + approxRadius + margin;
    const maxY = this.floorY - approxRadius - margin;

    const x = minX < maxX ? randomInt(this.random, minX, maxX) : this.regionX + this.regionW / 2;
    const y = minY < maxY ? randomInt(this.random, minY, maxY) : this.regionY + this.regionH / 2;
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
      this.stageText.setText(t(stage.labelKey));
      this.stageText.setColor(Phaser.Display.Color.RGBToString(
        (stage.bandColor >> 16) & 0xff, (stage.bandColor >> 8) & 0xff, stage.bandColor & 0xff, 255,
      ));
      this.flashStageBanner(stage);
      playSfx(this.scene, SFX.STAGE);
    }
  }

  // A brief center-screen banner call-out whenever the current gets stronger, so
  // the difficulty bump is felt, not just read off a small HUD label.
  flashStageBanner(stage) {
    const banner = this.scene.add.text(
      this.regionX + this.regionW / 2,
      this.regionY + this.regionH / 2,
      t(stage.labelKey).toUpperCase(),
      {
        fontFamily: FONT_FAMILY, fontSize: '30px', fontStyle: 'bold',
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
    if (this.roundOver) return null;

    const baseFishType = forcedFishType || pickWeightedFish(this.random);
    const fishType = this.fishScaleMultiplier !== 1
      ? { ...baseFishType, size: baseFishType.size * this.fishScaleMultiplier }
      : baseFishType;
    const target = forcedTarget !== undefined ? forcedTarget : pickRandom(this.random, TARGET_PERCENT_OPTIONS);
    const { x, y } = this.getSpawnBounds(fishType);

    const fish = new CuttableFish(this.scene, fishType, { x, y, random: this.random });
    fish.targetPercent = target;
    fish.windAmplitude = this.stage.windAmplitude;
    fish.windSpeed = this.stage.windSpeed;
    fish.windOffset = this.random() * Math.PI * 2;
    fish.baseX = x;
    this.gameLayer.add(fish);
    this.currentFish = fish;

    if (this.targetBar) this.targetBar.setTarget(target);
    this.fishTimeRemaining = this.stage.cutTimeLimit;
    this.fishTimeLimit = this.stage.cutTimeLimit;
    this.lastRingRatio = -1;
    fish.setCountdownRatio(1);

    return fish;
  }

  // --- per-frame ------------------------------------------------------------

  update(time, delta) {
    const fish = this.currentFish;

    if (fish && !fish.resolved) {
      fish.updateIdle(time);
      // Horizontal drift layered on top of the fish's own idle bob, driven by
      // the current difficulty stage's "current" strength.
      fish.x = fish.baseX + Math.sin((time / 1000) * fish.windSpeed + fish.windOffset) * fish.windAmplitude;

      if (!this.roundOver && !(this.impact && this.impact.frozen)) {
        this.fishTimeRemaining -= delta / 1000;
        const ratio = Phaser.Math.Clamp(this.fishTimeRemaining / this.fishTimeLimit, 0, 1);
        if (Math.abs(ratio - this.lastRingRatio) >= RING_REDRAW_EPSILON) {
          this.lastRingRatio = ratio;
          fish.setCountdownRatio(ratio);
        }
        if (this.fishTimeRemaining <= 0) this.onFishTimeout();
      }
    }

    this.updateWobble(delta);
    this.updatePieces();
    if (this.activeOctopus) this.activeOctopus.update();
  }

  updatePieces() {
    const killY = this.floorY + 80;
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i];
      if (piece.y > killY) {
        this.pieces.splice(i, 1);
        destroyPieceTexture(this.scene, piece.pieceTextureKey);
        piece.destroy();
      }
    }
  }

  updateWobble(delta) {
    const w = this.wobble;
    if (!w) return;
    const fish = w.fish;
    if (!fish || fish.resolved || fish !== this.currentFish) {
      this.wobble = null;
      return;
    }
    w.elapsed += delta;
    if (w.elapsed >= w.duration) {
      fish.baseX = w.originalX;
      this.wobble = null;
      return;
    }
    fish.baseX = w.originalX + Math.sin(w.elapsed / 40) * 22;
  }

  onFishTimeout() {
    const fish = this.currentFish;
    if (!fish || fish.resolved) return;
    this.currentFish = null;
    this.wobble = null;
    this.stats.missedCount += 1;
    this.breakCombo();
    this.showFeedback(fish.x, fish.y - 40, t('missed'), '#ff5a5a');
    playSfx(this.scene, SFX.MISS);
    this.onMissed();
    fish.playMissedAnimation(() => this.afterFishResolved());
  }

  afterFishResolved() {
    if (this.roundOver) return;
    if (this.onRoundAdvance) {
      this.onRoundAdvance();
      return;
    }
    this.scene.time.delayedCall(NEXT_FISH_DELAY_MS, () => this.spawnFish());
  }

  // --- input ----------------------------------------------------------------

  handlePointerDown(worldPoint) {
    if (this.disabled) return;
    this.swipePoints = [{ x: worldPoint.x, y: worldPoint.y }];
    this.trailGraphics.clear();
  }

  handlePointerMove(worldPoint) {
    const points = this.swipePoints;
    if (!points) return;

    const last = points[points.length - 1];
    if (Phaser.Math.Distance.Between(last.x, last.y, worldPoint.x, worldPoint.y) >= TRAIL_MIN_STEP) {
      points.push({ x: worldPoint.x, y: worldPoint.y });
      if (points.length > TRAIL_MAX_POINTS) points.shift();
    }
    this.drawTrail(points);
  }

  // The blade trail thins and fades toward the tail of the swipe, so the most
  // recent motion reads as the cutting edge.
  drawTrail(points) {
    this.trailGraphics.clear();
    for (let i = 1; i < points.length; i++) {
      const progress = i / (points.length - 1);
      this.trailGraphics.lineStyle(2 + 4 * progress, 0xffffff, 0.15 + 0.7 * progress);
      this.trailGraphics.lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    }
  }

  handlePointerUp(worldPoint) {
    this.trailGraphics.clear();
    const points = this.swipePoints;
    this.swipePoints = null;
    if (!points || this.disabled) return;

    points.push({ x: worldPoint.x, y: worldPoint.y });

    const first = points[0];
    const last = points[points.length - 1];
    if (Phaser.Math.Distance.Between(first.x, first.y, last.x, last.y) >= this.minSwipeDistance) {
      playSfx(this.scene, SFX.SWIPE);
    }
    this.tryCut(points);
  }

  // --- cutting --------------------------------------------------------------

  // Takes the whole sampled swipe rather than just its endpoints: the cut is
  // made along whichever segment actually passes closest to the fish, so an
  // arced swipe cuts where the player drew instead of along the arc's chord.
  tryCut(points) {
    const fish = this.currentFish;
    if (!fish || fish.resolved || this.roundOver) return null;
    if (points.length < 2) return null;

    const first = points[0];
    const last = points[points.length - 1];
    if (Phaser.Math.Distance.Between(first.x, first.y, last.x, last.y) < this.minSwipeDistance) return null;

    const cx = fish.x;
    const cy = fish.y;
    const { rx, ry } = fish.getRadii();
    const reach = Math.max(rx, ry) + 10;

    let best = null;
    let bestDist = Infinity;
    for (let i = 1; i < points.length; i++) {
      const d = pointSegmentDistance(cx, cy, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
      if (d < bestDist) {
        bestDist = d;
        best = [points[i - 1], points[i]];
      }
    }
    if (!best || bestDist > reach) return null;

    // Extend the chosen segment well past the fish so the cut line is a full
    // chord even when the sampled segment only clips the edge.
    const [a, b] = best;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) return null;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const span = reach * 2 + len;
    const p1 = { x: a.x - ux * span, y: a.y - uy * span };
    const p2 = { x: b.x + ux * span, y: b.y + uy * span };

    const polygon = buildEllipsePolygon(cx, cy, rx, ry, 28);
    const halves = cutPolygon(polygon, p1, p2);
    if (!halves) return null;

    const [polyA, polyB] = halves;
    const areaA = polygonArea(polyA);
    const areaB = polygonArea(polyB);
    const total = areaA + areaB;
    if (total < 10) return null;

    const rawPercent = (Math.min(areaA, areaB) / total) * 100;
    return this.resolveCut(fish, polyA, polyB, rawPercent, { x: ux, y: uy });
  }

  // Resolves a fish with an explicit outcome (used by Co-op so the passive side
  // plays the exact same result as whichever player actually cut).
  resolveWithPercent(rawPercent) {
    const fish = this.currentFish;
    if (!fish || fish.resolved) return null;
    const { rx, ry } = fish.getRadii();
    const polygon = buildEllipsePolygon(fish.x, fish.y, rx, ry, 28);
    // A horizontal chord placed so the smaller resulting half really is
    // `rawPercent` of the ellipse. Solved numerically because the circular
    // segment's area has no closed-form inverse; the previous linear guess could
    // miss the shape entirely and fall back to drawing two whole fish.
    const cutY = fish.y - ry * horizontalChordOffsetForPercent(rawPercent);
    const p1 = { x: fish.x - rx - 20, y: cutY };
    const p2 = { x: fish.x + rx + 20, y: cutY };
    const halves = cutPolygon(polygon, p1, p2);
    if (!halves) return null;
    return this.resolveCut(fish, halves[0], halves[1], rawPercent, { x: 1, y: 0 });
  }

  resolveCut(fish, polyA, polyB, rawPercent, cutDir) {
    fish.markResolved();
    this.currentFish = null;
    this.wobble = null;

    const snapped = Phaser.Math.Clamp(snapToGrid(rawPercent), 0, 50);
    const diff = Math.abs(fish.targetPercent - snapped);
    const isPerfect = diff === 0;
    const isNearPerfect = diff === TARGET_PERCENT_STEP;

    // A tidy cut extends the streak; a sloppy one ends it. The multiplier is
    // applied to this cut, so the streak pays off immediately rather than only
    // on the cut after it.
    const keepsCombo = diff <= COMBO_KEEP_DIFF;
    if (keepsCombo) {
      this.combo += 1;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    }
    const multiplier = keepsCombo ? comboMultiplier(this.combo) : 1;
    // Accuracy sets the base, the species scales it, the streak scales it again.
    const speciesValue = fishValueMultiplier(fish.fishType);
    const points = Math.round(scoreForDiff(diff) * speciesValue * multiplier);

    this.score += points;
    this.stats.cutCount += 1;
    const speciesKey = fish.fishType.key;
    this.stats.speciesCut[speciesKey] = (this.stats.speciesCut[speciesKey] || 0) + 1;
    if (isPerfect) this.stats.perfectCount += 1;
    else if (isNearPerfect) this.stats.nearPerfectCount += 1;
    this.scoreText.setText(t('score', { score: this.score }));
    this.onScoreChange(this.score);

    if (this.targetBar) this.targetBar.animateFillTo(snapped, { color: isPerfect ? 0xffd23f : 0x2fbf71 });

    const comboSuffix = multiplier > 1 ? '  x' + multiplier.toFixed(2) : '';
    const label = (isPerfect
      ? t('perfectCut', { points })
      : t('cutResult', { percent: snapped, target: fish.targetPercent, points })) + comboSuffix;
    this.showFeedback(fish.x, fish.y - 50, label, isPerfect ? '#ffd23f' : '#8affc1');

    playSfx(this.scene, isPerfect ? SFX.PERFECT : SFX.CUT);
    this.playCutImpact(fish, cutDir, isPerfect);
    if (keepsCombo) {
      this.refreshComboText();
      if (this.combo >= COMBO_MIN_TO_SHOW) playCombo(this.scene, this.combo - COMBO_MIN_TO_SHOW);
    } else {
      this.breakCombo();
    }

    this.spawnPieces(fish, polyA, polyB, cutDir);

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
          onExpire: () => { this.activeOctopus = null; },
        });
      });
    }

    const result = { diff, isPerfect, isNearPerfect, points, snapped, targetPercent: fish.targetPercent, rawPercent };
    this.onCutResolved(result);

    this.scene.time.delayedCall(CUT_SETTLE_MS, () => this.afterFishResolved());
    return result;
  }

  // The blade landing, felt rather than read: scraps off every cut, plus a beat
  // of frozen time and a camera kick when it was perfect.
  playCutImpact(fish, cutDir, isPerfect) {
    spawnPaperScraps(this.scene, {
      x: fish.x,
      y: fish.y,
      tint: fish.fishType.bodyColor,
      cutDir,
      count: isPerfect ? PERFECT_SCRAP_COUNT : CUT_SCRAP_COUNT,
      spread: isPerfect ? 190 : 140,
      scale: Math.max(0.7, this.fishScaleMultiplier * 1.6),
    });

    if (isPerfect && this.impact) {
      this.impact.punch({
        hitStop: PERFECT_HIT_STOP_MS,
        shake: PERFECT_SHAKE_MS,
        intensity: PERFECT_SHAKE_INTENSITY,
        camera: this.camera,
      });
    }
  }

  spawnPieces(fish, polyA, polyB, cutDir) {
    const textureKey = 'fish-' + fish.fishType.key;
    const size = fish.fishType.size;
    const cx = fish.x;
    const cy = fish.y;
    // The body ellipse in texture pixels, so the piece baker can tell the blade
    // line apart from the fish's own outline.
    const { rx, ry } = fish.getRadii();
    const bodyRxTex = rx / fishSpriteScale(size);
    const bodyRyTex = ry / fishSpriteScale(size);
    fish.destroy();

    // Push the halves apart along the cut's normal instead of comparing centroid
    // X: for a near-horizontal cut both centroids share an X, and the two halves
    // used to fly off together, hiding the slice entirely.
    const nx = -cutDir.y;
    const ny = cutDir.x;

    [polyA, polyB].forEach((poly) => {
      const centroid = polygonCentroid(poly);
      // The cut polygon is in world units; the texture it has to clip is the
      // supersampled one, so convert through the sprite's real scale.
      const spriteScale = fishSpriteScale(size);
      const texPoly = toTextureSpace(poly, cx, cy, spriteScale, FISH_PIXEL_W, FISH_PIXEL_H);
      const pieceKey = createPieceTexture(
        this.scene, textureKey, FISH_PIXEL_W, FISH_PIXEL_H, texPoly, bodyRxTex, bodyRyTex,
      );
      if (!pieceKey) return;

      const piece = this.scene.add.sprite(cx, cy, pieceKey).setScale(spriteScale);
      piece.pieceTextureKey = pieceKey;
      this.gameLayer.add(piece);
      this.pieces.push(piece);

      this.scene.physics.add.existing(piece);
      piece.body.setAllowGravity(true);
      piece.body.setGravityY(1100);

      const sign = Math.sign((centroid.x - cx) * nx + (centroid.y - cy) * ny) || 1;
      const push = Phaser.Math.Between(110, 190);
      piece.body.setVelocity(
        nx * sign * push + Phaser.Math.Between(-30, 30),
        ny * sign * push - Phaser.Math.Between(240, 320),
      );
    });
  }

  // --- bonus octopus --------------------------------------------------------

  tryCollectOctopusAt(worldPoint) {
    if (this.activeOctopus && this.activeOctopus.containsPoint(worldPoint.x, worldPoint.y)) {
      this.activeOctopus.collect();
      return true;
    }
    return false;
  }

  collectOctopus(score, x, y) {
    this.score += score;
    this.bonusScore += score;
    this.stats.octopusCount += 1;
    this.scoreText.setText(t('score', { score: this.score }));
    this.onScoreChange(this.score);
    this.showFeedback(x, y, '+' + score, '#ffd23f');
    playSfx(this.scene, SFX.BONUS);
  }

  // Only announce a break the player could feel — resetting an already-zero
  // streak should be silent.
  breakCombo() {
    if (this.combo >= COMBO_MIN_TO_SHOW) {
      this.showFeedback(
        this.regionX + this.regionW / 2, this.hudTop + HUD_HEIGHT + 52,
        t('comboLost'), '#ff9de2',
      );
      playSfx(this.scene, SFX.COMBO_BREAK);
    }
    this.combo = 0;
    this.refreshComboText();
  }

  showFeedback(x, y, str, color) {
    const popup = this.scene.add.text(x, y, str, {
      fontFamily: FONT_FAMILY, fontSize: '22px', fontStyle: 'bold', color,
      stroke: '#00121f', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30);
    this.scene.tweens.add({
      targets: popup,
      y: y - 60,
      alpha: 0,
      duration: 750,
      ease: 'Cubic.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  // --- Versus-mode obstruction effects (triggered by the opponent) -----------

  applyInkObstruction(durationMs = 2000) {
    this.obstructionLayer.clear();
    this.obstructionLayer.setAlpha(1);
    this.obstructionLayer.fillStyle(0x1a0033, 0.72);
    this.obstructionLayer.fillRect(this.regionX, this.regionY, this.regionW, this.regionH);
    for (let i = 0; i < 6; i++) {
      const r = Phaser.Math.Between(30, 90);
      const px = Phaser.Math.Between(this.regionX, this.regionX + this.regionW);
      const py = Phaser.Math.Between(this.regionY + HUD_HEIGHT, this.regionY + this.regionH);
      this.obstructionLayer.fillStyle(0x2a0050, 0.5);
      this.obstructionLayer.fillCircle(px, py, r);
    }
    this.showFeedback(this.regionX + this.regionW / 2, this.regionY + this.regionH / 2, t('inked'), '#d0a4ff');

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
    this.wobble = { fish, originalX: fish.baseX, elapsed: 0, duration: durationMs };
    this.showFeedback(fish.x, fish.y - 70, t('wobbled'), '#ff9de2');
  }

  // --- lifecycle ------------------------------------------------------------

  endRound() {
    if (this.roundOver) return;
    this.roundOver = true;
    this.wobble = null;
    if (this.currentFish) {
      this.currentFish.markResolved();
      this.currentFish.destroy();
      this.currentFish = null;
    }
    if (this.activeOctopus) {
      this.activeOctopus.expire();
      this.activeOctopus = null;
    }
  }

  destroy() {
    this.endRound();
    // Each piece carries a canvas texture of its own; dropping the sprite is not
    // enough, the Texture Manager entry has to go with it.
    this.pieces.forEach((piece) => {
      destroyPieceTexture(this.scene, piece.pieceTextureKey);
      piece.destroy();
    });
    this.pieces.length = 0;

    this.gameLayer.destroy();
    this.trailGraphics.destroy();
    this.obstructionLayer.destroy();
    this.hudBg.destroy();
    this.scoreText.destroy();
    this.stageText.destroy();
    this.comboText.destroy();
    if (this.targetBar) this.targetBar.destroy();
  }
}
