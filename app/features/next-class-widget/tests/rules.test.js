import { test, assert } from 'folio/testing';
import { KEY, MOST, widgetData } from '../rules.js';

const at = (day, hour, minute = 0) => new Date(2026, 10, day, hour, minute); // November 2026
const session = (day, from, to, extra = {}) =>
  ({ start: at(day, from), end: at(day, to), cancelled: false, name: 'Maths', where: 'Lecture · TLC', ...extra });

test('the key the Android widget reads never changes', () => {
  assert.equal(KEY, 'mobile-durham.next-classes');
});

test('classes still to come, in time order, as start, end, name and place', () => {
  const now = at(12, 10, 30);
  const data = widgetData({ hasTimetable: true, now, sessions: [
    session(13, 9, 10, { name: 'Physics', where: '' }),
    session(12, 10, 11),
    session(12, 9, 10), // already over
  ] });
  assert.equal(data.v, 1);
  assert.equal(data.has, true);
  assert.equal(data.made, +now);
  assert.deepEqual(data.classes, [
    { s: +at(12, 10), e: +at(12, 11), n: 'Maths', w: 'Lecture · TLC' },
    { s: +at(13, 9), e: +at(13, 10), n: 'Physics', w: '' },
  ]);
});

test('cancelled and all-day ones are left out', () => {
  const data = widgetData({ hasTimetable: true, now: at(12, 8), sessions: [
    session(12, 9, 10, { cancelled: true }),
    session(12, 0, 23, { allDay: true }),
    session(12, 14, 15),
  ] });
  assert.deepEqual(data.classes.map((c) => c.s), [+at(12, 14)]);
});

test('without a timetable it says so, and a nameless class is still called something', () => {
  assert.equal(widgetData({ hasTimetable: false, now: at(12, 8), sessions: [] }).has, false);
  const data = widgetData({ hasTimetable: true, now: at(12, 8), sessions: [session(12, 9, 10, { name: '', where: undefined })] });
  assert.deepEqual(data.classes[0], { s: +at(12, 9), e: +at(12, 10), n: 'Class', w: '' });
});

test('it stays small', () => {
  const many = Array.from({ length: 300 }, (_, i) => session(13, 9, 10, { start: new Date(+at(13, 9) + i * 60000) }));
  assert.equal(widgetData({ hasTimetable: true, now: at(12, 8), sessions: many }).classes.length, MOST);
});
