import { test, assert } from 'folio/testing';
import { time } from 'folio';
import { fadeStep, stripDay, stripPage, upNext, dayPlan, cardLabel, whenText } from '../lectures.js';

// Thursday 15 October 2026.
const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute);
const session = (title, day, from, to, extra = {}) => ({ title, start: at(day, from), end: at(day, to), allDay: false, cancelled: false, ...extra });

const lecture = session('Linear Algebra II', 15, 16, 17);
const tutorial = session('Probability Tutorial', 15, 17, 18);
const workshop = session('Statistics Workshop', 15, 18, 19);
const society = session('Coding Society', 15, 19, 20);
const thursday = [lecture, tutorial, workshop, society];

test('the next class is the first one still to come', () => {
  assert.deepEqual(upNext(thursday, at(15, 15, 13)), { session: lecture, live: false });
});

test('a class that has started is shown as on now', () => {
  assert.deepEqual(upNext(thursday, at(15, 16, 30)), { session: lecture, live: true });
});

test('cancelled and all-day entries are never the next class', () => {
  const cancelled = session('Cancelled lecture', 15, 14, 15, { cancelled: true });
  const allDay = session('Reading week', 15, 0, 23, { allDay: true });
  assert.deepEqual(upNext([allDay, cancelled, lecture], at(15, 13)), { session: lecture, live: false });
});

test('after the last class there is no next one that day', () => {
  assert.equal(upNext(thursday, at(15, 20, 30)), null);
});

test('later classes get fainter in three steps, then stay at the third', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(fadeStep), [1, 2, 3, 3, 3]);
});

test('the lecture card shows the next class, then the rest in order', () => {
  const plan = dayPlan(thursday, at(15, 0), at(15, 15, 13));
  assert.equal(plan.state, 'list');
  assert.equal(plan.main, lecture);
  assert.deepEqual(plan.rest, [tutorial, workshop, society]);
  assert.equal(cardLabel(plan, at(15, 0), at(15, 15, 13)), 'Up next · in 47 min');
});

test('classes that are over are left off today\'s card', () => {
  const plan = dayPlan(thursday, at(15, 0), at(15, 17, 30));
  assert.equal(plan.main, tutorial);
  assert.equal(plan.live, true);
  assert.deepEqual(plan.rest, [workshop, society]);
});

test('after the last class, today\'s card says the day is done', () => {
  assert.deepEqual(dayPlan(thursday, at(15, 0), at(15, 21)), { state: 'done' });
  assert.equal(cardLabel({ state: 'done' }, at(15, 0), at(15, 21)), 'Today');
});

test('a day with no classes says so', () => {
  assert.deepEqual(dayPlan([], at(16, 0), at(15, 12)), { state: 'none' });
  const allCancelled = [session('Gone', 15, 9, 10, { cancelled: true })];
  assert.deepEqual(dayPlan(allCancelled, at(15, 0), at(15, 8)), { state: 'none' });
});

test('another day shows all its classes, even early in the morning', () => {
  const friday = [session('Morning lecture', 16, 9, 10), session('Lab', 16, 11, 13)];
  const plan = dayPlan(friday, at(16, 0), at(15, 22));
  assert.equal(plan.main, friday[0]);
  assert.equal(plan.live, false);
  assert.ok(!cardLabel(plan, at(16, 0), at(15, 22)).startsWith('Up next'));
});

test('the date strip starts with today and skips weekends', () => {
  const days = stripPage(at(15, 10), 0).map((d) => d.getDate());
  assert.deepEqual(days, [15, 16, 19]); // Thu, Fri, then Monday
  assert.deepEqual(stripPage(at(15, 10), 1).map((d) => d.getDate()), [20, 21, 22]);
  assert.deepEqual(stripPage(at(15, 10), -1).map((d) => d.getDate()), [12, 13, 14]);
});

test('on a weekend, today still comes first, then Monday', () => {
  const saturday = at(17, 10);
  assert.deepEqual(stripPage(saturday, 0).map((d) => d.getDate()), [17, 19, 20]);
  assert.equal(stripDay(saturday, -1).getDate(), 16); // back to Friday
});

test('the next class line says when, in plain words', () => {
  const now = at(15, 15, 13);
  assert.equal(whenText(at(15, 16), now), time.formatTime(at(15, 16))); // today: just the time
  assert.ok(whenText(at(16, 9), now).startsWith('Tomorrow'));
  assert.ok(whenText(at(19, 9), now).startsWith('Monday'));
});
