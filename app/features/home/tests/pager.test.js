import { test, assert } from 'folio/testing';
import { dragOffset, settle } from '../pager.js';

test('pages follow the finger, but only a little past the first and last page', () => {
  assert.equal(dragOffset(1, -100, 3), -100);
  assert.equal(dragOffset(1, 100, 3), 100);
  assert.equal(dragOffset(0, 100, 3), 30);
  assert.equal(dragOffset(2, -100, 3), -30);
  assert.equal(dragOffset(0, -100, 3), -100);
});

test('a long enough swipe moves one page, a short one springs back', () => {
  assert.equal(settle(0, -120, 390, 3), 1);
  assert.equal(settle(1, 120, 390, 3), 0);
  assert.equal(settle(1, -40, 390, 3), 1);
  assert.equal(settle(1, -200, 390, 3), 2);
});

test('a quick flick moves one page even when it is short', () => {
  assert.equal(settle(0, -40, 390, 3, { fast: true }), 1);
  assert.equal(settle(0, -20, 390, 3, { fast: true }), 0);
});

test('swiping stops at the first and last page', () => {
  assert.equal(settle(0, 200, 390, 3), 0);
  assert.equal(settle(2, -200, 390, 3), 2);
  assert.equal(settle(0, -200, 390, 1), 0);
});
