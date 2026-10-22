// The study timer's rules, without the screen: patterns of study and rest blocks, where a
// running timer is (worked out from the clock, never by counting ticks), and the totals for
// each day, week and module. Times are in milliseconds; block lengths are in minutes.

export const MINUTE = 60000;
export const STEP = 5;   // block lengths change in 5-minute steps when dragged
export const MAX = 240;  // the longest block, in minutes

export const PRESETS = [
  { id: 'simple-hour', name: 'Simple hour', blocks: [{ kind: 'study', min: 60 }], repeat: 1 },
  { id: 'pomodoro', name: 'Pomodoro', blocks: [{ kind: 'study', min: 25 }, { kind: 'rest', min: 5 }], repeat: 4 },
  { id: 'long-focus', name: 'Long focus', blocks: [{ kind: 'study', min: 50 }, { kind: 'rest', min: 10 }], repeat: 1 },
];

// A length typed or dragged, kept between 1 and MAX minutes.
export function clampMinutes(min) {
  const n = Math.round(Number(min));
  return Number.isFinite(n) ? Math.min(MAX, Math.max(1, n)) : null;
}

// A dragged length, snapped to 5-minute steps (at least 5).
export function snapMinutes(min) {
  return Math.min(MAX, Math.max(STEP, Math.round(min / STEP) * STEP));
}

// Every block in the order it runs, with the repeats written out.
export function expand(pattern) {
  const out = [];
  const times = Math.max(1, pattern.repeat || 1);
  for (let i = 0; i < times; i += 1) for (const b of pattern.blocks) out.push({ kind: b.kind, min: b.min });
  return out;
}

export const totalMinutes = (pattern) => expand(pattern).reduce((n, b) => n + b.min, 0);
export const studyMinutes = (pattern) => expand(pattern).filter((b) => b.kind === 'study').reduce((n, b) => n + b.min, 0);

// A new running timer. Pauses, resumes and skips are added to `events` as they happen.
export function newRun(pattern, module, now) {
  return { pattern: { blocks: pattern.blocks, repeat: pattern.repeat || 1 }, module: module || null, startedAt: now, events: [] };
}

// Where a running timer is at `now`. Walks from the start through each pause, resume and skip:
//   index, block   the block that's on (the last one once it's done)
//   left           time left in that block
//   elapsed, total how far along the whole session is
//   paused, done
//   endedAt        when the last block finished (if done)
//   stretches      [{ start, end }] the real times spent studying (not resting, paused or skipped)
export function position(run, now) {
  const blocks = expand(run.pattern);
  const edges = [0];
  for (const b of blocks) edges.push(edges[edges.length - 1] + b.min * MINUTE);
  const total = edges[edges.length - 1];
  const blockAt = (v) => {
    for (let i = 0; i < blocks.length; i += 1) if (edges[i + 1] > v) return i;
    return blocks.length - 1;
  };
  const stretches = [];
  let v = 0;
  let t = run.startedAt;
  let running = true;
  let endedAt = null;

  const advance = (to) => {
    if (running) {
      while (t < to && v < total) {
        const i = blockAt(v);
        const step = Math.min(to - t, edges[i + 1] - v);
        if (blocks[i].kind === 'study') {
          const last = stretches[stretches.length - 1];
          if (last && last.end === t) last.end = t + step;
          else stretches.push({ start: t, end: t + step });
        }
        v += step;
        t += step;
        if (v >= total && endedAt == null) endedAt = t;
      }
    }
    t = Math.max(t, to);
  };

  for (const e of [...run.events].sort((a, b) => a.at - b.at)) {
    if (e.at > now) break;
    advance(e.at);
    if (e.type === 'pause') running = false;
    else if (e.type === 'resume') running = true;
    else if (e.type === 'skip' && v < total) {
      v = edges[blockAt(v) + 1];
      if (v >= total && endedAt == null) endedAt = e.at;
    }
  }
  advance(now);

  const done = v >= total;
  const index = blockAt(v);
  return {
    index,
    block: blocks[index],
    blocks,
    left: done ? 0 : edges[index + 1] - v,
    elapsed: v,
    total,
    paused: !running && !done,
    done,
    endedAt,
    stretches,
  };
}

// The block changes still to come, for notifications: [{ at, title, body }]. None while paused.
export function upcomingChanges(run, now) {
  const p = position(run, now);
  if (p.done || p.paused) return [];
  const out = [];
  let at = now + p.left;
  for (let i = p.index + 1; i <= p.blocks.length; i += 1) {
    const next = p.blocks[i];
    if (!next) out.push({ at, title: 'Session done', body: 'Well done. Your study time is saved.' });
    else if (next.kind === p.blocks[i - 1].kind) { at += next.min * MINUTE; continue; }
    else if (next.kind === 'rest') out.push({ at, title: 'Time for a break', body: `${formatMinutes(next.min)} rest` });
    else out.push({ at, title: 'Back to studying', body: `${formatMinutes(next.min)} study` });
    if (next) at += next.min * MINUTE;
  }
  return out;
}

// History entries for a finished or stopped run: [{ start, end, module, session }].
export function historyEntries(run, now) {
  return position(run, now).stretches
    .filter((s) => s.end - s.start >= 1000)
    .map((s) => ({ start: s.start, end: s.end, module: run.module, session: run.startedAt }));
}

// ---- Days and weeks (in the phone's own time; the week starts on Monday) ----

export function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ms, days) {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function startOfWeek(ms) {
  const day = startOfDay(ms);
  return addDays(day, -((new Date(day).getDay() + 6) % 7));
}

// The time an entry spent inside [from, to). An entry that crosses midnight counts on both days.
export function overlap(entry, from, to) {
  return Math.max(0, Math.min(entry.end, to) - Math.max(entry.start, from));
}

export function studiedBetween(history, from, to) {
  return history.reduce((n, e) => n + overlap(e, from, to), 0);
}

export const studiedToday = (history, now) => studiedBetween(history, startOfDay(now), addDays(startOfDay(now), 1));

// This week, Monday to Sunday: each day's time split by module, the total, last week's total,
// the number of study sessions and the time per module (most first). Module null = none chosen.
export function weekStats(history, now) {
  const from = startOfWeek(now);
  const to = addDays(from, 7);
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const start = addDays(from, i);
    const end = addDays(from, i + 1);
    const byModule = {};
    let total = 0;
    for (const e of history) {
      const ms = overlap(e, start, end);
      if (!ms) continue;
      const key = e.module ?? '';
      byModule[key] = (byModule[key] || 0) + ms;
      total += ms;
    }
    days.push({ start, total, byModule });
  }
  const modules = {};
  for (const d of days) for (const [k, ms] of Object.entries(d.byModule)) modules[k] = (modules[k] || 0) + ms;
  const sessions = new Set(history.filter((e) => overlap(e, from, to) > 0).map((e) => e.session ?? e.start));
  return {
    from,
    days,
    total: days.reduce((n, d) => n + d.total, 0),
    lastWeek: studiedBetween(history, addDays(from, -7), from),
    sessions: sessions.size,
    modules: Object.entries(modules).sort((a, b) => b[1] - a[1]).map(([module, ms]) => ({ module: module || null, ms })),
  };
}

// ---- Words ----

// 90 → "1 h 30 min", 25 → "25 min", 120 → "2 h".
export function formatMinutes(min) {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export const formatStudied = (ms) => formatMinutes(Math.floor(ms / MINUTE));

// A countdown: "24:59", or "1:02:03" for an hour or more. Rounds up, so it shows 0:00 only at the end.
export function formatClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// "+1 h 10 min on last week", "20 min less than last week", "Same as last week".
export function differenceText(now, before) {
  const diff = Math.floor(now / MINUTE) - Math.floor(before / MINUTE);
  if (!diff) return 'Same as last week';
  return diff > 0 ? `${formatMinutes(diff)} more than last week` : `${formatMinutes(-diff)} less than last week`;
}
