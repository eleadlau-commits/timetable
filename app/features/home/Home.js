// Home: the screen the app opens on. Its own header (menu, friends, account), today's date, a
// big clock, and below a flexible gap, places where other features add cards.
//
// Slots it defines (each item: { order, render() }; render gives back an element, what's
// missing as a short text or { missing, action?() }, or null):
//   home.next   the line under the clock
//   home.top    a wide card above the bottom block (the library)
//   home.main   the left column of the bottom block (date strip and lecture card)
//   home.side   the narrow right column of the bottom block (campus card)
// A place with nothing to show gets a "Missing content" placeholder, so the layout keeps its
// shape.
//
// Uses, if present: the 'friends' service ({ open() }) for the Friends button.
// Saved data: none.

import { Feature, ui, time } from 'folio';
import { clockParts, slotContent, missingText } from './clock.js';

const { el } = ui;

export default class Home extends Feature {
  start() {
    this.defineSlot('home.next',
      'The line under the clock on Home. Item: { order, render() → element; or what is missing, as text or { missing, action?() }; or null }.');
    this.defineSlot('home.top',
      'A wide card on Home, above the bottom block. Item: { order, render() → element; or what is missing, as text or { missing, action?() }; or null }.');
    this.defineSlot('home.main',
      'The left column of the bottom block on Home. Item: { order, render() → element; or what is missing, as text or { missing, action?() }; or null }.');
    this.defineSlot('home.side',
      'The narrow right column of the bottom block on Home. Item: { order, render() → element; or what is missing, as text or { missing, action?() }; or null }.');
    this.add('views', {
      id: 'home',
      label: 'Home',
      icon: 'house',
      order: 20,
      default: true,
      topBar: false,
      mount: (container) => this.mount(container),
      render: () => this.render(),
    });
  }

  // ---- Layout ----

  mount(container) {
    this.friends = el('button', { type: 'button', class: 'home-btn', 'aria-label': 'Friends', onclick: () => this.use('friends')?.open() }, ui.icon('people'));
    this.date = el('div', { class: 'home-date' });
    this.clock = el('div', { class: 'home-clock', role: 'timer', 'aria-live': 'off' });
    this.places = {
      'home.next': el('div', { class: 'home-next' }),
      'home.top': el('div', { class: 'home-top' }),
      'home.main': el('div', { class: 'home-main' }),
      'home.side': el('div', { class: 'home-side' }),
    };
    container.append(el('div', { class: 'home' },
      el('header', { class: 'home-head' },
        el('button', { type: 'button', class: 'home-btn home-menu', 'aria-label': 'Menu', onclick: () => this.openMenu() }, ui.icon('menu')),
        el('div', { class: 'home-head-right' },
          this.friends,
          el('button', { type: 'button', class: 'home-btn home-account', 'aria-label': 'Account and settings', onclick: () => this.app.shell.openSettings() }, ui.icon('person')))),
      el('section', { class: 'home-now', 'aria-label': 'Now' }, this.date, this.clock, this.places['home.next']),
      el('div', { class: 'home-gap' }),
      this.places['home.top'],
      el('div', { class: 'home-block' }, this.places['home.main'], this.places['home.side'])));
  }

  render() {
    const now = new Date();
    this.friends.hidden = !this.use('friends');
    this.date.textContent = time.formatLongDate(now);
    const { time: hhmm, period } = clockParts(now);
    this.clock.replaceChildren(hhmm, period && el('small', {}, period));
    this.clock.setAttribute('aria-label', time.formatTime(now));
    for (const [name, box] of Object.entries(this.places)) this.fill(name, box);
  }

  // Draws a slot's items, or a placeholder if none of them has anything to show.
  fill(name, box) {
    const slot = this.slot(name);
    const { shown, missing, action } = slotContent(slot.items.map((item) => slot.run(item, (x) => x.render(), null)));
    box.classList.toggle('is-missing', !shown.length);
    if (shown.length) box.replaceChildren(...shown);
    else if (action) box.replaceChildren(el('button', { type: 'button', class: 'home-missing', onclick: () => action() }, missingText(missing)));
    else box.replaceChildren(el('div', { class: 'home-missing' }, missingText(missing)));
  }

  // ---- Menu: the buttons that used to be in the top bar ----

  openMenu() {
    if (!this.menu) this.menu = ui.dialog({ title: 'Menu', className: 'home-menu-window' });
    this.renderMenu();
    this.menu.open();
  }

  renderMenu() {
    const slot = this.slot('header.buttons');
    const status = this.slot('header.status').map((s) => s.text()).filter(Boolean);
    if (!navigator.onLine) status.push('offline');
    const rows = slot.map((b) => {
      if (b.visible && !b.visible()) return null;
      return el('button', {
        type: 'button',
        class: `home-menu-row${b.busy?.() ? ' spin' : ''}`,
        onclick: () => {
          this.menu.close();
          slot.run(b, (x) => x.onClick());
        },
      }, ui.icon(b.icon || 'plus'), el('span', {}, b.label));
    });
    this.menu.setContent(
      status.length > 0 && ui.hint(status.join(' · '), { small: true }),
      el('div', { class: 'home-menu-list' }, rows.length ? rows : ui.hint('Nothing here yet.')));
  }
}
