// Round timers are shown as mm:ss in three different places; the formatting
// lived as a copy-pasted pair of padStart calls in each of them.
export function formatClock(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const mm = Math.floor(safe / 60).toString().padStart(2, '0');
  const ss = Math.floor(safe % 60).toString().padStart(2, '0');
  return mm + ':' + ss;
}
