// Own events: things of your own in the Planner (a society meeting, the gym, a shift), drawn as
// outlines next to your classes. The + button next to the Planner's level switch opens a form:
// name, day, start and end time, an optional place, and "Repeat every week" (with an optional
// last week). Tap an event to see it; its details window has Edit and Delete (for a repeating
// one: just this week, or every week). The rules are in rules.js, with tests.
//
// The events reach the views through Sessions' 'session.extra' slot, so they show in Day, Week,
// Month, Year, Upcoming and Up next, and count as busy for friends' Free/Busy, but they're never
// shared with friends and don't appear in Modules.
//
// Saved data (on this phone only):
//   'items' → [{ id, title, date: 'YYYY-MM-DD', start: 'HH:MM', end: 'HH:MM', place,
//               weekly, until: 'YYYY-MM-DD' or '', skip: ['YYYY-MM-DD', …] }]

import { Feature, ui, time } from 'folio';
import { problem, clean, sessionsFor, dateKey, repeatText } from './rules.js';

const { el } = ui;
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const pad = (n) => String(n).padStart(2, '0');

export default class OwnEvents extends Feature {
  start() {
    this.addHelp();
    this.sessions = this.use('sessions');
    this.items = this.storage.get('items', []);

    this.add('session.extra', {
      sessions: () => {
        const now = new Date();
        return sessionsFor(this.items, time.addDays(now, -200), time.addDays(now, 400));
      },
    });
    this.add('planner.buttons', {
      order: 5,
      render: () => el('button', {
        type: 'button',
        class: 'icon-btn',
        title: 'Add your own event',
        'aria-label': 'Add your own event',
        onclick: () => this.openForm(null),
      }, ui.icon('plus')),
    });
    this.add('session.details', { order: 5, render: (s, win) => (s.own ? this.details(s, win) : null) });
  }

  save() {
    this.storage.set('items', this.items);
    this.sessions.changed();
  }

  find(id) {
    return this.items.find((e) => e.id === id);
  }

  // ---- In the details window: how often, Edit and Delete ----

  details(s, win) {
    this.detailsWindow = win;
    const e = this.find(s.ownId);
    if (!e) return null;
    const repeat = repeatText(e);
    return el('div', { class: 'own-details' },
      el('p', { class: 'own-note' }, repeat ? `Your own event · ${repeat}` : 'Your own event'),
      el('div', { class: 'own-actions' },
        el('button', { type: 'button', class: 'btn', onclick: () => { this.detailsWindow?.close(); this.openForm(e); } }, 'Edit'),
        el('button', { type: 'button', class: 'btn danger', onclick: () => this.remove(e, s) }, 'Delete')));
  }

  remove(e, s) {
    if (e.weekly) {
      this.openDelete(e, s);
      return;
    }
    if (!confirm(`Delete "${e.title}"?`)) return;
    this.items = this.items.filter((x) => x.id !== e.id);
    this.detailsWindow?.close();
    this.save();
    ui.toast('Deleted.');
  }

  // A repeating event: delete just this week, or every week.
  openDelete(e, s) {
    if (!this.deleteBox) this.deleteBox = ui.dialog({ title: 'Delete', size: 'box' });
    const done = (text) => {
      this.deleteBox.close();
      this.detailsWindow?.close();
      this.save();
      ui.toast(text);
    };
    this.deleteBox.setContent(
      el('p', {}, `"${e.title}" repeats every week.`),
      el('div', { class: 'own-actions own-stack' },
        el('button', { type: 'button', class: 'btn', onclick: () => {
          e.skip = [...(e.skip || []), s.day];
          done(`Deleted ${time.formatDate(s.start, 'short')}.`);
        } }, `Just ${time.formatDate(s.start, 'short')}`),
        el('button', { type: 'button', class: 'btn danger', onclick: () => {
          this.items = this.items.filter((x) => x.id !== e.id);
          done('Deleted every week.');
        } }, 'Every week'),
        el('button', { type: 'button', class: 'btn', onclick: () => this.deleteBox.close() }, 'Cancel')));
    this.deleteBox.open();
  }

  // ---- The form ----

  // `e` is the event to change, or null for a new one (on the day the Planner is showing).
  openForm(e) {
    if (!this.form) this.form = ui.dialog({ title: 'Your event', className: 'own-dialog' });
    const day = this.sessions.selected || new Date();
    const hour = Math.min(new Date().getHours() + 1, 22);
    const v = e || { title: '', date: dateKey(day), start: `${pad(hour)}:00`, end: `${pad(hour + 1)}:00`, place: '', weekly: false, until: '' };
    const error = ui.errorBox();

    const title = el('input', { type: 'text', value: v.title, placeholder: 'e.g. Choir, Gym, Shift at work', maxlength: 80, 'aria-label': 'Name' });
    const date = el('input', { type: 'date', value: v.date, 'aria-label': 'Day' });
    const start = el('input', { type: 'time', value: v.start, step: 300, 'aria-label': 'Starts' });
    const end = el('input', { type: 'time', value: v.end, step: 300, 'aria-label': 'Ends' });
    const place = el('input', { type: 'text', value: v.place, placeholder: 'Optional', maxlength: 80, 'aria-label': 'Place (optional)' });
    const until = el('input', { type: 'date', value: v.until, 'aria-label': 'Last week (optional)' });
    const untilRow = el('label', { class: 'own-field', hidden: !v.weekly }, el('span', {}, 'Last week (optional)'), until);
    let weekly = !!v.weekly;
    const repeat = ui.toggle({ checked: weekly, label: 'Repeat every week', onChange: (on) => { weekly = on; untilRow.hidden = !on; } });

    // Moving the start keeps the length the same.
    let length = Math.max(15, minutes(v.end) - minutes(v.start));
    start.addEventListener('change', () => {
      if (minutes(start.value) == null) return;
      const m = Math.min(minutes(start.value) + length, 23 * 60 + 55);
      end.value = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    });
    end.addEventListener('change', () => {
      const l = minutes(end.value) - minutes(start.value);
      if (l > 0) length = l;
    });

    const form = el('form', {
      class: 'own-form',
      onsubmit: (ev) => {
        ev.preventDefault();
        const values = { title: title.value, date: date.value, start: start.value, end: end.value, place: place.value, weekly, until: until.value, skip: e?.skip };
        const wrong = problem(values);
        if (wrong) {
          error.show(wrong);
          return;
        }
        // Changing the first day of a repeating event starts its weeks again.
        if (e && e.date !== values.date) values.skip = [];
        const saved = clean(values, e ? e.id : newId());
        this.items = e ? this.items.map((x) => (x.id === e.id ? saved : x)) : [...this.items, saved];
        this.save();
        this.form.close();
        if (!e) this.sessions.select(new Date(`${saved.date}T12:00`));
        ui.toast(e ? 'Saved.' : 'Added to your Planner.');
      },
    },
    el('label', { class: 'own-field' }, el('span', {}, 'Name'), title),
    el('label', { class: 'own-field' }, el('span', {}, 'Day'), date),
    el('div', { class: 'own-row' },
      el('label', { class: 'own-field' }, el('span', {}, 'Starts'), start),
      el('label', { class: 'own-field' }, el('span', {}, 'Ends'), end)),
    el('label', { class: 'own-field' }, el('span', {}, 'Place'), place),
    el('div', { class: 'own-repeat' }, el('span', {}, 'Repeat every week'), repeat),
    untilRow,
    error,
    el('div', { class: 'own-actions' },
      el('button', { type: 'submit', class: 'btn primary' }, e ? 'Save' : 'Add'),
      el('button', { type: 'button', class: 'btn', onclick: () => this.form.close() }, 'Cancel')),
    el('p', { class: 'hint small' }, 'Saved on this phone only. Your friends don\'t see it.'));

    this.form.setTitle(e ? 'Edit your event' : 'New event');
    this.form.setContent(form);
    this.form.open();
    if (!e) setTimeout(() => title.focus(), 50);
  }

  // Questions and answers for the Help page.
  addHelp() {
    this.add('help.questions', {
      group: 'timetable', order: 60, question: 'Can I add my own things to the Planner?', answer: () => [
        'Yes. In the Planner, tap the + next to the Y M W D switch. Give it a name, a day and a time, and optionally a place, and switch on "Repeat every week" for things like a weekly society meeting.',
        'Your events are drawn as outlines so they stand out from your classes. Tap one to edit or delete it (for a repeating one, just that week or every week).',
        'They\'re saved on this phone only, and friends don\'t see them.',
      ],
    });
  }
}

function minutes(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text || '');
  return m ? +m[1] * 60 + +m[2] : null;
}
