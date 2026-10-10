// Minimal iCalendar (.ics) parser and recurrence expander.
// Handles what university timetable exports produce: folded lines, TZID/UTC/floating
// times, all-day events, DAILY/WEEKLY/MONTHLY/YEARLY RRULEs, EXDATE, RECURRENCE-ID
// overrides and cancelled sessions.

const DAY = 86400000;
const WEEKDAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// Exchange/Outlook exports sometimes use Windows zone names instead of IANA ones.
const WINDOWS_ZONES = {
  'GMT Standard Time': 'Europe/London',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'GTB Standard Time': 'Europe/Bucharest',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'India Standard Time': 'Asia/Kolkata',
  'China Standard Time': 'Asia/Shanghai',
  'Singapore Standard Time': 'Asia/Singapore',
  'Tokyo Standard Time': 'Asia/Tokyo',
};

export function parseICS(text) {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  const stack = [];
  let name = '';
  let cur = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const p = parseLine(line);
    if (!p) continue;

    if (p.name === 'BEGIN') {
      const comp = p.value.trim().toUpperCase();
      stack.push(comp);
      if (comp === 'VEVENT') cur = { exdates: [] };
      continue;
    }
    if (p.name === 'END') {
      const comp = stack.pop();
      if (comp === 'VEVENT' && cur) { events.push(cur); cur = null; }
      continue;
    }
    if (p.name === 'X-WR-CALNAME' && stack.at(-1) === 'VCALENDAR') { name = unescapeText(p.value); continue; }
    // Ignore properties of nested components such as VALARM.
    if (!cur || stack.at(-1) !== 'VEVENT') continue;

    try {
      switch (p.name) {
        case 'UID': cur.uid = p.value.trim(); break;
        case 'SUMMARY': cur.title = unescapeText(p.value).trim(); break;
        case 'LOCATION': cur.location = unescapeText(p.value).trim(); break;
        case 'DESCRIPTION': cur.description = unescapeText(p.value).trim(); break;
        case 'STATUS': cur.status = p.value.trim().toUpperCase(); break;
        case 'DTSTART': cur.start = parseDate(p.value, p.params); break;
        case 'DTEND': cur.end = parseDate(p.value, p.params); break;
        case 'DURATION': cur.duration = parseDuration(p.value.trim()); break;
        case 'RRULE': cur.rrule = parseRRule(p.value); break;
        case 'EXDATE':
          for (const v of p.value.split(',')) {
            const d = parseDate(v, p.params);
            if (d) cur.exdates.push(d.date.getTime());
          }
          break;
        case 'RECURRENCE-ID': {
          const d = parseDate(p.value, p.params);
          if (d) cur.recurrenceId = d.date.getTime();
          break;
        }
      }
    } catch {
      // A single malformed property shouldn't sink the whole calendar.
    }
  }
  return { name, events };
}

export function expandEvents(raw, from, to) {
  const overridden = new Set(
    raw.filter((e) => e.uid && e.recurrenceId != null).map((e) => `${e.uid}|${e.recurrenceId}`)
  );
  const out = [];

  for (const ev of raw) {
    if (!ev.start) continue;
    const dur = ev.end
      ? Math.max(0, ev.end.date - ev.start.date)
      : ev.duration ?? (ev.start.allDay ? DAY : 0);
    const push = (start) => {
      const end = new Date(start.getTime() + dur);
      if (end >= from && start <= to) out.push(instance(ev, start, end));
    };

    if (!ev.rrule || ev.recurrenceId != null) { push(ev.start.date); continue; }

    const r = ev.rrule;
    const until = r.UNTIL ? parseDate(r.UNTIL, {})?.date : null;
    const excluded = new Set(ev.exdates);
    let count = 0;
    let guard = 0;
    for (const wall of occurrences(ev.start.wall, r)) {
      if (++guard > 5000) break;
      const start = toDate(wall, ev.start.tz, ev.start.allDay);
      if (until && start > until) break;
      if (r.COUNT && count >= r.COUNT) break;
      count++;
      if (start > to) break;
      const t = start.getTime();
      if (excluded.has(t) || overridden.has(`${ev.uid}|${t}`)) continue;
      push(start);
    }
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

function instance(ev, start, end) {
  return {
    key: `${ev.uid || ev.title}@${start.getTime()}`,
    title: ev.title || '(untitled)',
    location: ev.location || '',
    description: ev.description || '',
    start,
    end,
    allDay: ev.start.allDay,
    cancelled: ev.status === 'CANCELLED',
  };
}

// Yields wall-clock dates ({y, m, d, h, mi, s}) for each candidate occurrence.
function* occurrences(w0, r) {
  const interval = Math.max(1, r.INTERVAL || 1);
  if (r.FREQ === 'DAILY') {
    for (let i = 0; ; i += interval) yield shiftDays(w0, i);
  } else if (r.FREQ === 'WEEKLY') {
    const wkst = WEEKDAYS[r.WKST] ?? 1;
    const firstOffset = (weekday(w0) - wkst + 7) % 7;
    const weekStart = shiftDays(w0, -firstOffset);
    const days = r.BYDAY
      ? r.BYDAY.split(',').map((s) => WEEKDAYS[s.trim().slice(-2)]).filter((d) => d != null)
      : [weekday(w0)];
    const offsets = [...new Set(days.map((d) => (d - wkst + 7) % 7))].sort((a, b) => a - b);
    for (let k = 0; ; k += interval) {
      for (const o of offsets) {
        if (k === 0 && o < firstOffset) continue;
        yield shiftDays(weekStart, k * 7 + o);
      }
    }
  } else if (r.FREQ === 'MONTHLY' && !r.BYDAY) {
    for (let i = 0; ; i += interval) {
      const t = new Date(Date.UTC(w0.y, w0.m - 1 + i, 1));
      const w = { ...w0, y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 };
      if (new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCMonth() !== w.m - 1) continue; // e.g. 31st in a short month
      yield w;
    }
  } else if (r.FREQ === 'YEARLY') {
    for (let i = 0; ; i += interval) yield { ...w0, y: w0.y + i };
  } else {
    yield w0;
  }
}

function shiftDays(w, days) {
  const t = new Date(Date.UTC(w.y, w.m - 1, w.d) + days * DAY);
  return { ...w, y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function weekday(w) {
  return new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay();
}

function parseLine(line) {
  let inQuotes = false;
  let i = 0;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ':' && !inQuotes) break;
  }
  if (i >= line.length) return null;
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const parts = head.match(/(?:[^;"]|"[^"]*")+/g) || [head];
  const name = parts[0].trim().toUpperCase().replace(/^.*\./, ''); // drop "group." prefixes
  const params = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=');
    if (eq > 0) params[part.slice(0, eq).trim().toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name, params, value };
}

function unescapeText(v) {
  return v.replace(/\\([nN;,\\])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));
}

function parseRRule(v) {
  const r = {};
  for (const kv of v.trim().split(';')) {
    const [k, val] = kv.split('=');
    if (k && val) r[k.trim().toUpperCase()] = val.trim();
  }
  if (r.FREQ) r.FREQ = r.FREQ.toUpperCase();
  if (r.INTERVAL) r.INTERVAL = parseInt(r.INTERVAL, 10) || 1;
  if (r.COUNT) r.COUNT = parseInt(r.COUNT, 10) || 0;
  if (r.WKST) r.WKST = r.WKST.toUpperCase();
  if (r.BYDAY) r.BYDAY = r.BYDAY.toUpperCase();
  return r;
}

function parseDuration(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v);
  if (!m) return null;
  const ms = (+m[2] || 0) * 7 * DAY + (+m[3] || 0) * DAY + (+m[4] || 0) * 3600e3 + (+m[5] || 0) * 60e3 + (+m[6] || 0) * 1e3;
  return m[1] === '-' ? -ms : ms;
}

function parseDate(value, params) {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly || params.VALUE === 'DATE') {
    const m = dateOnly || /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!m) return null;
    const wall = { y: +m[1], m: +m[2], d: +m[3], h: 0, mi: 0, s: 0 };
    return { wall, tz: null, allDay: true, date: toDate(wall, null, true) };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i.exec(v);
  if (!m) return null;
  const wall = { y: +m[1], m: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +(m[6] || 0) };
  const tz = m[7] ? 'UTC' : normaliseZone(params.TZID);
  return { wall, tz, allDay: false, date: toDate(wall, tz, false) };
}

function normaliseZone(tzid) {
  if (!tzid) return null;
  const z = tzid.replace(/^\//, '').trim();
  return WINDOWS_ZONES[z] || z;
}

function toDate(w, tz, allDay) {
  if (allDay || !tz) return new Date(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  if (tz === 'UTC') return new Date(asUtc);
  try {
    // Find the instant whose wall-clock time in `tz` equals `w`, correcting once for DST.
    const off1 = zoneOffset(asUtc, tz);
    let t = asUtc - off1;
    const off2 = zoneOffset(t, tz);
    if (off2 !== off1) t = asUtc - off2;
    return new Date(t);
  } catch {
    // Unknown zone name: treat as the phone's local time.
    return new Date(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  }
}

const formatters = {};
function zoneOffset(t, tz) {
  const f = (formatters[tz] ||= new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }));
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - t;
}
