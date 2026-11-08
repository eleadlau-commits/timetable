import { test, assert } from 'folio/testing';
import { mondayOf } from '../weeks.js';

const ymd = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

test('the next-week arrow lands on next Monday', () => {
  assert.equal(ymd(mondayOf(new Date(2026, 10, 11), 1)), '2026-11-16'); // Wednesday → Monday
  assert.equal(ymd(mondayOf(new Date(2026, 10, 9), 1)), '2026-11-16'); // Monday → next Monday
  assert.equal(ymd(mondayOf(new Date(2026, 10, 15), 1)), '2026-11-16'); // Sunday → the next day
});

test('the previous-week arrow lands on last week\'s Monday', () => {
  assert.equal(ymd(mondayOf(new Date(2026, 10, 11), -1)), '2026-11-2');
  assert.equal(ymd(mondayOf(new Date(2026, 10, 9), -1)), '2026-11-2');
});

test('across the end of a month and a year', () => {
  assert.equal(ymd(mondayOf(new Date(2026, 11, 30), 1)), '2027-1-4');
});
