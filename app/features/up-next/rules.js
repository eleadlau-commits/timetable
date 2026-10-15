// Rules for Up next that don't need the screen, so they can be tested on their own.
// A session here is { start, end, cancelled } (Date objects), as the timetable gives them.

const DAY_MS = 86400000;

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

// The days in the date strip: today first (even at the weekend), then the weekdays after it,
// `size` at a time. Page 0 starts with today; page 1 is the next `size` weekdays, and so on.
export function stripDays(today, page = 0, size = 3) {
  const days = [startOfDay(today)];
  let d = startOfDay(today);
  while (days.length < (page + 1) * size) {
    d = addDays(d, 1);
    if (!isWeekend(d)) days.push(d);
  }
  return days.slice(page * size, (page + 1) * size);
}

// For the lecture card: the session shown in full (`lead`) and the ones after it (`rest`).
// On today, the lead is the class on now or the next one, and classes already over are left out.
// On other days, the lead is the first class. `over` is true when today's classes are all done.
export function dayPlan(sessions, now, isToday) {
  const live = sessions.filter((s) => !s.cancelled);
  if (!isToday) {
    const lead = live[0] || null;
    return { lead, rest: lead ? sessions.filter((s) => s !== lead && s.start >= lead.start) : [], over: false };
  }
  const lead = live.find((s) => s.end > now) || null;
  if (!lead) return { lead: null, rest: [], over: live.length > 0 };
  return { lead, rest: sessions.filter((s) => s !== lead && s.start >= lead.start && s.end > now), over: false };
}

// How faint a later session is: 1, 2, then 3 for all after that.
export const fadeStep = (index) => Math.min(index + 1, 3);

// The next class that hasn't started yet, within `days` days, or null.
export function nextSession(sessions, now, days = 7) {
  const until = new Date(now.getTime() + days * DAY_MS);
  return sessions
    .filter((s) => !s.cancelled && s.start > now && s.start < until)
    .sort((a, b) => a.start - b.start)[0] || null;
}

// Whether a session is on now.
export const isOn = (s, now) => s.start <= now && now < s.end;
