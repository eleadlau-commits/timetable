// Rules for Home's "Next" line, date strip and lecture card. No screen code here, so they can be
// tested on their own. Sessions are { start, end, allDay, cancelled, … } (see the timetable feature).

import { time } from 'folio';

// How many fainter steps later lectures go through. After the third they stay at the third.
export const FADE_STEPS = 3;

// The fade step (1, 2 or 3) of the i-th lecture after the main one (i from 0).
export const fadeStep = (i) => Math.min(i + 1, FADE_STEPS);

export const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

// The day at position `index` in the date strip: 0 is today (even at the weekend), 1 the next
// weekday after today, -1 the weekday before today, and so on. Weekends are skipped.
export function stripDay(today, index) {
  let d = time.startOfDay(today);
  const step = index < 0 ? -1 : 1;
  for (let n = Math.abs(index); n > 0; n--) {
    do d = time.addDays(d, step);
    while (isWeekend(d));
  }
  return d;
}

// The days on page `page` of the strip, `size` at a time. Page 0 starts with today.
export function stripPage(today, page, size = 3) {
  return Array.from({ length: size }, (_, i) => stripDay(today, page * size + i));
}

// Can this session be "the next class"? Not cancelled and not an all-day entry.
const countable = (s) => !s.cancelled && !s.allDay;

// The class on now, or else the next one to start, from a list in time order.
// → { session, live } or null.
export function upNext(sessions, now) {
  const s = sessions.find((x) => countable(x) && x.end > now);
  return s ? { session: s, live: s.start <= now } : null;
}

// What the lecture card shows for one day (`sessions` are that day's, in time order):
//   { state: 'none' }                 nothing on that day
//   { state: 'done' }                 today, and the last class is over
//   { state: 'list', main, live, rest }   the main class in full, then the rest of the day
// On today, classes that are over are left out. The main class is the first one that isn't
// cancelled or all-day; the others are the rest, in time order.
export function dayPlan(sessions, day, now) {
  if (!sessions.length) return { state: 'none' };
  const today = time.sameDay(day, now);
  const left = today ? sessions.filter((s) => s.end > now) : sessions;
  const main = left.find(countable);
  if (!main) return { state: today && sessions.some(countable) ? 'done' : 'none' };
  return { state: 'list', main, live: today && main.start <= now, rest: left.filter((s) => s !== main) };
}

// The small heading of the lecture card: "Up next · in 47 min", "Now · until 17:00",
// "Friday 16 October".
export function cardLabel(plan, day, now) {
  if (plan.state === 'list' && plan.live) return `Now · until ${time.formatTime(plan.main.end)}`;
  if (plan.state === 'list' && time.sameDay(day, now)) return `Up next · ${time.inTime(plan.main.start - now)}`;
  if (time.sameDay(day, now)) return 'Today';
  return time.formatLongDate(day);
}

// When the next class is, for the line under the clock: "16:00", "Tomorrow 09:00", "Mon 19 Oct 09:00".
export function whenText(start, now) {
  const days = Math.round((time.startOfDay(start) - time.startOfDay(now)) / time.DAY);
  if (days === 0) return time.formatTime(start);
  if (days === 1) return `Tomorrow ${time.formatTime(start)}`;
  if (days > 1 && days < 7) return `${start.toLocaleDateString([], { weekday: 'long' })} ${time.formatTime(start)}`;
  return `${start.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} ${time.formatTime(start)}`;
}
