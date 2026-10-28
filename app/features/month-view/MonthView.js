// Month view: a month at a time, with a coloured dot for each module on each day. Tapping a day
// picks it and lists its classes underneath; tapping it again (or "Day") zooms in to it.
//
// Saved data: nothing. The chosen day belongs to the sessions service, so every view stays in step.

import { Feature, ui, time } from 'folio';

const { el } = ui;

export default class MonthView extends Feature {
  start() {
    this.sessions = this.use('sessions');
    this.planner = this.use('planner');
    // Inside the Planner tab if it's installed, otherwise a tab of its own.
    this.add(this.planner ? 'planner.views' : 'views', {
      icon: 'calendar',
      id: 'month',
      label: 'Month',
      short: 'M',
      zoom: 20,
      crumb: (day) => day.toLocaleDateString([], { month: 'long' }),
      order: 15,
      mount: (container) => this.mount(container),
      render: () => this.render(),
      step: (direction) => this.move(direction),
    });
  }

  move(months) {
    this.sessions.select(this.sessions.layout.addMonths(this.sessions.selected, months));
  }

  // Zooms in to a closer level: the week (or a day, with `id` 'day').
  open(day, id) {
    this.sessions.select(day);
    if (this.planner) {
      if (id) this.planner.show(id, 'in');
      else this.planner.zoomIn();
    } else {
      this.app.shell.selectView(id || 'week');
    }
  }

  mount(container) {
    this.label = el('h2');
    this.todayButton = el('button', { type: 'button', class: 'link-btn', onclick: () => this.sessions.select(new Date()) }, 'Today');
    this.grid = el('div', { class: 'mo-grid', role: 'grid' });
    this.dayTitle = el('h3');
    this.list = el('div', { class: 'mo-list' });
    const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 26 + i)); // a Monday to Sunday
    container.append(
      el('div', { class: 'monthhead' },
        el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Previous month', onclick: () => this.move(-1) }, ui.icon('left')),
        this.label,
        this.todayButton,
        el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Next month', onclick: () => this.move(1) }, ui.icon('right'))),
      el('div', { class: 'mo-dow', 'aria-hidden': 'true' }, weekdays.map((d) => el('span', {}, d.toLocaleDateString([], { weekday: 'narrow' })))),
      this.grid,
      el('div', { class: 'mo-dayhead' },
        this.dayTitle,
        el('div', { class: 'mo-open' },
          el('button', { type: 'button', class: 'link-btn', onclick: () => this.open(this.sessions.selected) }, 'Week'),
          el('button', { type: 'button', class: 'link-btn', onclick: () => this.open(this.sessions.selected, 'day') }, 'Day'))),
      this.list);
  }

  render() {
    const sessions = this.sessions;
    const selected = sessions.selected;
    const today = time.startOfDay(new Date());
    const now = new Date();
    this.label.textContent = selected.toLocaleDateString([], { month: 'long', year: 'numeric' });
    this.todayButton.hidden = selected.getMonth() === today.getMonth() && selected.getFullYear() === today.getFullYear();

    this.grid.replaceChildren(...sessions.layout.monthGrid(selected).map((week) => el('div', { class: 'mo-week', role: 'row' }, week.map((day) => {
      const isSelected = time.sameDay(day, selected);
      const hues = sessions.hues(day);
      const count = sessions.onDay(day).filter((s) => !s.cancelled).length;
      return el('button', {
        type: 'button',
        role: 'gridcell',
        class: `mo-day${day.getMonth() !== selected.getMonth() ? ' other' : ''}${time.sameDay(day, today) ? ' today' : ''}${isSelected ? ' sel' : ''}`,
        'aria-label': `${time.formatLongDate(day)}${count ? `, ${count} session${count > 1 ? 's' : ''}` : ''}`,
        'aria-selected': String(isSelected),
        onclick: () => (isSelected ? this.open(day, 'day') : sessions.select(day)),
      },
        el('b', {}, day.getDate()),
        el('span', { class: 'mo-dots', 'aria-hidden': 'true' }, hues.map((h) => el('i', { style: `--h:${h}` }))));
    }))));

    this.dayTitle.textContent = `${time.dayLabel(selected)} · ${time.formatDate(selected)}`;
    const items = sessions.onDay(selected);
    const hidden = sessions.hiddenNote(selected);
    this.list.replaceChildren(...[
      !items.length && el('p', { class: 'mo-none' }, 'No classes'),
      ...items.map((s) => el('button', {
        type: 'button',
        class: `mo-row${s.end <= now ? ' past' : ''}${s.cancelled ? ' cancelled' : ''}`,
        style: `--h:${sessions.hue(s)}`,
        onclick: () => sessions.open(s),
      },
        el('span', { class: 'mo-time' }, s.allDay ? 'All day' : time.formatTime(s.start)),
        el('span', { class: 'mo-what' },
          el('b', {}, sessions.name(s)),
          el('small', {}, [s.cancelled ? 'Cancelled' : sessions.kind(s), s.location].filter(Boolean).join(' · '))))),
      hidden,
    ].filter(Boolean));
  }
}
