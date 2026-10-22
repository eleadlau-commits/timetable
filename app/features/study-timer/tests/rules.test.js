import { test, assert } from 'folio/testing';
import {
  PRESETS, expand, totalMinutes, studyMinutes, snapMinutes, clampMinutes, newRun, position, upcomingChanges,
  historyEntries, startOfWeek, weekStats, studiedToday, formatMinutes, formatClock, differenceText, MINUTE,
} from '../rules.js';

const pomodoro = PRESETS.find((p) => p.id === 'pomodoro');
const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute).getTime(); // October 2026; the 19th is a Monday

test('a pattern repeats as a whole', () => {
  assert.equal(expand(pomodoro).length, 8);
  assert.equal(totalMinutes(pomodoro), 120);
  assert.equal(studyMinutes(pomodoro), 100);
});

test('dragged lengths snap to 5 minutes, typed ones are kept between 1 and 240', () => {
  assert.equal(snapMinutes(23), 25);
  assert.equal(snapMinutes(1), 5);
  assert.equal(snapMinutes(999), 240);
  assert.equal(clampMinutes('7'), 7);
  assert.equal(clampMinutes('0'), 1);
  assert.equal(clampMinutes('abc'), null);
});

test('the block that is on is worked out from the clock', () => {
  const run = newRun(pomodoro, 'MATH2031', at(20, 10));
  let p = position(run, at(20, 10, 10));
  assert.equal(p.index, 0);
  assert.equal(p.left, 15 * MINUTE);
  p = position(run, at(20, 10, 27));
  assert.equal(p.block.kind, 'rest');
  assert.equal(p.left, 3 * MINUTE);
  p = position(run, at(20, 13));
  assert.ok(p.done);
  assert.equal(p.endedAt, at(20, 12));
});

test('paused time does not count, and the timer carries on after a resume', () => {
  const run = newRun({ blocks: [{ kind: 'study', min: 60 }], repeat: 1 }, null, at(20, 10));
  run.events.push({ type: 'pause', at: at(20, 10, 20) }, { type: 'resume', at: at(20, 10, 50) });
  const paused = position(run, at(20, 10, 30));
  assert.ok(paused.paused);
  assert.equal(paused.left, 40 * MINUTE);
  const p = position(run, at(20, 11, 10));
  assert.equal(p.left, 20 * MINUTE);
  assert.deepEqual(p.stretches, [{ start: at(20, 10), end: at(20, 10, 20) }, { start: at(20, 10, 50), end: at(20, 11, 10) }]);
});

test('skipping goes to the next block and the skipped part does not count', () => {
  const run = newRun(pomodoro, null, at(20, 10));
  run.events.push({ type: 'skip', at: at(20, 10, 10) });
  const p = position(run, at(20, 10, 12));
  assert.equal(p.index, 1);
  assert.equal(p.left, 3 * MINUTE);
  assert.equal(p.stretches.reduce((n, s) => n + s.end - s.start, 0), 10 * MINUTE);
});

test('stopping early still counts what was done, but not rest', () => {
  const run = newRun(pomodoro, 'ECON1011', at(20, 10));
  const entries = historyEntries(run, at(20, 10, 40)); // 25 study, 5 rest, 10 study
  assert.equal(entries.reduce((n, e) => n + e.end - e.start, 0), 35 * MINUTE);
  assert.equal(entries[0].module, 'ECON1011');
});

test('notifications for each change of block, none while paused', () => {
  const run = newRun({ blocks: [{ kind: 'study', min: 25 }, { kind: 'rest', min: 5 }], repeat: 2 }, null, at(20, 10));
  const list = upcomingChanges(run, at(20, 10, 5));
  assert.deepEqual(list.map((n) => n.title), ['Time for a break', 'Back to studying', 'Time for a break', 'Session done']);
  assert.equal(list[0].at, at(20, 10, 25));
  assert.equal(list[3].at, at(20, 11));
  run.events.push({ type: 'pause', at: at(20, 10, 6) });
  assert.deepEqual(upcomingChanges(run, at(20, 10, 7)), []);
});

test('two study blocks in a row give one notification', () => {
  const run = newRun({ blocks: [{ kind: 'study', min: 10 }, { kind: 'study', min: 10 }], repeat: 1 }, null, at(20, 10));
  assert.deepEqual(upcomingChanges(run, at(20, 10)).map((n) => n.title), ['Session done']);
});

test('the week starts on Monday', () => {
  assert.equal(startOfWeek(at(25, 18)), at(19, 0)); // Sunday → the Monday before
  assert.equal(startOfWeek(at(19, 0)), at(19, 0));
});

test('a session that crosses midnight counts on both days', () => {
  const history = [{ start: at(20, 23, 30), end: at(21, 0, 30), module: 'A', session: 1 }];
  const w = weekStats(history, at(22, 12));
  assert.equal(w.days[1].total, 30 * MINUTE);
  assert.equal(w.days[2].total, 30 * MINUTE);
  assert.equal(studiedToday(history, at(21, 9)), 30 * MINUTE);
});

test('this week: totals by day and module, last week, and the number of sessions', () => {
  const history = [
    { start: at(19, 9), end: at(19, 10), module: 'A', session: 1 },
    { start: at(19, 10, 5), end: at(19, 10, 35), module: 'A', session: 1 },
    { start: at(21, 14), end: at(21, 14, 45), module: null, session: 2 },
    { start: at(14, 9), end: at(14, 11), module: 'B', session: 3 }, // last week
  ];
  const w = weekStats(history, at(22, 12));
  assert.equal(w.total, 135 * MINUTE);
  assert.equal(w.lastWeek, 120 * MINUTE);
  assert.equal(w.sessions, 2);
  assert.deepEqual(w.modules.map((m) => m.module), ['A', null]);
  assert.equal(w.days[0].byModule.A, 90 * MINUTE);
});

test('words', () => {
  assert.equal(formatMinutes(90), '1 h 30 min');
  assert.equal(formatMinutes(120), '2 h');
  assert.equal(formatMinutes(25), '25 min');
  assert.equal(formatClock(25 * MINUTE), '25:00');
  assert.equal(formatClock(62 * MINUTE + 3000), '1:02:03');
  assert.equal(formatClock(500), '0:01');
  assert.equal(differenceText(70 * MINUTE, 0), '1 h 10 min more than last week');
  assert.equal(differenceText(0, 20 * MINUTE), '20 min less than last week');
  assert.equal(differenceText(MINUTE, MINUTE), 'Same as last week');
});
