// Up next: what's coming up, for the Home tab.
//   - Under the clock: "Next: Linear Algebra II · 16:00 · CG85".
//   - The large card: a slim date strip (today first, then weekdays) and the chosen day's
//     classes. The next class is shown in full; each one after it is a little fainter.
// Tap a class to open its details. Without a timetable it shows "Missing content".
//
// Saved data: none. The chosen day goes back to today when the app is opened again.

import { Feature, ui, time } from 'folio';
import { stripDays, dayPlan, fadeStep, nextSession, isOn } from './rules.js';

const { el } = ui;
const range = (s) => (s.allDay ? 'All day' : `${time.formatTime(s.start)} – ${time.formatTime(s.end)}`);

export default class UpNext extends Feature {
  start() {
    this.sessions = this.use('sessions');
    this.timetable = this.use('timetable');
    this.page = 0;
    this.day = time.startOfDay(new Date());

    this.add('home.next', { order: 10, render: () => this.nextLine() });
    this.add('home.main', { order: 10, render: () => this.card() });
    this.on('app:resume', () => this.backToToday());
  }

  backToToday() {
    this.page = 0;
    this.day = time.startOfDay(new Date());
    this.refresh();
  }

  get hasTimetable() {
    return !!this.timetable?.hasData;
  }

  // ---- Under the clock ----

  nextLine() {
    if (!this.hasTimetable) return el('div', {}, 'Add your timetable to see what\'s next');
    const now = new Date();
    const s = nextSession(this.sessions.all.filter((x) => this.sessions.isShown(x)), now);
    if (!s) return el('div', {}, 'No classes in the next week');
    const when = time.sameDay(s.start, now)
      ? time.formatTime(s.start)
      : `${s.start.toLocaleDateString([], { weekday: 'short' })} ${time.formatTime(s.start)}`;
    return el('div', {}, `Next: ${[this.sessions.name(s), when, s.location].filter(Boolean).join(' · ')}`);
  }

  // ---- The large card ----

  card() {
    // A day that has gone by (the app was left open overnight) goes back to today.
    const today = time.startOfDay(new Date());
    if (this.day < today) {
      this.day = today;
      this.page = 0;
    }
    return el('div', { class: 'un' }, this.strip(today), this.dayCard(today));
  }

  strip(today) {
    const days = stripDays(today, this.page);
    const go = (page) => {
      this.page = Math.max(0, page);
      this.day = stripDays(today, this.page)[0];
      this.refresh();
    };
    return el('nav', { class: 'un-strip', 'aria-label': 'Choose day' },
      el('button', {
        type: 'button', class: 'un-arrow', 'aria-label': 'Earlier days', disabled: this.page === 0,
        onclick: () => go(this.page - 1),
      }, ui.icon('left')),
      days.map((day) => el('button', {
        type: 'button',
        class: 'un-day',
        'aria-label': time.formatLongDate(day),
        'aria-pressed': String(time.sameDay(day, this.day)),
        'aria-current': time.sameDay(day, today) ? 'date' : null,
        onclick: () => {
          this.day = day;
          this.refresh();
        },
      }, day.toLocaleDateString([], { weekday: 'short' }), ' ', el('b', {}, day.getDate()))),
      el('button', { type: 'button', class: 'un-arrow', 'aria-label': 'Later days', onclick: () => go(this.page + 1) }, ui.icon('right')));
  }

  dayCard(today) {
    if (!this.hasTimetable) return ui.missing('Add your timetable to see your lectures here.', { class: 'missing un-card' });
    const now = new Date();
    const isToday = time.sameDay(this.day, today);
    const { lead, rest, over } = dayPlan(this.sessions.onDay(this.day), now, isToday);
    const dayName = `${time.dayLabel(this.day)} · ${time.formatDate(this.day, 'short')}`;

    if (!lead) {
      const weekend = this.day.getDay() === 0 || this.day.getDay() === 6;
      const message = over ? 'That\'s all for today.' : weekend ? 'Nothing on, enjoy the weekend.' : 'No classes on this day.';
      return el('article', { class: 'un-card' },
        el('span', { class: 'un-label' }, dayName),
        el('p', { class: 'un-empty' }, message),
        this.sessions.hiddenNote(this.day));
    }

    const label = !isToday ? dayName
      : isOn(lead, now) ? `Now · until ${time.formatTime(lead.end)}`
        : `Up next · ${time.inTime(lead.start - now)}`;
    const kind = this.sessions.kind(lead);
    const place = this.sessions.placeLabel(lead.location);
    return el('article', { class: 'un-card' },
      el('span', { class: 'un-label' }, label),
      el('div', this.opens(lead, 'un-lead'),
        el('span', { class: 'un-name' }, this.sessions.name(lead)),
        el('span', { class: 'un-line' }, range(lead)),
        (kind || place) && el('span', { class: 'un-line' }, [kind, place].filter(Boolean).join(' · '))),
      rest.map((s, i) => el('div', this.opens(s, `un-later fade-${fadeStep(i)}${s.cancelled ? ' cancelled' : ''}`),
        el('span', { class: 'un-later-name' }, this.sessions.name(s)),
        el('span', { class: 'un-later-line' },
          [range(s), s.location, s.cancelled && 'Cancelled'].filter(Boolean).join(' · ')))));
  }

  // Makes a row open the session's details when tapped.
  opens(s, className) {
    return {
      class: className,
      role: 'button',
      tabindex: '0',
      onclick: () => this.sessions.open(s),
      onkeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.sessions.open(s);
        }
      },
    };
  }
}
