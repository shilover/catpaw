import Phaser from 'phaser';
import { idealChordDistance } from '../utils/polygonCut.js';
import { FONT_FAMILY } from '../data/displayConfig.js';
import { t } from '../i18n/index.js';

// The teaching feedback: after a cut, show where the blade should have gone.
//
// A target percentage is an abstract number, and the hard part of learning this
// game is turning it into a position on a fish. Showing the ideal line right
// next to the line the player actually drew closes that gap in a couple of
// attempts, which no amount of instruction text does.
//
// The ghost line is drawn parallel to the player's own swipe, so the lesson is
// "you were this far off", not "you should have cut at some other angle".

const DASH = 14;
const GAP = 9;
const HOLD_MS = 900;

function drawDashedLine(graphics, x1, y1, x2, y2) {
  const length = Phaser.Math.Distance.Between(x1, y1, x2, y2);
  if (length < 1) return;
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;

  for (let d = 0; d < length; d += DASH + GAP) {
    const end = Math.min(d + DASH, length);
    graphics.lineBetween(x1 + ux * d, y1 + uy * d, x1 + ux * end, y1 + uy * end);
  }
}

/**
 * @param {Phaser.Scene} scene
 * @param {object} cut   cx, cy (fish centre), rx, ry (body radii),
 *                       cutDir (unit vector along the swipe),
 *                       actualDistance (signed distance of the player's line
 *                       from the centre, along the normal),
 *                       targetPercent
 */
export function showIdealCutLine(scene, {
  cx, cy, rx, ry, cutDir, actualDistance, targetPercent,
}) {
  const nx = -cutDir.y;
  const ny = cutDir.x;

  // Put the ghost on the same side the player cut, so the two lines are
  // directly comparable rather than mirrored across the fish.
  const side = actualDistance < 0 ? -1 : 1;
  const distance = idealChordDistance(rx, ry, nx, ny, targetPercent) * side;

  const px = cx + nx * distance;
  const py = cy + ny * distance;
  // Long enough to cross the whole body at any angle.
  const half = Math.max(rx, ry) * 1.15;

  const graphics = scene.add.graphics().setDepth(34);
  graphics.lineStyle(3, 0x8affc1, 0.95);
  drawDashedLine(
    graphics,
    px - cutDir.x * half, py - cutDir.y * half,
    px + cutDir.x * half, py + cutDir.y * half,
  );

  const label = scene.add.text(
    px + nx * 22 * side,
    py + ny * 22 * side,
    t('idealCutHere', { percent: targetPercent }),
    {
      fontFamily: FONT_FAMILY, fontSize: '15px', fontStyle: 'bold', color: '#8affc1',
      stroke: '#00121f', strokeThickness: 4,
    },
  ).setOrigin(0.5).setDepth(34);

  scene.tweens.add({
    targets: [graphics, label],
    alpha: 0,
    delay: HOLD_MS,
    duration: 320,
    onComplete: () => {
      graphics.destroy();
      label.destroy();
    },
  });
}
