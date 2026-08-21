import { t } from '../i18n/index.js';

// Sharing a result, with three tiers of graceful degradation:
//
//   1. Web Share with the screenshot attached — phones, where sharing is a
//      first-class OS feature and a picture is the point.
//   2. Web Share with text only — browsers that share but not files.
//   3. Clipboard — everything else, including desktop.
//
// Anything can be unavailable or refused (the user cancelling a share throws
// AbortError), so every step is guarded and the caller only ever gets a plain
// result string back to show in a toast.

function summaryText(payload) {
  if (payload.mode === 'versus') {
    return t('shareBodyVersus', { scoreA: payload.scoreA, scoreB: payload.scoreB });
  }
  // A daily score is only comparable against the same day's fish, so the date
  // is part of the claim.
  if (payload.mode === 'daily') {
    return t('shareBodyDaily', { date: payload.date, score: payload.score });
  }
  return t('shareBody', {
    score: payload.score,
    perfect: payload.perfect,
    combo: payload.combo,
  });
}

// Phaser's snapshot hands back an Image; turn it into a PNG File the share
// sheet will accept. Resolves to null whenever anything is missing rather than
// rejecting, so the caller can just fall through to the next tier.
function snapshotFile(scene) {
  return new Promise((resolve) => {
    const renderer = scene.game && scene.game.renderer;
    if (!renderer || typeof renderer.snapshot !== 'function') {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    // A snapshot that never fires must not hang the share.
    setTimeout(() => finish(null), 1500);

    try {
      renderer.snapshot((image) => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          canvas.getContext('2d').drawImage(image, 0, 0);
          canvas.toBlob((blob) => {
            finish(blob ? new File([blob], 'tiny-fish.png', { type: 'image/png' }) : null);
          }, 'image/png');
        } catch {
          finish(null);
        }
      });
    } catch {
      finish(null);
    }
  });
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Falls through to the textarea approach below.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<'shared'|'copied'|'failed'>} what actually happened, for
 *          the caller to turn into a message.
 */
export async function shareResult(scene, payload) {
  const text = summaryText(payload);
  const title = t('shareTitle');

  if (typeof navigator !== 'undefined' && navigator.share) {
    const file = await snapshotFile(scene);
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title, text, files: [file] });
        return 'shared';
      } catch (err) {
        // The user backing out is not a failure worth reporting as one.
        if (err && err.name === 'AbortError') return 'shared';
      }
    }
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'shared';
    }
  }

  return (await copyToClipboard(text)) ? 'copied' : 'failed';
}
