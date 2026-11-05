import { test, assert } from 'folio/testing';
import { readOpen, writeOpen, summary, openState, clock, fromInput, toInput } from '../hours.js';

const WEEK = '0800-1700|0800-1700|0800-1700|0800-1700|0800-1700|0900-1700|';
// 2 Nov 2026 is a Monday.
const on = (day, h, m = 0) => new Date(2026, 10, 2 + day, h, m);

test('opening times are read and written back the same', () => {
  const days = readOpen(WEEK);
  assert.equal(days.length, 7);
  assert.deepEqual(days[0], { from: 480, to: 1020 });
  assert.equal(days[6], null);
  assert.equal(writeOpen(days), WEEK);
  assert.equal(writeOpen([null, null, null, null, null, null, null]), '');
});

test('opening times that make no sense are left out', () => {
  assert.equal(readOpen(''), null);
  assert.equal(readOpen('Mon–Fri 8–5'), null);
  assert.equal(readOpen('0800-1700|||||'), null); // six days
  assert.equal(readOpen('2500-0300||||||'), null);
  assert.equal(readOpen('0861-1700||||||'), null);
  assert.equal(readOpen('0800-0800||||||'), null);
  assert.equal(readOpen(42), null);
});

test('the short line groups days with the same times', () => {
  assert.equal(summary(readOpen(WEEK)), 'Mon–Fri 8am–5pm, Sat 9am–5pm');
  assert.equal(summary(readOpen('0800-1700|0800-1700||||1200-1430|')), 'Mon, Tue 8am–5pm, Sat 12pm–2:30pm');
  assert.equal(summary(readOpen('||||2200-0300|2200-0300|')), 'Fri, Sat 10pm–3am');
  assert.equal(summary(null), '');
});

test('clock times read the British way', () => {
  assert.equal(clock(0), 'midnight');
  assert.equal(clock(24 * 60), 'midnight');
  assert.equal(clock(12 * 60), '12pm');
  assert.equal(clock(8 * 60 + 30), '8:30am');
  assert.equal(clock(17 * 60), '5pm');
  assert.equal(fromInput('08:30'), 510);
  assert.equal(fromInput('8:30'), 510);
  assert.equal(fromInput('24:00'), null);
  assert.equal(fromInput(''), null);
  assert.equal(toInput(510), '08:30');
  assert.equal(toInput(24 * 60), '00:00');
});

test('open now, and when it opens next', () => {
  const days = readOpen(WEEK);
  assert.deepEqual(openState(days, on(0, 10)), { open: true, text: 'Open now · closes 5pm' });
  assert.deepEqual(openState(days, on(0, 7)), { open: false, text: 'Closed · opens 8am' });
  assert.deepEqual(openState(days, on(0, 17)), { open: false, text: 'Closed · opens tomorrow 8am' });
  assert.deepEqual(openState(days, on(5, 18)), { open: false, text: 'Closed · opens Mon 8am' });
  assert.deepEqual(openState(days, on(6, 12)), { open: false, text: 'Closed · opens tomorrow 8am' });
  assert.equal(openState(null), null);
});

test('late nights run past midnight', () => {
  const club = readOpen('||||2200-0300|2200-0300|');
  assert.deepEqual(openState(club, on(4, 23)), { open: true, text: 'Open now · closes 3am' });
  assert.deepEqual(openState(club, on(5, 1)), { open: true, text: 'Open now · closes 3am' }); // Saturday 1am: Friday night
  assert.deepEqual(openState(club, on(6, 2)), { open: true, text: 'Open now · closes 3am' }); // Sunday 2am: Saturday night
  assert.deepEqual(openState(club, on(6, 4)), { open: false, text: 'Closed · opens Fri 10pm' });
});
