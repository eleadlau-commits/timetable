// Looks for a Telepen barcode in a picture (ImageData: { width, height, data }), along lines
// across it and, for a card held sideways, down it. Works offline, without ZXing.
//
// Each line is turned into dark and light by comparing every spot with the brightness around
// it, so shadows and uneven light don't matter; then telepen.js reads it.

import { readTelepen } from './telepen.js';

const LINES = 48; // lines tried each way, spread over the middle of the picture
const MIN_CONTRAST = 24; // how much darker than its surroundings a spot must be to count as a bar

// The brightness (0–255) of each spot along a line of the picture.
function brightness(image, across, index) {
  const { width, height, data } = image;
  const length = across ? width : height;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const p = 4 * (across ? index * width + i : i * width + index);
    out[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return out;
}

// A line as dark and light (getSize(), get(i)), judging each spot against the average
// brightness within `reach` spots either side of it.
export function lineOf(values, reach) {
  const n = values.length;
  const sums = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) sums[i + 1] = sums[i] + values[i];
  const dark = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - reach);
    const b = Math.min(n, i + reach + 1);
    const mean = (sums[b] - sums[a]) / (b - a);
    dark[i] = values[i] < mean - MIN_CONTRAST / 2 && values[i] < 200 ? 1 : 0;
  }
  return { getSize: () => n, get: (i) => dark[i] === 1 };
}

// The first Telepen barcode found: { codes, numeric, value }, or null.
export function findTelepen(image) {
  for (const across of [true, false]) {
    const lines = across ? image.height : image.width;
    const length = across ? image.width : image.height;
    const reach = Math.max(8, Math.round(length / 24));
    // From the middle outwards, where a barcode most likely is.
    for (let n = 0; n < LINES; n++) {
      const offset = Math.ceil(n / 2) * (n % 2 ? 1 : -1);
      const index = Math.round(lines / 2 + (offset * lines) / (LINES + 2));
      if (index < 0 || index >= lines) continue;
      const found = readTelepen(lineOf(brightness(image, across, index), reach));
      if (found) return found;
    }
  }
  return null;
}
