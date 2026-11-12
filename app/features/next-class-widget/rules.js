// Rules for the next-class widget that don't need the screen, so they can be tested on their own.
// A session here is { start, end, cancelled, allDay } (Date objects), as the timetable gives them,
// plus the name and place the app would show for it.

export const KEY = 'mobile-durham.next-classes'; // where the phone keeps it for the widget (never rename)
export const DAYS = 14;    // how far ahead the widget gets classes
export const MOST = 120;   // at most this many classes, so it stays small

// What the widget is given: whether there's a timetable at all, and the classes still to come
// in time order, each as { s: start, e: end (milliseconds), n: name, w: where }. Classes that
// are over, cancelled or all day are left out, since the widget shows a time for each.
export function widgetData({ hasTimetable, sessions, now }) {
  const classes = sessions
    .filter((s) => !s.cancelled && !s.allDay && s.end > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, MOST)
    .map((s) => ({ s: +s.start, e: +s.end, n: s.name || 'Class', w: s.where || '' }));
  return { v: 1, made: +now, has: !!hasTimetable, classes };
}
