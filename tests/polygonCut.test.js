import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEllipsePolygon,
  polygonArea,
  polygonCentroid,
  cutPolygon,
  pointSegmentDistance,
  horizontalChordOffsetForPercent,
} from '../src/utils/polygonCut.js';

// The cut geometry decides every score in the game, so it is worth pinning down
// precisely. This module is deliberately Phaser-free, which is what makes it
// testable without a browser.

const close = (actual, expected, tolerance, message) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

test('buildEllipsePolygon approximates the true ellipse area', () => {
  const poly = buildEllipsePolygon(0, 0, 100, 60, 28);
  assert.equal(poly.length, 28);
  // A 28-gon inscribed in an ellipse falls slightly short of pi*rx*ry.
  const exact = Math.PI * 100 * 60;
  const area = polygonArea(poly);
  assert.ok(area < exact, 'inscribed polygon must be smaller than the ellipse');
  close(area / exact, 1, 0.01, 'area ratio');
});

test('polygonArea is orientation independent', () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.equal(polygonArea(square), 100);
  assert.equal(polygonArea([...square].reverse()), 100);
});

test('polygonCentroid finds the middle of a square', () => {
  const square = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
  const c = polygonCentroid(square);
  assert.equal(c.x, 2);
  assert.equal(c.y, 2);
});

test('a cut through the centre splits the area evenly', () => {
  const poly = buildEllipsePolygon(0, 0, 100, 60, 28);
  const halves = cutPolygon(poly, { x: -200, y: 0 }, { x: 200, y: 0 });
  assert.ok(halves, 'a line through the centre must intersect the shape');

  const [a, b] = halves;
  close(polygonArea(a), polygonArea(b), 1e-6, 'half areas');
  close(polygonArea(a) + polygonArea(b), polygonArea(poly), 1e-6, 'halves sum to the whole');
});

test('the two halves always sum back to the whole, wherever the cut lands', () => {
  const poly = buildEllipsePolygon(30, -12, 90, 55, 28);
  const whole = polygonArea(poly);

  for (let offset = -50; offset <= 50; offset += 10) {
    for (const angle of [0, 0.4, 1.1, 2.2]) {
      const dx = Math.cos(angle) * 400;
      const dy = Math.sin(angle) * 400;
      const nx = -Math.sin(angle) * offset;
      const ny = Math.cos(angle) * offset;
      const p1 = { x: 30 - dx + nx, y: -12 - dy + ny };
      const p2 = { x: 30 + dx + nx, y: -12 + dy + ny };

      const halves = cutPolygon(poly, p1, p2);
      if (!halves) continue;
      const sum = polygonArea(halves[0]) + polygonArea(halves[1]);
      close(sum, whole, 1e-6, `sum at offset ${offset} angle ${angle}`);
    }
  }
});

test('a line that misses the shape produces no cut', () => {
  const poly = buildEllipsePolygon(0, 0, 100, 60, 28);
  assert.equal(cutPolygon(poly, { x: -200, y: 500 }, { x: 200, y: 500 }), null);
});

test('a line tangent to the shape yields a degenerate sliver, not a real half', () => {
  const poly = buildEllipsePolygon(0, 0, 100, 60, 28);
  const whole = polygonArea(poly);

  // With 28 segments there is a vertex exactly at the top (y = 60), and the
  // clipper treats a point on the line as belonging to both sides — so a
  // tangent line still returns two polygons rather than null. One of them is a
  // zero-area sliver, which is what callers actually rely on: a graze scores as
  // a ~0% cut instead of being silently ignored.
  const halves = cutPolygon(poly, { x: -200, y: 60 }, { x: 200, y: 60 });
  assert.ok(halves, 'a tangent at a vertex still splits');

  const smaller = Math.min(polygonArea(halves[0]), polygonArea(halves[1]));
  const larger = Math.max(polygonArea(halves[0]), polygonArea(halves[1]));
  close(smaller, 0, 1e-6, 'tangent sliver has no area');
  close(larger, whole, 1e-6, 'the other side is the whole shape');
});

test('pointSegmentDistance clamps to the segment, not the infinite line', () => {
  // Perpendicular within the span.
  assert.equal(pointSegmentDistance(5, 3, 0, 0, 10, 0), 3);
  // Beyond the end: distance is to the endpoint, not to the line (which is 0).
  assert.equal(pointSegmentDistance(20, 0, 0, 0, 10, 0), 10);
  // Degenerate segment behaves as a point.
  assert.equal(pointSegmentDistance(3, 4, 0, 0, 0, 0), 5);
});

test('horizontalChordOffsetForPercent inverts the segment-area function', () => {
  // Round-trip: place the chord for a target percentage, then measure what the
  // cut actually produced. This is the property Co-op relies on to make the
  // mirrored lane score identically to the lane that did the cutting.
  const rx = 120;
  const ry = 80;
  const poly = buildEllipsePolygon(0, 0, rx, ry, 256);
  const whole = polygonArea(poly);

  for (const percent of [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]) {
    const offset = horizontalChordOffsetForPercent(percent);
    const y = -ry * offset;
    const halves = cutPolygon(poly, { x: -500, y }, { x: 500, y });
    assert.ok(halves, `chord for ${percent}% must intersect`);

    const smaller = Math.min(polygonArea(halves[0]), polygonArea(halves[1]));
    close((smaller / whole) * 100, percent, 0.25, `round-trip at ${percent}%`);
  }
});

test('horizontalChordOffsetForPercent is monotonic and clamped', () => {
  // A bigger requested slice means a chord closer to the centre.
  let previous = horizontalChordOffsetForPercent(1);
  for (let p = 2; p <= 50; p++) {
    const current = horizontalChordOffsetForPercent(p);
    assert.ok(current < previous, `offset must shrink as percent grows (at ${p}%)`);
    previous = current;
  }
  // 50% is a cut straight through the centre.
  close(horizontalChordOffsetForPercent(50), 0, 1e-9, 'half is centred');
  // Out-of-range input is clamped rather than producing nonsense.
  assert.equal(horizontalChordOffsetForPercent(80), horizontalChordOffsetForPercent(50));
  assert.equal(horizontalChordOffsetForPercent(-5), horizontalChordOffsetForPercent(0));
});
