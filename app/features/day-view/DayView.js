// Day view: one day as a timeline of hours, so the gaps between classes show, with a week strip
// to pick the day. Tap a day in the strip, or use the arrows or arrow keys, to move.

import { Feature, ui, time } from 'folio';

const { el } = ui;
const HOUR_PX = 76; // keep in sync with the hour lines in day-view.css

export default class DayView extends Feature {
  start() {
    this.sessions = this.use('sessions');
    this.defineSlot('day.cards',
      'Cards above the day\'s sessions. Item: { order, render(day) → element, or null to show nothing }.');
    // Inside the Planner tab if it's installed, otherwise a tab of its own.
    this.add(this.use('planner') ? 'planner.views' : 'views', {
      icon: 'calendar',
      id: 'day',
      label: 'Day',
      short: 'D',
      zoom: 40,
      order: 10,
      mount: (container) => this.mount(container),
      render: () => this.render(),
      step: (direction) => this.move(direction),
    });
  }

  move(days) {
    this.sessions.select(time.addDays(this.sessions.selected, days));
  }

  mount(container) {
    this.strip = el('div', { class: 'week-days' });
    this.title = el('h2');
    this.todayButton = el('button', { type: 'button', class: 'link-btn', onclick: () => this.sessions.select(new Date()) }, 'Back to today');
    this.cards = el('div', { class: 'day-cards' });
    this.list = el('div', { class: 'day-list' });
    container.append(
      el('div', { class: 'weekbar' },
        el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Previous week', onclick: () => this.move(-7) }, ui.icon('left')),
        this.strip,
        el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Next week', onclick: () => this.move(7) }, ui.icon('right'))),
      el('div', { class: 'dayhead' }, this.title, this.todayButton),
      this.cards,
      this.list);
  }

  render() {
    const sessions = this.sessions;
    const selected = sessions.selected;
    const now = new Date();
    const today = time.startOfDay(now);
    const week = time.startOfWeek(selected);

    this.strip.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
      const day = time.addDays(week, i);
      const isSelected = time.sameDay(day, selected);
      const busy = sessions.onDay(day).some((s) => !s.cancelled);
      return el('button', {
        type: 'button',
        class: `daybtn${isSelected ? ' sel' : ''}${time.sameDay(day, today) ? ' today' : ''}${busy ? ' has' : ''}`,
        'aria-label': time.formatLongDate(day),
        'aria-pressed': String(isSelected),
        onclick: () => sessions.select(day),
      },
        el('span', {}, day.toLocaleDateString([], { weekday: 'short' })),
        el('b', {}, day.getDate()),
        el('i', { class: 'dot' }));
    }));

    this.title.replaceChildren(time.dayLabel(selected), ' ', el('span', {}, time.formatDate(selected)));
    this.todayButton.hidden = time.sameDay(selected, today);
    this.cards.replaceChildren(...this.slot('day.cards').map((card) => card.render(selected)));

    const items = sessions.onDay(selected);
    const hidden = sessions.hiddenNote(selected);
    if (!items.length) {
      const weekend = selected.getDay() === 0 || selected.getDay() === 6;
      this.list.replaceChildren(...[
        el('div', { class: 'empty' },
          el('b', {}, weekend ? 'Nothing scheduled' : 'No classes'),
          el('div', {}, 'Tap another day, or use the arrows.')),
        hidden,
      ].filter(Boolean));
      return;
    }
    const isToday = time.sameDay(selected, today);
    const next = isToday ? items.find((s) => s.start > now && !s.cancelled) : null;
    const allDay = items.filter((s) => s.allDay);
    this.list.replaceChildren(...[
      allDay.length && el('div', { class: 'tl-allday' }, allDay.map((s) => sessions.card(s, { now }))),
      this.timeline(items.filter((s) => !s.allDay), { now, isToday, next }),
      hidden,
    ].filter(Boolean));
  }

  // The day's timed sessions on a grid of hours; ones that clash sit side by side.
  timeline(items, { now, isToday, next }) {
    if (!items.length) return null;
    const sessions = this.sessions;
    const day = sessions.selected;
    const { layoutLanes, minutesInto: mins, hourRange } = sessions.layout;
    const { start: startH, end: endH } = hourRange([{ day, items }]);
    const px = (m) => ((m - startH * 60) / 60) * HOUR_PX;
    const blocks = layoutLanes(items.map((s) => {
      const top = mins(s.start, day);
      return { s, top, bottom: Math.max(mins(s.end, day), top + 30) };
    }));
    const hours = Array.from({ length: endH - startH + 1 }, (_, i) =>
      el('span', { class: 'tl-hour', style: `top:${i * HOUR_PX}px` }, new Date(2000, 0, 1, startH + i).toLocaleTimeString([], { hour: 'numeric' })));
    const area = el('div', { class: 'tl-area' }, blocks.map(({ s, top, bottom, lane, lanes }) => {
      const past = s.end <= now;
      const live = s.start <= now && now < s.end && !s.cancelled;
      const badge = sessions.badge(s);
      const place = sessions.placeLabel(s.location);
      return el('article', {
        class: `tl-blk${past ? ' past' : ''}${s.cancelled ? ' cancelled' : ''}${bottom - top < 50 ? ' short' : ''}${s.outline ? ' outline' : ''}`,
        style: `--h:${sessions.hue(s)};--lane:${lane};--lanes:${lanes};top:${px(top)}px;height:${Math.max(28, px(bottom) - px(top) - 3)}px`,
        onclick: () => sessions.open(s),
      },
        el('div', { class: 'tl-title' },
          el('button', { type: 'button', class: 'title-text', onclick: (e) => { e.stopPropagation(); sessions.open(s); } }, sessions.name(s)),
          badge && el('span', { class: 'badge' }, badge)),
        el('div', { class: 'tl-meta' }, [`${time.formatTime(s.start)}–${time.formatTime(s.end)}`, place].filter(Boolean).join(' · ')),
        this.slot('session.card').map((line) => line.render(s)),
        live && el('div', { class: 'pill' }, `Now · until ${time.formatTime(s.end)}`),
        s === next && el('div', { class: 'pill next' }, `Next · ${time.inTime(s.start - now)}`));
    }));
    const m = now.getHours() * 60 + now.getMinutes();
    if (isToday && m >= startH * 60 && m <= endH * 60) area.append(el('div', { class: 'now-line', style: `top:${px(m)}px` }));
    return el('div', { class: 'tl', style: `height:${(endH - startH) * HOUR_PX}px` }, el('div', { class: 'tl-hours' }, hours), area);
  }
}
