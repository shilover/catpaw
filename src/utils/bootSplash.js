// The markup splash in index.html, driven from the boot sequence.
//
// It exists because everything this game shows is generated at startup — six
// paperised fish sheets, a full-screen background, eighteen audio buffers — and
// on a mid-range phone that is seconds of black screen without it. Guarded
// throughout: the game must still boot if the element was never there.

const SPLASH_ID = 'boot-splash';
const FILL_ID = 'boot-fill';

export function setBootProgress(fraction) {
  if (typeof document === 'undefined') return;
  const fill = document.getElementById(FILL_ID);
  if (fill) fill.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
}

export function hideBootSplash() {
  if (typeof document === 'undefined') return;
  const splash = document.getElementById(SPLASH_ID);
  if (!splash) return;
  splash.classList.add('done');
  // Removed rather than left hidden, so it can never intercept a swipe.
  setTimeout(() => splash.remove(), 400);
}
