import { test, assert } from 'folio/testing';
import { backToToday, pullDistance, pullRefreshes, isPullDown, PULL_MAX } from '../rules.js';

const at = (h, m, day = 9) => new Date(2026, 10, day, h, m).getTime();

test('a quick look at another app keeps your place', () => {
  assert.equal(backToToday(at(10, 0), at(10, 5)), false);
  assert.equal(backToToday(at(10, 0), at(10, 29)), false);
});

test('30 minutes or more away goes back to today', () => {
  assert.equal(backToToday(at(10, 0), at(10, 30)), true);
  assert.equal(backToToday(at(10, 0), at(15, 0)), true);
});

test('a new day goes back to today, even after a few minutes', () => {
  assert.equal(backToToday(at(23, 55, 9), at(0, 5, 10)), true);
});

test('nothing to compare with: stay put', () => {
  assert.equal(backToToday(null, at(10, 0)), false);
});

test('the spinner follows the pull at half speed, up to a limit', () => {
  assert.equal(pullDistance(-20), 0);
  assert.equal(pullDistance(40), 20);
  assert.equal(pullDistance(1000), PULL_MAX);
});

test('only a long enough pull refreshes', () => {
  assert.equal(pullRefreshes(60), false);
  assert.equal(pullRefreshes(140), true);
});

test('a sideways swipe is not a pull', () => {
  assert.equal(isPullDown(0, 30), true);
  assert.equal(isPullDown(40, 30), false);
  assert.equal(isPullDown(2, 8), false);
  assert.equal(isPullDown(0, -30), false);
});
