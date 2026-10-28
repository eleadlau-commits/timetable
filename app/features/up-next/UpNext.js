// Up next: today's lectures, in the large card on the Home tab. The class on now (or the next
// one) is shown in full; each one after it is a little fainter. Every lecture left today fits
// on the card without scrolling: when they don't, the card squeezes them (see fit()). Tap a
// class to open its details. Without a timetable it shows "Missing content".
//
// Saved data: none.

import { Feature, ui, time } from 'folio';
import { dayPlan, fadeStep, isOn, isWeekend } from './rules.js';

const { el } = ui;
const range = (s) => (s.allDay ? 'All day' : `${time.formatTime(s.start)} – ${time.formatTime(s.end)}`);

export default class UpNext extends Feature {
  start() {
    this.sessions = this.use('sessions');
    this.timetable = this.use('timetable');
    this.add('home.widgets', {
      id: 'up-next', label: "Today's lectures", order: 20, sizes: ['large', 'tall', 'wide'],
      render: (size) => {
        if (size === 'wide') return this.strip();
        const card = this.dayCard(time.startOfDay(new Date()));
        if (size === 'tall') card.classList.add('un-narrow');
        return this.fit(card);
      },
    });
  }

  // Squeezes the card until every lecture fits without scrolling, one step at a time: each
  // later lecture on one line (time and name), then a smaller first one, then without its room.
  fit(card) {
    requestAnimationFrame(() => {
      for (const step of ['tight', 'tighter', 'tightest']) {
        if (card.scrollHeight <= card.clientHeight) return;
        card.classList.add(step);
      }
    });
    return card;
  }

  get hasTimetable() {
    return !!this.timetable?.hasData;
  }

  dayCard(today) {
    if (!this.hasTimetable) return ui.missing('Add your timetable to see your lectures here.', { class: 'missing un-card' });
    const now = new Date();
    const { lead, rest, over } = dayPlan(this.sessions.onDay(today), now);

    if (!lead) {
      const message = over ? 'That\'s all for today.' : isWeekend(today) ? 'Nothing on, enjoy the weekend.' : 'No classes today.';
      return el('article', { class: 'un-card' },
        el('span', { class: 'un-label' }, 'Today'),
        el('p', { class: 'un-empty' }, message),
        this.sessions.hiddenNote(today));
    }

    const label = isOn(lead, now) ? `Now · until ${time.formatTime(lead.end)}`
      : `Up next · ${time.inTime(lead.start - now)}`;
    const kind = this.sessions.kind(lead);
    const place = this.sessions.placeLabel(lead.location);
    return el('article', { class: 'un-card' },
      el('span', { class: 'un-label' }, label),
      el('div', this.opens(lead, 'un-lead'),
        el('span', { class: 'un-name' }, this.sessions.name(lead)),
        el('span', { class: 'un-line' }, range(lead)),
        (kind || place) && el('span', { class: 'un-line un-where' }, [kind, place].filter(Boolean).join(' · '))),
      rest.map((s, i) => el('div', this.opens(s, `un-later fade-${fadeStep(i)}${s.cancelled ? ' cancelled' : ''}`),
        el('span', { class: 'un-later-name' }, this.sessions.name(s)),
        el('span', { class: 'un-later-line' },
          el('span', {}, s.allDay ? 'All day' : time.formatTime(s.start)),
          s.location && el('span', { class: 'un-room' }, ` · ${s.location}`),
          s.cancelled && ' · Cancelled'))));
  }

  // As a wide strip on Home: only the class on now, or the next one.
  strip() {
    if (!this.hasTimetable) return ui.missing('Add your timetable to see your lectures here.', { class: 'missing un-card' });
    const now = new Date();
    const today = time.startOfDay(now);
    const { lead, over } = dayPlan(this.sessions.onDay(today), now);
    if (!lead) {
      const message = over ? 'That\'s all for today.' : isWeekend(today) ? 'Nothing on, enjoy the weekend.' : 'No classes today.';
      return el('article', { class: 'un-card un-strip' }, el('span', { class: 'un-label' }, 'Today'), el('span', { class: 'un-strip-name' }, message));
    }
    const label = isOn(lead, now) ? `Now · until ${time.formatTime(lead.end)}` : `Up next · ${time.inTime(lead.start - now)}`;
    const place = this.sessions.placeLabel(lead.location);
    return el('article', this.opens(lead, 'un-card un-strip'),
      el('span', { class: 'un-label' }, label),
      el('span', { class: 'un-strip-line' },
        el('span', { class: 'un-strip-name' }, this.sessions.name(lead)),
        el('span', { class: 'un-strip-when' }, [lead.allDay ? 'All day' : time.formatTime(lead.start), place].filter(Boolean).join(' · '))));
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
