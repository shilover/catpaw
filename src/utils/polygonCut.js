// Geometry helpers for the "swipe to slice the fish" mechanic: build an
// ellipse polygon approximating the fish's body, cut it in two along the
// player's swipe line, and measure how the resulting area was split.

export function buildEllipsePolygon(cx, cy, rx, ry, segments = 28) {
  const points = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
  }
  return points;
}

export function polygonArea(points) {
  let sum = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function side(p1, p2, p) {
  return (p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x);
}

function lineLineIntersect(a, b, p1, p2) {
  const d1x = b.x - a.x;
  const d1y = b.y - a.y;
  const d2x = p2.x - p1.x;
  const d2y = p2.y - p1.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p1.x - a.x) * d2y - (p1.y - a.y) * d2x) / denom;
  return { x: a.x + d1x * t, y: a.y + d1y * t };
}

// Sutherland-Hodgman clip of a convex polygon against one side of the
// (infinite) line through p1/p2. keepSide is +1 or -1.
function clipHalf(points, p1, p2, keepSide) {
  const result = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const prev = points[(i - 1 + n) % n];
    const currInside = side(p1, p2, curr) * keepSide >= 0;
    const prevInside = side(p1, p2, prev) * keepSide >= 0;

    if (currInside) {
      if (!prevInside) {
        const inter = lineLineIntersect(prev, curr, p1, p2);
        if (inter) result.push(inter);
      }
      result.push(curr);
    } else if (prevInside) {
      const inter = lineLineIntersect(prev, curr, p1, p2);
      if (inter) result.push(inter);
    }
  }
  return result;
}

// Splits an (assumed convex) polygon by the line through p1/p2 into its two
// halves. Returns null if the line doesn't actually pass through the shape.
export function cutPolygon(points, p1, p2) {
  const polyA = clipHalf(points, p1, p2, 1);
  const polyB = clipHalf(points, p1, p2, -1);
  if (polyA.length < 3 || polyB.length < 3) return null;
  return [polyA, polyB];
}

export function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  return Math.hypot(px - cx, py - cy);
}

export function polygonCentroid(points) {
  let x = 0;
  let y = 0;
  points.forEach((p) => {
    x += p.x;
    y += p.y;
  });
  return { x: x / points.length, y: y / points.length };
}

// Where to place a horizontal chord, as a fraction of the ellipse's ry measured
// from the centre, so that the smaller resulting piece is `percent` of the
// ellipse's area.
//
// An ellipse's area above a horizontal chord scales exactly like a unit
// circle's, and the circular-segment area function has no closed-form inverse,
// so this bisects it. `percent` is clamped to 0..50 because the smaller of two
// pieces can never be more than half.
export function horizontalChordOffsetForPercent(percent) {
  const target = Math.min(50, Math.max(0, percent)) / 100;
  // Fraction of a unit circle lying above the line y = -t, for t in 0..1.
  const areaAbove = (t) => (Math.acos(t) - t * Math.sqrt(Math.max(0, 1 - t * t))) / Math.PI;

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (areaAbove(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
