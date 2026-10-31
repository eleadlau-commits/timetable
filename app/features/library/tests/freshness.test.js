import { test, assert } from 'folio/testing';
import { shouldCheck, isOld, MINUTE } from '../freshness.js';

const now = 1_000_000_000_000;

test('coming to the front always checks, unless it checked moments ago', () => {
  assert.equal(shouldCheck({ now, tried: 0, why: 'front' }), true);
  assert.equal(shouldCheck({ now, tried: now - 2 * MINUTE, why: 'front' }), true);
  assert.equal(shouldCheck({ now, tried: now - 10 * 1000, why: 'front' }), false);
});

test('while open, it checks every 5 minutes', () => {
  assert.equal(shouldCheck({ now, tried: now - 4 * MINUTE, why: 'tick' }), false);
  assert.equal(shouldCheck({ now, tried: now - 5 * MINUTE, why: 'tick' }), true);
  assert.equal(shouldCheck({ now, tried: undefined, why: 'tick' }), true);
});

test('numbers older than 15 minutes count as old', () => {
  assert.equal(isOld(now - 14 * MINUTE, now), false);
  assert.equal(isOld(now - 16 * MINUTE, now), true);
  assert.equal(isOld(null, now), true);
});
