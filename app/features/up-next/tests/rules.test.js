import { test, assert } from 'folio/testing';
import { dayPlan, fadeStep, isOn, isWeekend } from '../rules.js';

const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute); // October 2026
const session = (day, from, to, extra = {}) => ({ start: at(day, from), end: at(day, to), cancelled: false, ...extra });

// 15 October 2026 is a Thursday.
test('today: the class on now leads, earlier ones are left out', () => {
  const list = [session(15, 9, 10), session(15, 13, 14), session(15, 16, 17), session(15, 17, 18)];
  const plan = dayPlan(list, at(15, 13, 30));
  assert.equal(plan.lead, list[1]);
  assert.deepEqual(plan.rest, [list[2], list[3]]);
  assert.equal(plan.over, false);
});

test('today: a cancelled class never leads', () => {
  const list = [session(15, 14, 15, { cancelled: true }), session(15, 16, 17)];
  const plan = dayPlan(list, at(15, 13));
  assert.equal(plan.lead, list[1]);
});

test('today: after the last class the day is over', () => {
  const list = [session(15, 9, 10), session(15, 11, 12)];
  const plan = dayPlan(list, at(15, 18));
  assert.equal(plan.lead, null);
  assert.equal(plan.over, true);
});

test('a day with no classes is not "over", just empty', () => {
  const plan = dayPlan([], at(15, 18));
  assert.equal(plan.lead, null);
  assert.equal(plan.over, false);
});

test('later classes get fainter in three steps', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(fadeStep), [1, 2, 3, 3, 3]);
});

test('the weekend is Saturday and Sunday', () => {
  assert.deepEqual([16, 17, 18, 19].map((d) => isWeekend(at(d, 12))), [false, true, true, false]);
});

test('a class is on from its start until its end', () => {
  const s = session(15, 9, 10);
  assert.ok(isOn(s, at(15, 9)));
  assert.ok(!isOn(s, at(15, 10)));
});
