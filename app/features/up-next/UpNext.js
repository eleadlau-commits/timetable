// Up next: the timetable on Home. The "Next: … · 16:00 · CG85 · in 47 min" line under the clock,
// and a slim date strip with a lecture card below it: the next class in full, then the rest of
// that day, each one fainter. The rules are in lectures.js.
//
// Saved data: none. The day picked in the strip is forgotten when the app closes.

import { Feature, ui, time } from 'folio';
import { fadeStep, stripPage, upNext, dayPlan, cardLabel, whenText } from './lectures.js';

const { el } = ui;
const STRIP_DAYS = 3;
const LOOK_AHEAD_DAYS = 14;

export default class UpNext extends Feature {
  start() {
    this.sessions = this.use('sessions');
    this.timetable = this.use('timetable');
    this.toToday();
    this.add('home.next', { order: 10, render: () => this.nextLine() });
    this.add('home.main', { order: 10, render: () => this.dayBlock() });
    this.on('timetable:loaded', () => this.toToday());
    // After midnight, or when the app comes back on a new day, go back to today.
    const roll = () => { if (this.onToday && !time.sameDay(this.day, new Date())) this.toToday(); };
    this.on('app:tick', roll);
    this.on('app:resume', roll);
  }

  toToday() {
    this.page = 0;
    this.day = time.startOfDay(new Date());
    this.onToday = true;
    this.refresh();
  }

  pick(day) {
    this.day = time.startOfDay(day);
    this.onToday = time.sameDay(day, new Date());
    this.refresh();
  }

  missing() {
    return this.timetable?.hasData ? null : { missing: 'add your timetable', action: () => this.app.shell.openSettings() };
  }

  // ---- The line under the clock ----

  nextLine() {
    const missing = this.missing();
    if (missing) return missing;
    const now = new Date();
    let next = null;
    for (let i = 0; i < LOOK_AHEAD_DAYS && !next; i++) {
      next = upNext(this.sessions.onDay(time.addDays(now, i)), now);
    }
    if (!next) return el('span', {}, 'No classes in the next two weeks');
    const s = next.session;
    const when = next.live ? `until ${time.formatTime(s.end)}` : whenText(s.start, now);
    const soon = !next.live && time.sameDay(s.start, now) && time.inTime(s.start - now);
    // The name gets cut short first, so the time and room stay readable.
    return el('button', { type: 'button', class: 'un-next', onclick: () => this.sessions.open(s) },
      el('span', { class: 'un-next-name' }, `${next.live ? 'Now' : 'Next'}: ${this.sessions.name(s)}`),
      el('span', { class: 'un-next-when' }, ` · ${[when, s.location].filter(Boolean).join(' · ')}`),
      soon && el('span', { class: 'un-soon' }, soon));
  }

  // ---- Date strip and lecture card ----

  dayBlock() {
    const missing = this.missing();
    if (missing) return missing;
    return el('div', { class: 'un-block' }, this.strip(), this.card());
  }

  strip() {
    const today = time.startOfDay(new Date());
    const days = stripPage(today, this.page, STRIP_DAYS);
    const turn = (by) => {
      this.page += by;
      this.pick(stripPage(today, this.page, STRIP_DAYS)[0]);
    };
    return el('nav', { class: 'un-strip', 'aria-label': 'Choose day' },
      el('button', { type: 'button', class: 'un-arrow', 'aria-label': 'Earlier days', onclick: () => turn(-1) }, ui.icon('left')),
      days.map((d) => el('button', {
        type: 'button',
        class: `un-day${time.sameDay(d, this.day) ? ' sel' : ''}${time.sameDay(d, today) ? ' today' : ''}`,
        'aria-current': time.sameDay(d, today) ? 'date' : null,
        'aria-pressed': String(time.sameDay(d, this.day)),
        'aria-label': time.formatLongDate(d),
        onclick: () => this.pick(d),
      }, d.toLocaleDateString([], { weekday: 'short' }), ' ', el('b', {}, d.getDate()))),
      el('button', { type: 'button', class: 'un-arrow', 'aria-label': 'Later days', onclick: () => turn(1) }, ui.icon('right')));
  }

  card() {
    const now = new Date();
    const day = this.day;
    const plan = dayPlan(this.sessions.onDay(day), day, now);
    const back = !time.sameDay(day, now) && el('button', { type: 'button', class: 'un-today', onclick: () => this.toToday() }, 'Today');
    const label = el('div', { class: 'un-label' }, el('span', {}, cardLabel(plan, day, now)), back);

    if (plan.state !== 'list') {
      const hidden = this.sessions.hiddenNote(day);
      const after = plan.state === 'done' && this.nextDayWithClasses(day);
      return el('article', { class: 'un-card' }, label,
        el('div', { class: 'un-empty' },
          el('b', {}, plan.state === 'done' ? 'That\'s all for today' : 'No classes'),
          after && el('button', { type: 'button', class: 'link-btn', onclick: () => this.showDay(after) },
            `Next: ${time.dayLabel(after)}`)),
        hidden);
    }

    const s = plan.main;
    const kind = this.sessions.kind(s);
    return el('article', { class: 'un-card' }, label,
      el('button', { type: 'button', class: `un-main${s.cancelled ? ' cancelled' : ''}`, onclick: () => this.sessions.open(s) },
        el('span', { class: 'un-name' }, this.sessions.name(s)),
        el('span', { class: 'un-sub' }, this.range(s)),
        (kind || s.location) && el('span', { class: 'un-sub' }, [kind, this.sessions.placeLabel(s.location)].filter(Boolean).join(' · '))),
      plan.rest.map((r, i) => el('button', {
        type: 'button',
        class: `un-item fade-${fadeStep(i)}${r.cancelled ? ' cancelled' : ''}`,
        onclick: () => this.sessions.open(r),
      },
        el('span', { class: 'un-item-name' }, this.sessions.name(r)),
        el('span', { class: 'un-item-sub' }, [this.range(r), r.cancelled ? 'Cancelled' : r.location].filter(Boolean).join(' · ')))));
  }

  range(s) {
    return s.allDay ? 'All day' : `${time.formatTime(s.start)} – ${time.formatTime(s.end)}`;
  }

  // The next weekday after `day` that has classes, within two weeks, or null.
  nextDayWithClasses(day) {
    for (let i = 1; i <= LOOK_AHEAD_DAYS; i++) {
      const d = time.addDays(day, i);
      if (this.sessions.onDay(d).some((s) => !s.cancelled)) return d;
    }
    return null;
  }

  // Shows a day in the card, turning the strip to the page with that day.
  showDay(day) {
    const today = time.startOfDay(new Date());
    for (let page = 0; page < 10; page++) {
      if (stripPage(today, page, STRIP_DAYS).some((d) => time.sameDay(d, day))) {
        this.page = page;
        break;
      }
    }
    this.pick(day);
  }
}
