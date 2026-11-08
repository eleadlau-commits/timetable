// Small Planner rules without screen code, so they can be tested.

export const AWAY_MINUTES = 30;

// Coming back to the app after `AWAY_MINUTES` or more, or on a different day, the Planner goes
// back to today's Day, as it does on a fresh start. `seenAt` is when the app was last on screen.
export function backToToday(seenAt, now, minutes = AWAY_MINUTES) {
  if (!seenAt) return false;
  const a = new Date(seenAt);
  const b = new Date(now);
  const newDay = a.getFullYear() !== b.getFullYear() || a.getMonth() !== b.getMonth() || a.getDate() !== b.getDate();
  return newDay || b - a >= minutes * 60000;
}

// Pulling the calendar down to refresh: how far the spinner comes down for a finger moved `dy`
// pixels (it moves less than the finger, and stops at PULL_MAX), and whether letting go refreshes.
export const PULL_READY = 64;
export const PULL_MAX = 96;

export function pullDistance(dy) {
  if (dy <= 0) return 0;
  return Math.min(PULL_MAX, dy * 0.5);
}

export function pullRefreshes(dy) {
  return pullDistance(dy) >= PULL_READY;
}

// Whether a finger that has moved (dx, dy) from where it started is pulling down rather than
// swiping sideways: at least 12 pixels, mostly downwards.
export function isPullDown(dx, dy) {
  return dy >= 12 && dy > Math.abs(dx) * 1.5;
}
