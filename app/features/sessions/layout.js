// Rules for drawing sessions on a grid of hours (the Week and Day views), kept apart from the
// screen code so they can be tested on their own.

// Places overlapping blocks side by side. Each block is { top, bottom } (in any unit, such as
// minutes); each gets a `lane` (0, 1, …) and `lanes`, how many lanes its group of clashing blocks
// needs. Returns the blocks, sorted by start.
export function layoutLanes(blocks) {
  blocks.sort((a, b) => a.top - b.top || b.bottom - a.bottom);
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds = [];
    for (const b of cluster) {
      let lane = laneEnds.findIndex((end) => end <= b.top);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = b.bottom;
      b.lane = lane;
    }
    for (const b of cluster) b.lanes = laneEnds.length;
    cluster = [];
  };
  for (const b of blocks) {
    if (cluster.length && b.top >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.bottom);
  }
  if (cluster.length) flush();
  return blocks;
}

// Minutes from the start of `day` to `t`, kept within that day (0–1440).
export function minutesInto(t, day) {
  const from = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const to = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  if (t >= to) return 1440;
  if (t <= from) return 0;
  return t.getHours() * 60 + t.getMinutes();
}

// The hours a grid needs to show: at least `from`–`to` (e.g. 9–17), widened to fit every timed
// session. `sessions` is a list of { start, end, allDay } on `days`.
export function hourRange(days, { from = 9, to = 17 } = {}) {
  let start = from;
  let end = to;
  for (const { day, items } of days) {
    for (const s of items) {
      if (s.allDay) continue;
      start = Math.min(start, Math.floor(minutesInto(s.start, day) / 60));
      end = Math.max(end, Math.ceil(minutesInto(s.end, day) / 60));
    }
  }
  return { start, end };
}

// The weeks of the month that `date` is in, Monday first: a list of weeks, each 7 dates. The first
// and last weeks include days from the months either side.
export function monthGrid(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - ((first.getDay() + 6) % 7));
  const weeks = [];
  for (let d = start; d.getMonth() === first.getMonth() || d < first; ) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(d);
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// The academic year `date` is in, September to August: { start, months (12 first-of-month
// dates), label ("2026–27") }.
export function academicYear(date) {
  const year = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, 8 + i, 1));
  return { start: months[0], months, label: `${year}–${String(year + 1).slice(-2)}` };
}

// The same day of the month, `n` months on, kept within the shorter months (31 Jan + 1 → 28 Feb).
export function addMonths(date, n) {
  const last = new Date(date.getFullYear(), date.getMonth() + n + 1, 0).getDate();
  return new Date(date.getFullYear(), date.getMonth() + n, Math.min(date.getDate(), last));
}
