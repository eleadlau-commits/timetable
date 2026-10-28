import { test, assert } from 'folio/testing';
import { layoutLanes, minutesInto, hourRange, monthGrid, academicYear, addMonths } from '../layout.js';

test('sessions that clash sit side by side', () => {
  const blocks = layoutLanes([{ top: 60, bottom: 120 }, { top: 0, bottom: 90 }, { top: 200, bottom: 260 }]);
  assert.deepEqual(blocks.map((b) => [b.top, b.lane, b.lanes]), [[0, 0, 2], [60, 1, 2], [200, 0, 1]]);
});

test('a session after a clash can reuse a free lane', () => {
  const blocks = layoutLanes([{ top: 0, bottom: 60 }, { top: 30, bottom: 120 }, { top: 60, bottom: 90 }]);
  assert.deepEqual(blocks.map((b) => b.lane), [0, 1, 0]);
  assert.ok(blocks.every((b) => b.lanes === 2));
});

test('minutes are counted within the day', () => {
  const day = new Date(2026, 9, 28);
  assert.equal(minutesInto(new Date(2026, 9, 28, 9, 30), day), 570);
  assert.equal(minutesInto(new Date(2026, 9, 27, 23, 0), day), 0);
  assert.equal(minutesInto(new Date(2026, 9, 29, 1, 0), day), 1440);
});

test('the grid widens to fit early and late sessions', () => {
  const day = new Date(2026, 9, 28);
  const items = [{ start: new Date(2026, 9, 28, 8, 15), end: new Date(2026, 9, 28, 9, 0) },
    { start: new Date(2026, 9, 28, 18, 0), end: new Date(2026, 9, 28, 19, 30) },
    { allDay: true, start: day, end: new Date(2026, 9, 29) }];
  assert.deepEqual(hourRange([{ day, items }]), { start: 8, end: 20 });
  assert.deepEqual(hourRange([{ day, items: [] }]), { start: 9, end: 17 });
});

test('a month grid starts on a Monday and covers the whole month', () => {
  const weeks = monthGrid(new Date(2026, 9, 28)); // October 2026 starts on a Thursday
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0][0].getDate(), 28); // Monday 28 September
  assert.equal(weeks[0][3].getDate(), 1);
  assert.equal(weeks[4][6].getDate(), 1); // Sunday 1 November
  assert.ok(weeks.every((w) => w.length === 7 && w[0].getDay() === 1));
  assert.equal(monthGrid(new Date(2027, 1, 10)).length, 4); // February 2027 starts on a Monday
  assert.equal(monthGrid(new Date(2026, 10, 3)).length, 6); // November 2026 starts on a Sunday
});

test('the academic year runs from September to August', () => {
  assert.equal(academicYear(new Date(2026, 9, 28)).label, '2026–27');
  assert.equal(academicYear(new Date(2027, 7, 31)).label, '2026–27');
  assert.equal(academicYear(new Date(2027, 8, 1)).label, '2027–28');
  const { months } = academicYear(new Date(2027, 2, 1));
  assert.equal(months.length, 12);
  assert.equal(months[0].getMonth(), 8);
  assert.equal(months[11].getMonth(), 7);
});

test('moving a month keeps the day where it can', () => {
  assert.equal(addMonths(new Date(2026, 9, 28), 1).toDateString(), new Date(2026, 10, 28).toDateString());
  assert.equal(addMonths(new Date(2027, 0, 31), 1).toDateString(), new Date(2027, 1, 28).toDateString());
  assert.equal(addMonths(new Date(2026, 0, 15), -1).toDateString(), new Date(2025, 11, 15).toDateString());
});
