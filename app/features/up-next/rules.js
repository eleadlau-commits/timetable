// Rules for Up next that don't need the screen, so they can be tested on their own.
// A session here is { start, end, cancelled } (Date objects), as the timetable gives them.

export const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

// For today's lecture card: the session shown in full (`lead`) and the ones after it (`rest`).
// The lead is the class on now or the next one; classes already over are left out. `over` is
// true when today's classes are all done.
export function dayPlan(sessions, now) {
  const live = sessions.filter((s) => !s.cancelled);
  const lead = live.find((s) => s.end > now) || null;
  if (!lead) return { lead: null, rest: [], over: live.length > 0 };
  return { lead, rest: sessions.filter((s) => s !== lead && s.start >= lead.start && s.end > now), over: false };
}

// How faint a later session is: 1, 2, then 3 for all after that.
export const fadeStep = (index) => Math.min(index + 1, 3);

// Whether a session is on now.
export const isOn = (s, now) => s.start <= now && now < s.end;
