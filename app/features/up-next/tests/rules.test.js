import { test, assert } from 'folio/testing';
import { stripDays, dayPlan, fadeStep, nextSession, isOn } from '../rules.js';

const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute); // October 2026
const session = (day, from, to, extra = {}) => ({ start: at(day, from), end: at(day, to), cancelled: false, ...extra });
const days = (list) => list.map((d) => d.getDate());

// 15 October 2026 is a Thursday.
test('the date strip starts with today, then skips the weekend', () => {
  assert.deepEqual(days(stripDays(at(15, 13))), [15, 16, 19]);
});

test('the next page of the strip carries on with weekdays', () => {
  assert.deepEqual(days(stripDays(at(15, 13), 1)), [20, 21, 22]);
  assert.deepEqual(days(stripDays(at(15, 13), 2)), [23, 26, 27]);
});

test('on a Saturday, today still comes first', () => {
  assert.deepEqual(days(stripDays(at(17, 10))), [17, 19, 20]);
});

test('today: the class on now leads, earlier ones are left out', () => {
  const list = [session(15, 9, 10), session(15, 13, 14), session(15, 16, 17), session(15, 17, 18)];
  const plan = dayPlan(list, at(15, 13, 30), true);
  assert.equal(plan.lead, list[1]);
  assert.deepEqual(plan.rest, [list[2], list[3]]);
  assert.equal(plan.over, false);
});

test('today: a cancelled class never leads', () => {
  const list = [session(15, 14, 15, { cancelled: true }), session(15, 16, 17)];
  const plan = dayPlan(list, at(15, 13), true);
  assert.equal(plan.lead, list[1]);
});

test('today: after the last class the day is over', () => {
  const list = [session(15, 9, 10), session(15, 11, 12)];
  const plan = dayPlan(list, at(15, 18), true);
  assert.equal(plan.lead, null);
  assert.equal(plan.over, true);
});

test('a day with no classes is not "over", just empty', () => {
  const plan = dayPlan([], at(15, 18), true);
  assert.equal(plan.lead, null);
  assert.equal(plan.over, false);
});

test('another day: the first class leads and the rest follow', () => {
  const list = [session(16, 9, 10), session(16, 11, 12)];
  const plan = dayPlan(list, at(15, 18), false);
  assert.equal(plan.lead, list[0]);
  assert.deepEqual(plan.rest, [list[1]]);
});

test('later classes get fainter in three steps', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(fadeStep), [1, 2, 3, 3, 3]);
});

test('the next class is the next one to start, not one already on', () => {
  const list = [session(16, 9, 10), session(15, 13, 14), session(15, 16, 17)];
  assert.equal(nextSession(list, at(15, 13, 30)), list[2]);
});

test('there is no next class when nothing is coming up within a week', () => {
  assert.equal(nextSession([session(30, 9, 10)], at(15, 13)), null);
});

test('a class is on from its start until its end', () => {
  const s = session(15, 9, 10);
  assert.ok(isOn(s, at(15, 9)));
  assert.ok(!isOn(s, at(15, 10)));
});
