// Day view: the sessions of one day, with a week strip to pick the day. Swipe or use the
// arrow keys to move a day at a time.

import { Feature, ui, time } from 'folio';

const { el } = ui;

export default class DayView extends Feature {
  start() {
    this.sessions = this.use('sessions');
    this.add('views', {
      id: 'day',
      label: 'Day',
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
    this.list = el('div', { class: 'list day-list' });
    container.append(
      el('div', { class: 'weekbar' },
        el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Previous week', onclick: () => this.move(-7) }, ui.icon('left')),
        this.strip,
        el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Next week', onclick: () => this.move(7) }, ui.icon('right'))),
      el('div', { class: 'dayhead' }, this.title, this.todayButton),
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

    const items = sessions.onDay(selected);
    const hidden = sessions.hiddenNote(selected);
    if (!items.length) {
      const weekend = selected.getDay() === 0 || selected.getDay() === 6;
      this.list.replaceChildren(...[
        el('div', { class: 'empty' },
          el('b', {}, weekend ? 'Nothing scheduled' : 'No classes'),
          el('div', {}, 'Swipe or use the arrows to see other days.')),
        hidden,
      ].filter(Boolean));
      return;
    }
    const next = time.sameDay(selected, today) ? items.find((s) => s.start > now && !s.cancelled) : null;
    this.list.replaceChildren(
      ...items.map((s) => sessions.card(s, {
        now,
        extra: s === next && el('div', { class: 'pill next' }, `Next · ${time.inTime(s.start - now)}`),
      })),
      ...[hidden].filter(Boolean));
  }
}
