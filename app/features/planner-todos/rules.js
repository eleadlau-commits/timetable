// Which to-dos go on which day of the Planner, without any screen code, so it's easy to test.
//
// A to-do (from the todo feature): { id, text, tag, due: 'YYYY-MM-DD' or null, done,
// doneOn: the day it was ticked ('YYYY-MM-DD', missing on older to-dos), added }.
// Days are 'YYYY-MM-DD' in the phone's own time zone, the same way the to-do list keeps them.

const pad = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DD' for a Date, in the phone's time zone.
export function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const byAdded = (a, b) => (a.added || 0) - (b.added || 0);

// What the day's To do card lists, in order:
//   - on today: the overdue ones first (not ticked, due on an earlier day), oldest first
//   - the to-dos due that day that aren't ticked
//   - then the ones due that day that are ticked, so you can see what you've done, and on today
//     also earlier ones ticked off today (so one doesn't vanish the moment you tick it)
// Each comes back as { item, overdue }.
export function forDay(items, day, today) {
  const overdue = day === today
    ? items.filter((x) => !x.done && x.due && x.due < today)
      .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : byAdded(a, b)))
    : [];
  const due = items.filter((x) => x.due === day).sort(byAdded);
  const lateDoneToday = day === today
    ? items.filter((x) => x.done && x.due && x.due < today && x.doneOn === today).sort(byAdded)
    : [];
  return [
    ...overdue.map((item) => ({ item, overdue: true })),
    ...due.filter((x) => !x.done).map((item) => ({ item, overdue: day < today })),
    ...lateDoneToday.map((item) => ({ item, overdue: false })),
    ...due.filter((x) => x.done).map((item) => ({ item, overdue: false })),
  ];
}

// The mark on a day in the week strip or the month: null when nothing's left to do that day,
// otherwise { late, count }: how many to-dos due that day aren't ticked, and late when the day
// has gone by (so they're overdue).
export function markFor(items, day, today) {
  const count = items.filter((x) => !x.done && x.due === day).length;
  if (!count) return null;
  return { late: day < today, count };
}

// The words a screen reader adds to the day's name: "1 to-do", "2 to-dos overdue".
export function markLabel(mark) {
  if (!mark) return null;
  return `${mark.count} to-do${mark.count === 1 ? '' : 's'}${mark.late ? ' overdue' : ''}`;
}

// When an overdue to-do was due, in a few words: "Yesterday", or a short date like "Mon 2 Nov".
export function lateLabel(due, today) {
  const [y, m, d] = due.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const days = Math.round((new Date(ty, tm - 1, td) - new Date(y, m - 1, d)) / 86400000);
  if (days === 1) return 'Yesterday';
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: y === ty ? undefined : 'numeric' });
}
