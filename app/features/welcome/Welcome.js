// Welcome: the first screen after installing the app, asking who it's for: "I'm a student" or
// "I run a business". Students go on to the app as it always was (the timetable setup screen
// first). Businesses get the business version: other features ask this feature's 'audience'
// service and leave out what's only for students (Planner, Study, More, Friends, Reminders and
// the timetable setup), and the shop feature takes them through linking their shop.
//
// People who already use the app never see the screen: the timetable feature says they're
// students when it finds a timetable on the phone (assume('student'), before the app is ready).
// Settings → "Using the app as" switches between the two at any time.
//
// Service 'audience':
//   kind            'student', 'business', or null while nobody has chosen yet
//   isBusiness()    true in the business version
//   isStudent()     true in the student version (also while nobody has chosen)
//   isFor(item)     whether a slot item belongs in this version: items say who they're for with
//                   `audience` ('business', 'everyone', or nothing for students only)
//   choose(kind)    switch to 'student' or 'business'
//   ask()           shows the welcome screen again
//   assume(kind)    sets the choice only if nobody has made one, without asking
// Event 'audience:changed': sent with { kind, first } when the choice changes; first is true
// when it was made on the welcome screen.
//
// Saved data: 'kind' → 'student' or 'business'.

import { Feature, ui } from 'folio';
import { KINDS, isFor } from './rules.js';

const { el } = ui;

export default class Welcome extends Feature {
  start() {
    this.kind = KINDS.includes(this.storage.get('kind')) ? this.storage.get('kind') : null;
    const feature = this;
    this.provide('audience', {
      get kind() { return feature.kind; },
      isBusiness: () => this.kind === 'business',
      isStudent: () => this.kind !== 'business',
      isFor: (item) => isFor(item, this.kind === 'business'),
      choose: (kind) => this.choose(kind),
      ask: () => this.show(),
      assume: (kind) => { if (!this.kind && KINDS.includes(kind)) this.save(kind); },
    });
    this.add('settings', { id: 'audience', title: 'Using the app as', order: 5, render: () => this.setting() });
    // On the timetable setup screen, a way back for a business that tapped Student by mistake.
    this.add('timetable.setup', {
      order: 90,
      render: () => el('div', {},
        el('b', {}, 'Not a student?'), ' ',
        el('button', { type: 'button', class: 'link-btn', onclick: () => this.choose('business', { first: true }) }, 'Set up your business instead')),
    });
    this.on('app:ready', () => { if (!this.kind) this.show(); });
  }

  save(kind) {
    this.kind = kind;
    this.storage.set('kind', kind);
  }

  choose(kind, { first = false } = {}) {
    if (!KINDS.includes(kind)) return;
    const changed = kind !== this.kind;
    this.save(kind);
    this.app.shell.hideScreen(this.id);
    if (changed || first) this.emit('audience:changed', { kind, first });
    this.app.shell.selectView('home', { quiet: true });
    this.refresh();
    this.app.shell.refreshSettings?.();
  }

  show() {
    const choice = (kind, title, line, icon) => el('button', { type: 'button', class: `welcome-choice welcome-${kind}`, onclick: () => this.choose(kind, { first: true }) },
      el('span', { class: 'welcome-icon', 'aria-hidden': 'true' }, ui.icon(icon)),
      el('span', { class: 'welcome-text' }, el('b', {}, title), el('span', {}, line)),
      ui.icon('right'));
    const node = el('div', { class: 'welcome' },
      el('div', { class: 'welcome-top' },
        el('p', { class: 'welcome-kicker' }, 'Welcome to'),
        el('h1', {}, this.app.config.name || 'Mobile Durham'),
        el('p', { class: 'welcome-line' }, 'By students, for students. Who are you using it as?')),
      el('div', { class: 'welcome-choices' },
        choice('student', "I'm a student", 'Your timetable, the library, study and deals around Durham', 'book'),
        choice('business', 'I run a business', 'Put your café, pub or club on Spots and keep your student deal up to date', 'pin')),
      ui.hint('You can change this later in Settings.', { small: true }));
    this.app.shell.showScreen(this.id, node);
  }

  setting() {
    return el('div', { class: 'welcome-setting' },
      ui.select([['student', 'A student'], ['business', 'A business']], { value: this.kind || 'student', id: 'welcome-kind', onChange: (value) => this.choose(value) }),
      ui.hint(this.kind === 'business'
        ? 'The business version: your shop on Home, and Spots. Planner, Study and More are left out.'
        : 'The student version: everything. Businesses get a simpler version for their place on Spots.', { small: true }));
  }
}
