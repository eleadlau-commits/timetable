// Looks for a Telepen barcode in a picture (ImageData: { width, height, data }), along lines
// across it and down it (for a card held sideways), straight and slightly slanted (for a card
// that isn't quite straight). Works offline, without ZXing.
//
// Each line is split into bars and spaces by finding where it gets darker and lighter: every
// dip is a bar, every rise a space, and the edge between them is halfway between the two. This
// copes with blur (a camera that hasn't quite focused shows thin bars as faint grey dips),
// shadows and uneven light. Then telepen.js reads the bars.

import { readTelepenRuns } from './telepen.js';

const LINES = 40; // lines tried each way, spread over the picture
export const SLANTS = [0, 4, -4, 8, -8, 12, -12]; // degrees, the straight lines first
const MIN_STEP = 8; // how much darker or lighter (0–255) a dip or rise must be, at least

// The picture's brightness (0–255), one number per spot.
export function greyOf(image) {
  const { width, height, data } = image;
  const grey = new Float32Array(width * height);
  for (let i = 0, p = 0; i < grey.length; i++, p += 4) grey[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  return grey;
}

// The brightness along a line through (x, y) in direction (dx, dy), as far as it stays inside
// the picture, one sample per pixel, blending the four nearest spots.
function sample(grey, width, height, x, y, dx, dy) {
  // How far the line goes each way before leaving the picture.
  let lo = -Infinity;
  let hi = Infinity;
  for (const [p, d, max] of [[x, dx, width - 1], [y, dy, height - 1]]) {
    if (Math.abs(d) < 1e-9) {
      if (p < 0 || p > max) return new Float32Array(0);
      continue;
    }
    const a = (0 - p) / d;
    const b = (max - p) / d;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  }
  const n = Math.max(0, Math.floor(hi - lo) + 1);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const px = Math.min(width - 1, Math.max(0, x + (lo + i) * dx));
    const py = Math.min(height - 1, Math.max(0, y + (lo + i) * dy));
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const fx = px - x0;
    const fy = py - y0;
    const top = grey[y0 * width + x0] * (1 - fx) + grey[y0 * width + x1] * fx;
    const bottom = grey[y1 * width + x0] * (1 - fx) + grey[y1 * width + x1] * fx;
    out[i] = top * (1 - fy) + bottom * fy;
  }
  return out;
}

// How much a line flickers by itself (camera noise): most neighbouring spots differ only by
// that, since most of a line isn't an edge.
function noiseOf(values) {
  const counts = new Uint32Array(256); // how many steps of each size, in half-steps
  let total = 0;
  for (let i = 1; i < values.length; i += 2) {
    counts[Math.min(255, Math.floor(2 * Math.abs(values[i] - values[i - 1])))]++;
    total++;
  }
  let seen = 0;
  for (let size = 0; size < 256; size++) {
    seen += counts[size];
    if (seen * 2 >= total) return size / 2; // the middle one
  }
  return 0;
}

// A line of brightness values split into dark and light runs: [{ dark, length }], lengths in
// pixels (with fractions, since an edge can fall between two pixels).
export function runsOf(values) {
  const n = values.length;
  if (n < 3) return [];
  // Smooth a little, so a single noisy pixel isn't a bar.
  const s = new Float32Array(n);
  s[0] = values[0];
  s[n - 1] = values[n - 1];
  for (let i = 1; i < n - 1; i++) s[i] = (values[i - 1] + 2 * values[i] + values[i + 1]) / 4;
  const step = Math.max(MIN_STEP, 3 * noiseOf(s));

  // The dips and peaks, each at least `step` from the one before.
  const turns = []; // { i, v, peak }
  let hi = 0;
  let lo = 0;
  let rising = null; // not known until the line has moved by `step`
  for (let i = 1; i < n; i++) {
    if (rising === null) {
      if (s[i] > s[hi]) hi = i;
      if (s[i] < s[lo]) lo = i;
      if (s[hi] - s[lo] >= step) {
        rising = hi > lo;
        const first = rising ? lo : hi;
        turns.push({ i: first, v: s[first], peak: !rising });
        hi = lo = i;
      }
    } else if (rising) {
      if (s[i] >= s[hi]) hi = i;
      else if (s[hi] - s[i] >= step) {
        turns.push({ i: hi, v: s[hi], peak: true });
        rising = false;
        lo = i;
      }
    } else if (s[i] <= s[lo]) lo = i;
    else if (s[i] - s[lo] >= step) {
      turns.push({ i: lo, v: s[lo], peak: false });
      rising = true;
      hi = i;
    }
  }
  if (rising !== null) turns.push(rising ? { i: hi, v: s[hi], peak: true } : { i: lo, v: s[lo], peak: false });
  if (turns.length < 2) return [];

  // An edge halfway (in brightness) between each peak and dip.
  const runs = [];
  let at = 0;
  for (let k = 0; k + 1 < turns.length; k++) {
    const a = turns[k];
    const b = turns[k + 1];
    const middle = (a.v + b.v) / 2;
    let edge = b.i;
    for (let i = a.i; i < b.i; i++) {
      if ((s[i] - middle) * (s[i + 1] - middle) <= 0 && s[i] !== s[i + 1]) {
        edge = i + (s[i] - middle) / (s[i] - s[i + 1]);
        break;
      }
    }
    runs.push({ dark: !a.peak, length: Math.max(edge - at, 0.01) });
    at = edge;
  }
  runs.push({ dark: !turns[turns.length - 1].peak, length: Math.max(n - at, 0.01) });
  return runs;
}

// The first Telepen barcode found: { codes, numeric, value }, or null. `slants` (degrees) are
// the angles tried, all of them unless said; the camera tries a few on each picture it takes,
// so that it keeps up.
export function findTelepen(image, { slants = SLANTS } = {}) {
  const { width, height } = image;
  const grey = greyOf(image);
  for (const slant of slants) {
    for (const across of [true, false]) {
      const a = (slant * Math.PI) / 180;
      // The line's direction, and where the lines are spread: down the picture for lines
      // across it, along it for lines down it.
      const [dx, dy] = across ? [Math.cos(a), Math.sin(a)] : [-Math.sin(a), Math.cos(a)];
      const lines = across ? height : width;
      // From the middle outwards, where a barcode most likely is.
      for (let k = 0; k < LINES; k++) {
        const offset = Math.ceil(k / 2) * (k % 2 ? 1 : -1);
        const at = lines / 2 + (offset * lines) / (LINES + 2);
        const [x, y] = across ? [width / 2, at] : [at, height / 2];
        const found = readTelepenRuns(runsOf(sample(grey, width, height, x, y, dx, dy)));
        if (found) return found;
      }
    }
  }
  return null;
}
