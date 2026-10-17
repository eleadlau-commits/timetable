// Fixes for two bugs in the ZXing barcode reader (@zxing/library 0.21.3), which reads barcodes
// on phones whose browser has no built-in reader, and in every photo the built-in one misses.
// Both bugs only show up when there's something dark on the same line as the barcode (the
// table, a hand, the card's edge), which is what nearly every photo of a card looks like.
//
// 1. Code 128: the search for the start of the barcode breaks after its first wrong guess
//    (it shrinks its list of bar widths from 6 to 4), so anything dark to the left of the
//    barcode hides it. findCode128Start is the same search, without the bug.
// 2. Codabar: the reader takes everything from the first dark spot on a line to the last as
//    the barcode, and has the wrong pattern for "+". readCodabar looks for a real start and
//    stop character with white space around them.
//
// fixZXing(window.ZXing) puts both into the library once it has loaded. The rules work on any
// row with getSize() and get(i) (true = dark), so they can be tested without the library.

import { CODABAR } from './barcode.js';

// Code 128's three start characters (A, B and C), as bar and space widths, and how far a
// pattern may be from them (the same limits ZXing uses).
const CODE128_STARTS = { 103: [2, 1, 1, 4, 1, 2], 104: [2, 1, 1, 2, 1, 4], 105: [2, 1, 1, 2, 3, 2] };
const MAX_AVG_VARIANCE = 0.25;
const MAX_INDIVIDUAL_VARIANCE = 0.7;

// How far some measured widths are from a pattern: 0 is a perfect match, Infinity is no match.
export function patternVariance(counters, pattern, maxIndividual = MAX_INDIVIDUAL_VARIANCE) {
  const total = counters.reduce((a, b) => a + b, 0);
  const units = pattern.reduce((a, b) => a + b, 0);
  if (total < units) return Infinity; // less than a pixel per unit: too small to trust
  const unit = total / units;
  let sum = 0;
  for (let i = 0; i < counters.length; i++) {
    const off = Math.abs(counters[i] - pattern[i] * unit);
    if (off > maxIndividual * unit) return Infinity;
    sum += off;
  }
  return sum / total;
}

const isWhite = (row, from, to) => {
  for (let i = Math.max(0, from); i < to; i++) if (row.get(i)) return false;
  return true;
};

// Where a Code 128 barcode starts on a row: [start, end, start character], or null.
// It needs white space before the start character, at least half as wide as it.
export function findCode128Start(row) {
  const width = row.getSize();
  let first = 0;
  while (first < width && !row.get(first)) first++;
  const counters = [0, 0, 0, 0, 0, 0];
  let position = 0;
  let patternStart = first;
  let white = false;
  for (let i = first; i < width; i++) {
    if (row.get(i) !== white) {
      counters[position]++;
      continue;
    }
    if (position === 5) {
      let best = MAX_AVG_VARIANCE;
      let match = -1;
      for (const [code, pattern] of Object.entries(CODE128_STARTS)) {
        const variance = patternVariance(counters, pattern);
        if (variance < best) {
          best = variance;
          match = Number(code);
        }
      }
      if (match >= 0 && isWhite(row, Math.floor(patternStart - (i - patternStart) / 2), patternStart)) {
        return [patternStart, i, match];
      }
      // Not a start character: move along by one bar and one space, keeping all six counts.
      patternStart += counters[0] + counters[1];
      counters.copyWithin(0, 2);
      counters[4] = 0;
      counters[5] = 0;
      position = 4;
    } else {
      position++;
    }
    counters[position] = 1;
    white = !white;
  }
  return null;
}

// The run lengths of a row: [{ dark, length, at }], alternating light and dark.
function runsOf(row) {
  const runs = [];
  const width = row.getSize();
  for (let i = 0; i < width; i++) {
    const dark = !!row.get(i);
    const last = runs[runs.length - 1];
    if (last && last.dark === dark) last.length++;
    else runs.push({ dark, length: 1, at: i });
  }
  return runs;
}

const CODABAR_KEYS = Object.fromEntries(Object.entries(CODABAR).map(([char, pattern]) => [pattern, char]));
const CODABAR_ENDS = new Set(['A', 'B', 'C', 'D']);

// One Codabar character from 7 widths (bar, space, bar, …), or null. Each character has two or
// three wide parts; the wide ones must be clearly wider than the narrow ones.
function codabarChar(widths) {
  const order = widths.map((w, i) => [w, i]).sort((a, b) => b[0] - a[0]);
  for (const wide of [2, 3]) {
    const narrowest = order[wide - 1][0];
    const widestNarrow = order[wide][0];
    if (narrowest < widestNarrow * 1.5) continue;
    const isWide = new Set(order.slice(0, wide).map(([, i]) => i));
    const char = CODABAR_KEYS[widths.map((_, i) => (isWide.has(i) ? 'w' : 'n')).join('')];
    if (char) return char;
  }
  return null;
}

// Reads a Codabar barcode on a row: { text, left, right }, or null. The text keeps its start
// and stop letters (e.g. "A123456B"), as ZXing's own reader does.
export function readCodabar(row, { minLength = 4 } = {}) {
  const runs = runsOf(row);
  for (let s = 0; s < runs.length; s++) {
    if (!runs[s].dark) continue;
    const result = codabarFrom(runs, s, row.getSize());
    if (result && result.text.length >= minLength) return result;
  }
  return null;
}

function codabarFrom(runs, s, width) {
  let text = '';
  let i = s;
  let charWidth = 0;
  for (;;) {
    if (i + 7 > runs.length) return null;
    const parts = runs.slice(i, i + 7).map((r) => r.length);
    const char = codabarChar(parts);
    if (!char) return null;
    const size = parts.reduce((a, b) => a + b, 0);
    if (!text) {
      if (!CODABAR_ENDS.has(char)) return null;
      const before = s > 0 ? runs[s - 1].length : Infinity;
      if (before < size / 2) return null; // no white space before the start letter
      charWidth = size;
    } else if (size < charWidth * 0.6 || size > charWidth * 1.6) {
      return null; // a different size from the start letter: not part of this barcode
    }
    text += char;
    const after = runs[i + 7];
    if (text.length > 1 && CODABAR_ENDS.has(char)) {
      // The stop letter: white space after it, then it's done.
      if (after && after.length < size / 2) return null;
      return { text, left: runs[s].at, right: after ? after.at : width };
    }
    if (!after || after.length > Math.max(...parts) * 1.5) return null; // the barcode stopped without a stop letter
    i += 8;
  }
}

// Puts the fixes into the ZXing library (window.ZXing) once. Safe to call more than once, and
// does nothing to parts of the library that aren't there.
export function fixZXing(Z) {
  if (!Z || Z.mobileDurhamFixed) return;
  Z.mobileDurhamFixed = true;
  if (Z.Code128Reader) {
    Z.Code128Reader.findStartPattern = (row) => {
      const found = findCode128Start(row);
      if (!found) throw new Z.NotFoundException();
      return Int32Array.from(found);
    };
  }
  if (Z.CodaBarReader && Z.Result && Z.ResultPoint) {
    Z.CodaBarReader.prototype.decodeRow = function decodeRow(rowNumber, row) {
      const found = readCodabar(row);
      if (!found) throw new Z.NotFoundException();
      return new Z.Result(found.text, null, 0,
        [new Z.ResultPoint(found.left, rowNumber), new Z.ResultPoint(found.right, rowNumber)],
        Z.BarcodeFormat.CODABAR, Date.now());
    };
  }
}
