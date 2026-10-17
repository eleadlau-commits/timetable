import { test, assert } from 'folio/testing';
import { barWidths } from '../barcode.js';
import { findCode128Start, readCodabar, patternVariance, fixZXing } from '../zxing-fixes.js';

// A row of a photo, like ZXing's: getSize() and get(i) (true = dark). Built from [dark, pixels] parts.
function row(...parts) {
  const bits = parts.flatMap(([dark, n]) => Array(Math.round(n)).fill(dark));
  return { getSize: () => bits.length, get: (i) => bits[i] };
}
// A barcode's bars and spaces at some pixels per unit, starting with a bar.
const bars = (format, value, unit = 3) => barWidths(format, value).map((w, i) => [i % 2 === 0, w * unit]);
const DARK = [true, 120]; // the table or a hand beside the card
const WHITE = [false, 40]; // the card's white edge

test('pattern variance: 0 for a perfect match, Infinity when far off', () => {
  assert.equal(patternVariance([4, 2, 2, 8, 2, 4], [2, 1, 1, 4, 1, 2]), 0);
  assert.equal(patternVariance([2, 2, 2, 2, 2, 2], [2, 1, 1, 4, 1, 2]), Infinity);
});

test('Code 128 is found on a plain white row', () => {
  const found = findCode128Start(row(WHITE, ...bars('code_128', '12345678'), WHITE));
  assert.deepEqual([found[0], found[2]], [40, 105]); // starts after the white edge, with Start C
});

test('Code 128 is found with something dark to its left (ZXing\'s own search misses it)', () => {
  const found = findCode128Start(row(DARK, WHITE, ...bars('code_128', '12345678'), WHITE, DARK));
  assert.ok(found, 'expected the start to be found');
  assert.deepEqual([found[0], found[2]], [160, 105]);
  const text = findCode128Start(row(DARK, WHITE, [true, 6], [false, 9], [true, 3], WHITE, ...bars('code_128', 'AB12'), WHITE));
  assert.equal(text?.[2], 104); // Start B, after a few unrelated marks
});

test('Code 128 needs white space before it', () => {
  assert.equal(findCode128Start(row(DARK, [false, 2], ...bars('code_128', '12345678'), WHITE)), null);
  assert.equal(findCode128Start(row(WHITE, DARK, WHITE)), null);
});

test('Codabar is read with dark areas on both sides', () => {
  const found = readCodabar(row(DARK, WHITE, ...bars('codabar', 'A123456789B'), WHITE, DARK));
  assert.equal(found?.text, 'A123456789B');
  assert.equal(found.left, 160);
});

test('Codabar is read at other sizes and with uneven bars', () => {
  assert.equal(readCodabar(row(WHITE, ...bars('codabar', 'C40156D', 2), WHITE))?.text, 'C40156D');
  const uneven = bars('codabar', 'A987654B', 4).map(([dark, n], i) => [dark, n + (i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0)]);
  assert.equal(readCodabar(row(DARK, WHITE, ...uneven, WHITE))?.text, 'A987654B');
});

test('Codabar reads every character, including "+"', () => {
  assert.equal(readCodabar(row(WHITE, ...bars('codabar', 'A0123456789-$:/.+B'), WHITE))?.text, 'A0123456789-$:/.+B');
});

test('Codabar needs a start and a stop letter, white space around, and a few characters', () => {
  const noStop = bars('codabar', 'A1234B').slice(0, -8); // cut off the stop letter
  assert.equal(readCodabar(row(WHITE, ...noStop, WHITE)), null);
  assert.equal(readCodabar(row(DARK, ...bars('codabar', 'A1234B'), WHITE)), null);
  assert.equal(readCodabar(row(WHITE, ...bars('codabar', 'A1B'), WHITE)), null);
  assert.equal(readCodabar(row(WHITE, DARK, WHITE)), null);
});

test('the fixes go into a ZXing library once, and are safe without one', () => {
  fixZXing(null);
  class NotFoundException extends Error {}
  const Z = { Code128Reader: {}, NotFoundException };
  fixZXing(Z);
  const start = Z.Code128Reader.findStartPattern(row(DARK, WHITE, ...bars('code_128', '12345678'), WHITE));
  assert.ok(start instanceof Int32Array);
  assert.equal(start[2], 105);
  let error = null;
  try {
    Z.Code128Reader.findStartPattern(row(WHITE));
  } catch (err) {
    error = err;
  }
  assert.ok(error instanceof NotFoundException, 'expected ZXing\'s "not found" error');
  const patched = Z.Code128Reader.findStartPattern;
  fixZXing(Z);
  assert.equal(Z.Code128Reader.findStartPattern, patched);
});
