// Week view: the week as a grid of hours, with sessions that clash shown side by side.
// Saturday and Sunday only appear when something is on. Tapping a day opens it in the
// Day view, if that's installed.

import { Feature, ui, time } from 'folio';

const { el } = ui;
const HOUR_PX = 52; // keep in sync with the hour lines in week-view.css

// Places overlapping blocks side by side: each gets a lane and the number of lanes.
function layoutLanes(blocks) {
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

export default class WeekView extends Feature {
  start() {
    this.sessions = this.use('sessions');
    this.add('views', {
      id: 'week',
      label: 'Week',
      order: 20,
      mount: (container) => this.mount(container),
      render: () => this.render(),
      step: (direction) => this.move(direction * 7),
    });
  }

  move(days) {
    this.sessions.select(time.addDays(this.sessions.selected, days));
  }

  mount(container) {
    this.label = el('h2');
    this.thisWeek = el('button', { type: 'button', class: 'link-btn', onclick: () => this.sessions.select(new Date()) }, 'This week');
    this.grid = el('div');
    container.append(
      el('div', { class: 'weekhead' },
        el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Previous week', onclick: () => this.move(-7) }, ui.icon('left')),
        this.label,
        this.thisWeek,
        el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Next week', onclick: () => this.move(7) }, ui.icon('right'))),
      this.grid);
  }

  render() {
    const sessions = this.sessions;
    const now = new Date();
    const today = time.startOfDay(now);
    const week = time.startOfWeek(sessions.selected);
    this.label.textContent = `${time.formatDate(week, 'short')} – ${time.formatDate(time.addDays(week, 6), 'short')}`;
    this.thisWeek.hidden = time.sameDay(week, time.startOfWeek(today));

    // Weekdays always; Saturday and Sunday only when something's on.
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = time.addDays(week, i);
      const items = sessions.onDay(day);
      if (i < 5 || items.length) days.push({ day, items });
    }

    // Minutes from the start of `day`, clamped to that day.
    const mins = (t, day) => (t >= time.addDays(day, 1) ? 1440 : t <= day ? 0 : t.getHours() * 60 + t.getMinutes());

    let startH = 9;
    let endH = 17;
    let anyTimed = false;
    for (const { day, items } of days) {
      for (const s of items) {
        if (s.allDay) continue;
        anyTimed = true;
        startH = Math.min(startH, Math.floor(mins(s.start, day) / 60));
        endH = Math.max(endH, Math.ceil(mins(s.end, day) / 60));
      }
    }
    const hours = endH - startH;
    const px = (m) => ((m - startH * 60) / 60) * HOUR_PX;

    const head = el('div', { class: 'wk-row wk-head' }, el('span'), days.map(({ day }) =>
      el('button', {
        type: 'button',
        class: `wk-day${time.sameDay(day, today) ? ' today' : ''}`,
        'aria-label': `Open ${time.formatLongDate(day)}`,
        onclick: () => {
          sessions.select(day);
          this.app.shell.selectView('day');
        },
      }, el('span', {}, day.toLocaleDateString([], { weekday: 'short' })), el('b', {}, day.getDate()))));

    const anyAllDay = days.some(({ items }) => items.some((s) => s.allDay));
    const allDayRow = anyAllDay && el('div', { class: 'wk-row wk-allday' },
      el('span', { class: 'wk-gutter' }, 'all day'),
      days.map(({ items }) => el('div', { class: 'wk-cell' }, items.filter((s) => s.allDay).map((s) =>
        el('button', { type: 'button', class: 'wk-chip', style: `--h:${sessions.hue(s)}`, onclick: () => sessions.open(s) },
          sessions.shortName(s))))));

    const hourLabels = el('div', { class: 'wk-hours' }, Array.from({ length: hours }, (_, i) =>
      el('span', { style: `top:${i * HOUR_PX}px` }, new Date(2000, 0, 1, startH + i).toLocaleTimeString([], { hour: 'numeric' }))));

    const columns = days.map(({ day, items }) => {
      const blocks = layoutLanes(items.filter((s) => !s.allDay).map((s) => {
        const top = mins(s.start, day);
        return { s, top, bottom: Math.max(mins(s.end, day), top + 20) };
      }));
      const column = el('div', { class: `wk-col${time.sameDay(day, today) ? ' today' : ''}` }, blocks.map(({ s, top, bottom, lane, lanes }) => {
        const kind = sessions.kind(s);
        return el('button', {
          type: 'button',
          class: `blk${s.cancelled ? ' cancelled' : ''}${s.end <= now ? ' past' : ''}`,
          style: `--h:${sessions.hue(s)};--lane:${lane};--lanes:${lanes};top:${px(top)}px;height:${Math.max(18, px(bottom) - px(top) - 2)}px`,
          'aria-label': `${sessions.name(s)}, ${time.formatTime(s.start)}–${time.formatTime(s.end)}${s.location ? `, ${s.location}` : ''}`,
          onclick: () => sessions.open(s),
        }, el('b', {}, sessions.shortName(s)), kind && el('small', {}, kind), s.location && el('small', {}, s.location));
      }));
      if (time.sameDay(day, today)) {
        const m = now.getHours() * 60 + now.getMinutes();
        if (m >= startH * 60 && m <= endH * 60) column.append(el('div', { class: 'now-line', style: `top:${px(m)}px` }));
      }
      return column;
    });

    const body = el('div', { class: 'wk-row wk-body', style: `height:${hours * HOUR_PX}px` }, hourLabels, columns);
    const grid = el('div', { class: 'wk', style: `--cols:${days.length}` }, head, allDayRow, body);
    const empty = !anyTimed && !anyAllDay && el('div', { class: 'empty' }, el('b', {}, 'Nothing scheduled this week'));
    this.grid.replaceChildren(...[empty, grid].filter(Boolean));
  }
}
