// Home: the tab the app opens on. The date and a large clock on the dark area, then cards from
// other features at the bottom of the screen. Home only draws the places; other features fill
// them. A place with nothing in it shows "Missing content", so the screen keeps its shape.
//
// Slots (item: { order, render() → element, or null to show nothing }):
//   'home.next'  short lines under the clock, e.g. "Next: Linear Algebra II · 16:00 · CG85"
//   'home.top'   full-width cards, e.g. the library
//   'home.main'  the large card on the left, e.g. the day's lectures
//   'home.side'  the narrow card on the right, e.g. the campus card
//
// Saved data: none.

import { Feature, ui, time } from 'folio';

const { el } = ui;

export default class Home extends Feature {
  start() {
    this.defineSlot('home.next', 'Short lines under the clock. Item: { order, render() → element or null }.');
    this.defineSlot('home.top', 'Full-width cards above the bottom pair. Item: { order, render() → element or null }.');
    this.defineSlot('home.main', 'The large card at the bottom left. Item: { order, render() → element or null }.');
    this.defineSlot('home.side', 'The narrow card at the bottom right. Item: { order, render() → element or null }.');
    this.timer = 0;

    this.add('views', {
      id: 'home',
      label: 'Home',
      icon: 'home',
      order: 20,
      start: true,
      hideTitle: true,
      mount: (container, { head }) => this.mount(container, head),
      render: () => this.render(),
    });
    this.on('app:resume', () => this.refresh());
  }

  mount(container, head) {
    this.date = el('div', { class: 'home-date' });
    this.clock = el('div', { class: 'home-clock' });
    this.next = el('div', { class: 'home-next' });
    head.append(el('section', { class: 'home-time', 'aria-label': 'Current time' }, this.date, this.clock, this.next));

    this.top = el('div', { class: 'home-top' });
    this.main = el('div', { class: 'home-main' });
    this.side = el('div', { class: 'home-side' });
    container.append(el('div', { class: 'home-space' }), this.top, el('div', { class: 'home-pair' }, this.main, this.side));
  }

  // The items of a slot, or a "Missing content" box if none of them has anything to show.
  fill(name, reason) {
    const items = this.slot(name).map((item) => item.render()).filter(Boolean);
    return items.length ? items : [ui.missing(reason)];
  }

  render() {
    const now = new Date();
    this.date.textContent = time.formatLongDate(now);
    // "15:13", or "3:13" with a small "PM" on phones set to 12-hour time.
    const parts = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).formatToParts(now);
    const period = parts.find((p) => p.type === 'dayPeriod')?.value;
    const digits = parts.filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim();
    this.clock.replaceChildren(...[digits, period && el('small', {}, period)].filter(Boolean));
    this.next.replaceChildren(...this.slot('home.next').map((item) => item.render()).filter(Boolean));
    this.top.replaceChildren(...this.fill('home.top', ''));
    this.main.replaceChildren(...this.fill('home.main', 'Nothing to show here yet.'));
    this.side.replaceChildren(...this.fill('home.side', ''));
    this.tickAtNextMinute(now);
  }

  // The app redraws once a minute, but not exactly when the minute changes. This keeps the
  // clock on time: one redraw just after each new minute, while Home is on screen.
  tickAtNextMinute(now) {
    clearTimeout(this.timer);
    const wait = time.MINUTE - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50;
    this.timer = setTimeout(() => {
      if (document.visibilityState === 'visible' && this.app.shell.currentView?.id === 'home') this.refresh();
    }, wait);
  }
}
