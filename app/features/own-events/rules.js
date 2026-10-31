// Your own events, without the screen: checking the form, and turning each saved event into the
// sessions the Planner draws (one for each week, for repeating ones).
//
// A saved event: { id, title, date: 'YYYY-MM-DD', start: 'HH:MM', end: 'HH:MM', place,
//                  weekly: true/false, until: 'YYYY-MM-DD' or '', skip: ['YYYY-MM-DD', …] }

export const DAY = 86400000;
export const HUE = 270; // one colour for all your events: the app's purple

const pad = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DD' for a date, in the phone's time zone.
export function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A Date at midnight from 'YYYY-MM-DD', or null if it isn't one.
export function parseDate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

// Minutes after midnight from 'HH:MM', or null.
export function parseTime(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text || '');
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return +m[1] * 60 + +m[2];
}

// What's wrong with the form, in words, or null if it can be saved.
export function problem(e) {
  if (!(e.title || '').trim()) return 'Give it a name first.';
  if (!parseDate(e.date)) return 'Choose a day.';
  const start = parseTime(e.start);
  const end = parseTime(e.end);
  if (start == null || end == null) return 'Choose a start and an end time.';
  if (end <= start) return 'It needs to end after it starts.';
  if (e.weekly && e.until && parseDate(e.until) && parseDate(e.until) < parseDate(e.date)) {
    return 'The last week can\'t be before the first.';
  }
  return null;
}

// A tidy copy of the form, ready to save.
export function clean(e, id) {
  return {
    id,
    title: e.title.trim().slice(0, 80),
    date: e.date,
    start: e.start,
    end: e.end,
    place: (e.place || '').trim().slice(0, 80),
    weekly: !!e.weekly,
    until: e.weekly && parseDate(e.until) ? e.until : '',
    skip: e.skip || [],
  };
}

// The days an event happens on between `from` and `to` (Dates), as Dates at midnight.
export function days(e, from, to) {
  const first = parseDate(e.date);
  if (!first) return [];
  const skip = new Set(e.skip || []);
  if (!e.weekly) return first >= startOf(from) && first < to && !skip.has(e.date) ? [first] : [];
  const last = parseDate(e.until);
  const out = [];
  // Start at the first week on or after `from`, counting whole weeks from the first day.
  const weeks = Math.max(0, Math.floor((startOf(from) - first) / (7 * DAY)) - 1);
  for (let d = addDays(first, weeks * 7); d < to && (!last || d <= last); d = addDays(d, 7)) {
    if (d >= startOf(from) && !skip.has(dateKey(d))) out.push(d);
  }
  return out;
}

// The sessions for every saved event between `from` and `to`, shaped like the timetable's
// sessions, plus own: true, outline: true, ownId and day ('YYYY-MM-DD', for "just this one").
export function sessionsFor(events, from, to) {
  const out = [];
  for (const e of events) {
    const start = parseTime(e.start);
    const end = parseTime(e.end);
    if (start == null || end == null) continue;
    for (const d of days(e, from, to)) {
      const day = dateKey(d);
      out.push({
        key: `own:${e.id}@${day}`,
        title: e.title,
        location: e.place || '',
        description: '',
        start: atMinutes(d, start),
        end: atMinutes(d, end),
        allDay: false,
        cancelled: false,
        module: `own:${e.id}`,
        hue: HUE,
        own: true,
        outline: true,
        ownId: e.id,
        day,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// "Every Tuesday" or "Every Tuesday until 12 Dec", or '' for a one-off.
export function repeatText(e) {
  if (!e.weekly) return '';
  const first = parseDate(e.date);
  const weekday = first.toLocaleDateString([], { weekday: 'long' });
  const last = parseDate(e.until);
  return last ? `Every ${weekday} until ${last.toLocaleDateString([], { day: 'numeric', month: 'short' })}` : `Every ${weekday}`;
}

function startOf(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function atMinutes(d, minutes) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minutes / 60), minutes % 60);
}
