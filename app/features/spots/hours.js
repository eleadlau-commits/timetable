// Opening times, without any screen code, so they can be tested. Places can store them as one
// short line of text (the database's `open` field), Monday first, one part per day:
//
//   '0800-1700|0800-1700|0800-1700|0800-1700|0800-1700|0900-1700|'
//
// is 8am to 5pm Monday to Friday, 9am to 5pm on Saturday, and closed on Sunday (nothing between
// the bars). A closing time earlier than the opening time runs past midnight ('2200-0300').
// From it, Spots says "Open now · closes 5pm" and writes the short "Mon–Fri 8am–5pm" line.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// The same rule the database checks (firebase/firestore.rules).
const PATTERN = /^((\d{4}-\d{4})?\|){6}(\d{4}-\d{4})?$/;

function minutes(hhmm) {
  const h = Number(hhmm.slice(0, 2));
  const m = Number(hhmm.slice(2));
  if (m > 59 || h > 24 || (h === 24 && m > 0)) return null;
  return h * 60 + m;
}

// The stored line → seven days, Monday first, each null (closed) or { from, to } in minutes after
// midnight (to may be smaller than from: past midnight). null if it doesn't make sense.
export function readOpen(text) {
  if (typeof text !== 'string' || !PATTERN.test(text)) return null;
  const days = text.split('|').map((part) => {
    if (!part) return null;
    const from = minutes(part.slice(0, 4));
    const to = minutes(part.slice(5));
    if (from == null || to == null || from === to || from >= 24 * 60) return 'bad';
    return { from, to: to === 0 ? 24 * 60 : to };
  });
  if (days.includes('bad')) return null;
  return days;
}

const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}${String(mins % 60).padStart(2, '0')}`;

// Seven days (as readOpen gives them) → the stored line. '' if every day is closed.
export function writeOpen(days) {
  if (!Array.isArray(days) || days.length !== 7 || days.every((d) => !d)) return '';
  return days.map((d) => (d ? `${hhmm(d.from)}-${hhmm(d.to % (24 * 60))}` : '')).join('|');
}

// '08:30' (from a time box) → minutes, or null.
export function fromInput(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const mins = minutes(`${m[1].padStart(2, '0')}${m[2]}`);
  return mins == null || mins >= 24 * 60 ? null : mins;
}

// minutes → '08:30', for a time box.
export function toInput(mins) {
  if (!Number.isFinite(mins)) return '';
  const m = mins % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// minutes → '8am', '5:30pm', '12pm', 'midnight'.
export function clock(mins) {
  const m = mins % (24 * 60);
  if (m === 0) return 'midnight';
  const h = Math.floor(m / 60);
  const min = m % 60;
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${min ? `:${String(min).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

// Seven days → 'Mon–Fri 8am–5pm, Sat 9am–5pm' (days with the same times grouped; closed days
// left out). '' if closed every day.
export function summary(days) {
  if (!Array.isArray(days)) return '';
  const same = (a, b) => a && b && a.from === b.from && a.to === b.to;
  const parts = [];
  for (let i = 0; i < 7; i++) {
    if (!days[i]) continue;
    let j = i;
    while (j + 1 < 7 && same(days[j + 1], days[i])) j++;
    const label = j === i ? DAYS[i] : j === i + 1 ? `${DAYS[i]}, ${DAYS[j]}` : `${DAYS[i]}–${DAYS[j]}`;
    parts.push(`${label} ${clock(days[i].from)}–${clock(days[i].to)}`);
    i = j;
  }
  return parts.join(', ');
}

// Monday = 0.
const weekday = (date) => (date.getDay() + 6) % 7;

// Whether the place is open at `now`, and what to say: { open, text }, e.g.
// { open: true, text: 'Open now · closes 5pm' } or { open: false, text: 'Closed · opens Sat 9am' }.
export function openState(days, now = new Date()) {
  if (!Array.isArray(days) || days.every((d) => !d)) return null;
  const today = weekday(now);
  const mins = now.getHours() * 60 + now.getMinutes();
  // Still open from last night?
  const yesterday = days[(today + 6) % 7];
  if (yesterday && yesterday.to < yesterday.from && mins < yesterday.to) {
    return { open: true, text: `Open now · closes ${clock(yesterday.to)}` };
  }
  const t = days[today];
  if (t) {
    const overnight = t.to < t.from;
    if (mins >= t.from && (overnight || mins < t.to)) return { open: true, text: `Open now · closes ${clock(t.to)}` };
    if (mins < t.from) return { open: false, text: `Closed · opens ${clock(t.from)}` };
  }
  for (let ahead = 1; ahead <= 7; ahead++) {
    const d = days[(today + ahead) % 7];
    if (d) return { open: false, text: `Closed · opens ${ahead === 1 ? 'tomorrow' : DAYS[(today + ahead) % 7]} ${clock(d.from)}` };
  }
  return null;
}
