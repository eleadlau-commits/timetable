// Year view: the academic year at a glance, September to August, as twelve small months. Days
// with classes are dark and the rest faded, so term time stands out; today is circled. Tapping a
// month zooms in to it.
//
// Saved data: nothing.

import { Feature, ui, time } from 'folio';

const { el } = ui;

export default class YearView extends Feature {
  start() {
    this.sessions = this.use('sessions');
    this.planner = this.use('planner');
    // Inside the Planner tab if it's installed, otherwise a tab of its own.
    this.add(this.planner ? 'planner.views' : 'views', {
      icon: 'calendar',
      id: 'year',
      label: 'Year',
      short: 'Y',
      zoom: 10,
      crumb: (day) => this.sessions.layout.academicYear(day).label,
      order: 12,
      mount: (container) => this.mount(container),
      render: () => this.render(),
      step: (direction) => this.move(direction),
    });
  }

  move(years) {
    this.sessions.select(this.sessions.layout.addMonths(this.sessions.selected, years * 12));
  }

  // Zooms in to a month: on today if it's in that month, else the day already chosen if it is,
  // else the 1st.
  open(month) {
    const sessions = this.sessions;
    const inMonth = (d) => d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
    const today = new Date();
    sessions.select(inMonth(today) ? today : inMonth(sessions.selected) ? sessions.selected : month);
    if (this.planner) this.planner.zoomIn();
    else this.app.shell.selectView('month');
  }

  mount(container) {
    this.label = el('h2');
    this.todayButton = el('button', { type: 'button', class: 'link-btn', onclick: () => this.sessions.select(new Date()) }, 'Today');
    this.grid = el('div', { class: 'yr-grid' });
    container.append(
      el('div', { class: 'yearhead' },
        el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Previous year', onclick: () => this.move(-1) }, ui.icon('left')),
        this.label,
        this.todayButton,
        el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Next year', onclick: () => this.move(1) }, ui.icon('right'))),
      this.grid,
      el('div', { class: 'yr-key' },
        el('span', {}, el('i', { class: 'busy' }), 'Days with classes'),
        el('span', {}, el('i', { class: 'today' }), 'Today')));
  }

  render() {
    const sessions = this.sessions;
    const { academicYear, monthGrid } = sessions.layout;
    const year = academicYear(sessions.selected);
    const today = time.startOfDay(new Date());
    this.label.textContent = year.label;
    this.todayButton.hidden = academicYear(today).label === year.label;

    this.grid.replaceChildren(...year.months.map((month) => {
      const thisMonth = month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();
      const days = monthGrid(month).flat().map((day) => {
        if (day.getMonth() !== month.getMonth()) return el('span');
        const busy = sessions.onDay(day).some((s) => !s.cancelled);
        return el('span', { class: `${busy ? 'busy' : ''}${time.sameDay(day, today) ? ' today' : ''}` }, day.getDate());
      });
      const name = month.toLocaleDateString([], { month: 'short' });
      return el('button', {
        type: 'button',
        class: `yr-month${thisMonth ? ' now' : ''}`,
        'aria-label': month.toLocaleDateString([], { month: 'long', year: 'numeric' }),
        onclick: () => this.open(month),
      }, el('b', {}, name), el('span', { class: 'yr-days', 'aria-hidden': 'true' }, days));
    }));
  }
}
