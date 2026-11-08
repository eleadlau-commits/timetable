// Week view: the week as a grid of hours, with sessions that clash shown side by side.
// Saturday and Sunday only appear when something is on. Tapping a day zooms in to it in the
// Planner (or opens the Day view, without the Planner).

import { Feature, ui, time } from 'folio';

const { el } = ui;
const HOUR_PX = 52; // keep in sync with the hour lines in week-view.css
const LINE_PX = 12.6; // one line of a block's text: 10.5px at line-height 1.2, as in week-view.css

// How many lines of the module's name fit in a block this tall (3px padding top and bottom).
const linesFor = (height) => Math.max(1, Math.floor((height - 6) / LINE_PX));

export default class WeekView extends Feature {
  start() {
    this.sessions = this.use('sessions');
    this.planner = this.use('planner');
    // Inside the Planner tab if it's installed, otherwise a tab of its own.
    this.add(this.use('planner') ? 'planner.views' : 'views', {
      icon: 'calendar',
      id: 'week',
      label: 'Week',
      short: 'W',
      zoom: 30,
      crumb: (day) => (time.sameDay(time.startOfWeek(day), time.startOfWeek(new Date())) ? 'This week' : 'Week'),
      order: 20,
      mount: (container) => this.mount(container),
      render: () => this.render(),
      step: (direction) => this.moveWeek(direction),
    });
  }

  // The next or previous week, opened on its Monday (so zooming in shows Monday).
  moveWeek(direction) {
    this.sessions.select(time.addDays(time.startOfWeek(this.sessions.selected), direction * 7));
  }

  mount(container) {
    this.label = el('h2');
    this.thisWeek = el('button', { type: 'button', class: 'link-btn', onclick: () => this.sessions.select(new Date()) }, 'This week');
    this.grid = el('div');
    container.append(
      el('div', { class: 'weekhead' },
        el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Previous week', onclick: () => this.moveWeek(-1) }, ui.icon('left')),
        this.label,
        this.thisWeek,
        el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Next week', onclick: () => this.moveWeek(1) }, ui.icon('right'))),
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
      const items = sessions.onDay(day, { others: true });
      if (i < 5 || items.length) days.push({ day, items });
    }

    const { layoutLanes, minutesInto: mins, hourRange } = sessions.layout;
    const anyTimed = days.some(({ items }) => items.some((s) => !s.allDay));
    const { start: startH, end: endH } = hourRange(days);
    const hours = endH - startH;
    const px = (m) => ((m - startH * 60) / 60) * HOUR_PX;

    const head = el('div', { class: 'wk-row wk-head' }, el('span'), days.map(({ day }) =>
      el('button', {
        type: 'button',
        class: `wk-day${time.sameDay(day, today) ? ' today' : ''}`,
        'aria-label': `Open ${time.formatLongDate(day)}`,
        onclick: () => {
          sessions.select(day);
          if (this.planner) this.planner.zoomIn();
          else this.app.shell.selectView('day');
        },
      }, el('span', {}, day.toLocaleDateString([], { weekday: 'short' })), el('b', {}, day.getDate()))));

    const anyAllDay = days.some(({ items }) => items.some((s) => s.allDay));
    const allDayRow = anyAllDay && el('div', { class: 'wk-row wk-allday' },
      el('span', { class: 'wk-gutter' }, 'all day'),
      days.map(({ items }) => el('div', { class: 'wk-cell' }, items.filter((s) => s.allDay).map((s) =>
        el('button', { type: 'button', class: `wk-chip${s.outline ? ' outline' : ''}`, style: `--h:${sessions.hue(s)}`, onclick: () => sessions.open(s) },
          sessions.moduleName(s))))));

    const hourLabels = el('div', { class: 'wk-hours' }, Array.from({ length: hours }, (_, i) =>
      el('span', { style: `top:${i * HOUR_PX}px` }, new Date(2000, 0, 1, startH + i).toLocaleTimeString([], { hour: 'numeric' }))));

    const columns = days.map(({ day, items }) => {
      const blocks = layoutLanes(items.filter((s) => !s.allDay).map((s) => {
        const top = mins(s.start, day);
        return { s, top, bottom: Math.max(mins(s.end, day), top + 20) };
      }));
      const column = el('div', { class: `wk-col${time.sameDay(day, today) ? ' today' : ''}` }, blocks.map(({ s, top, bottom, lane, lanes }) => {
        const kind = sessions.kind(s);
        const height = Math.max(18, px(bottom) - px(top) - 2);
        // The module's name; side by side with a clash there's only room for its code.
        return el('button', {
          type: 'button',
          class: `blk${s.cancelled ? ' cancelled' : ''}${s.end <= now ? ' past' : ''}${s.outline ? ' outline' : ''}${s.others ? ' others' : ''}`,
          style: `--h:${sessions.hue(s)};--lane:${lane};--lanes:${lanes};top:${px(top)}px;height:${height}px;--lines:${linesFor(height)}`,
          'aria-label': `${sessions.name(s)}, ${time.formatTime(s.start)}–${time.formatTime(s.end)}${s.location ? `, ${s.location}` : ''}`,
          onclick: () => sessions.open(s),
        }, el('b', {}, lanes > 1 ? sessions.shortName(s) : sessions.moduleName(s)), kind && el('small', {}, kind), s.location && el('small', {}, s.location));
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
    requestAnimationFrame(() => this.fit(grid));
  }

  // Leaves out the type or room in a block when it would be cut off at the bottom.
  fit(grid) {
    for (const block of grid.querySelectorAll('.blk')) {
      const bottom = block.getBoundingClientRect().bottom - 2;
      for (const line of block.querySelectorAll('small')) {
        line.classList.remove('wont-fit');
        if (line.getBoundingClientRect().bottom > bottom) line.classList.add('wont-fit');
      }
    }
  }
}
