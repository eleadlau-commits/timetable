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
    this.add('home.main', { order: 10, render: () => this.fit(this.dayCard(time.startOfDay(new Date()))) });
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
