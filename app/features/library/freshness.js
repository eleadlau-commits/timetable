// When the library numbers are checked again, and when they count as old.
// No screen code here, so it can be tested on its own. Times are in milliseconds.

export const MINUTE = 60000;
export const EVERY = 5 * MINUTE;  // while the app is open, check this often
export const SOON = 30 * 1000;    // don't check twice within this (say, opening then switching back)
export const OLD = 15 * MINUTE;   // numbers older than this are greyed out and say so

// Whether to check again now. `why` is 'front' when the app has just come to the front
// (opened, or switched back to), which always checks unless it checked moments ago; otherwise
// it checks once the last try is EVERY old.
export function shouldCheck({ now, tried, why }) {
  const since = now - (tried || 0);
  return why === 'front' ? since >= SOON : since >= EVERY;
}

// Whether a reading taken at `at` is too old to trust.
export function isOld(at, now) {
  return !at || now - at > OLD;
}
