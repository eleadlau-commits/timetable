// Upcoming: everything in the next four weeks, grouped by day.

import { Feature, ui, time } from 'folio';

const { el } = ui;
const DAYS_AHEAD = 28;

export default class Upcoming extends Feature {
  start() {
    this.sessions = this.use('sessions');
    // The id stays 'agenda' so the app remembers this view from before it was renamed.
    this.add('views', {
      id: 'agenda',
      label: 'Upcoming',
      order: 30,
      mount: (container) => { this.box = container; },
      render: () => this.render(),
    });
  }

  render() {
    const now = new Date();
    const today = time.startOfDay(now);
    const out = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const day = time.addDays(today, i);
      const items = this.sessions.onDay(day).filter((s) => s.end > now);
      if (!items.length) continue;
      out.push(
        el('h3', { class: 'agenda-day' }, `${time.dayLabel(day)} · ${time.formatDate(day, 'short')}`),
        el('div', { class: 'list' }, items.map((s) => this.sessions.card(s, { now }))));
    }
    if (!out.length) {
      out.push(el('div', { class: 'empty' },
        el('b', {}, 'Nothing in the next four weeks'),
        el('div', {}, 'If that looks wrong, tap refresh or check your timetable link in Settings.')));
    }
    this.box.replaceChildren(...out);
  }
}
