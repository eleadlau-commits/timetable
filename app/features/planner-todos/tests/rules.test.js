import { test, assert } from 'folio/testing';
import { dayKey, forDay, markFor, markLabel, lateLabel } from '../rules.js';

const today = '2026-11-10';
const item = (id, due, extra = {}) => ({ id, text: id, tag: null, due, done: false, added: 0, ...extra });
const ids = (rows) => rows.map((r) => `${r.item.id}${r.overdue ? '!' : ''}`);

const items = [
  item('essay', '2026-11-09', { added: 1 }),           // overdue
  item('old', '2026-11-02', { added: 9 }),             // overdue, older
  item('read', today, { done: true, added: 2 }),       // done today
  item('email', today, { added: 5 }),                  // due today
  item('book', '2026-11-12', { added: 3 }),            // later
  item('notebook', null, { added: 4 }),                // no date
  item('ticked-late', '2026-11-08', { done: true }),   // ticked, so not overdue
];

test('days are the phone\'s own day', () => {
  assert.equal(dayKey(new Date(2026, 10, 10, 23, 59)), '2026-11-10');
  assert.equal(dayKey(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});

test('today shows overdue to-dos first (oldest first), then today\'s, then ticked ones', () => {
  assert.deepEqual(ids(forDay(items, today, today)), ['old!', 'essay!', 'email', 'read']);
});

test('an overdue to-do ticked off today stays on today, ticked, but not one ticked another day', () => {
  const more = [...items, item('late-today', '2026-11-05', { done: true, doneOn: today, added: 7 })];
  assert.deepEqual(ids(forDay(more, today, today)), ['old!', 'essay!', 'email', 'late-today', 'read']);
  assert.deepEqual(ids(forDay(more, '2026-11-11', today)), []);
});

test('another day shows only its own to-dos', () => {
  assert.deepEqual(ids(forDay(items, '2026-11-12', today)), ['book']);
  assert.deepEqual(ids(forDay(items, '2026-11-11', today)), []);
});

test('an earlier day shows its unticked to-dos as overdue, and ticked ones as done', () => {
  assert.deepEqual(ids(forDay(items, '2026-11-09', today)), ['essay!']);
  assert.deepEqual(ids(forDay(items, '2026-11-08', today)), ['ticked-late']);
});

test('to-dos without a date never go on a day', () => {
  for (const day of ['2026-11-01', today, '2026-12-25']) {
    assert.ok(!forDay(items, day, today).some((r) => r.item.id === 'notebook'));
  }
});

test('a day gets a mark only while something is left to do on it', () => {
  assert.deepEqual(markFor(items, today, today), { late: false, count: 1 });
  assert.deepEqual(markFor(items, '2026-11-09', today), { late: true, count: 1 });
  assert.equal(markFor(items, '2026-11-08', today), null); // only a ticked one
  assert.equal(markFor(items, '2026-11-11', today), null);
});

test('the words a screen reader hears', () => {
  assert.equal(markLabel(null), null);
  assert.equal(markLabel({ late: false, count: 1 }), '1 to-do');
  assert.equal(markLabel({ late: true, count: 3 }), '3 to-dos overdue');
});

test('an overdue to-do says when it was due', () => {
  assert.equal(lateLabel('2026-11-09', today), 'Yesterday');
  assert.ok(lateLabel('2026-11-02', today).includes('2'));
  assert.ok(lateLabel('2025-11-02', today).includes('2025'));
});
