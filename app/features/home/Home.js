// Home: the tab the app opens on. At the top, on the dark area, small pages you swipe between
// (or pick with the dots under them): the first has the date and the clock; other features add
// more (Plan Today, Explore, Plan your journey). Behind them, a photo of Durham if there is one
// (photos/durham.jpg). Under that, cards from other features, filling the screen down to the
// tab bar: Home doesn't scroll. Home only draws the places; other features fill them. A card
// place with nothing in it shows "Missing content", so the screen keeps its shape.
//
// Slots (item: { order, render() → element, or null to show nothing }):
//   'home.pages' more pages at the top, after the clock, e.g. Plan Today. Item: { id, order, render() }
//                Each page is one short row: a title and a line on the left, a button on the right:
//                <section class="home-page-row"><div><h2 class="home-page-title">Explore</h2>
//                <p class="home-page-line">…</p></div><button class="home-button"><b>Open</b>›</button></section>
//   'home.top'   full-width cards, e.g. the library
//   'home.main'  the large card on the left, e.g. today's lectures; it gets all the height left
//   'home.side'  the narrow card on the right, e.g. the campus card
//
// Saved data: none. Home always opens on the first page.

import { Feature, ui, time } from 'folio';
import { Pages } from './pages.js';

const { el } = ui;
// The photo behind the pages. Replace this file to change it (see photos/README.md); without
// it, the dark area simply has no photo.
const PHOTO = new URL('photos/durham.jpg', import.meta.url).href;

export default class Home extends Feature {
  start() {
    this.defineSlot('home.pages', 'More pages at the top of Home, swiped to after the clock. Item: { id, order, render() → element or null }. One short row: use home-page-row, home-page-title, home-page-line and home-button.');
    this.defineSlot('home.top', 'Full-width cards above the bottom pair. Item: { order, render() → element or null }.');
    this.defineSlot('home.main', 'The large card at the bottom left, as tall as the space left. Item: { order, render() → element or null }.');
    this.defineSlot('home.side', 'The narrow card at the bottom right. Item: { order, render() → element or null }.');
    this.timer = 0;

    this.add('views', {
      id: 'home',
      label: 'Home',
      icon: 'home',
      order: 20,
      start: true,
      darkHead: true,
      hideTitle: true,
      mount: (container, { head }) => this.mount(container, head),
      render: () => this.render(),
    });
    this.on('app:resume', () => {
      this.pages?.go(0); // back to the first page whenever the app comes back
      this.refresh();
    });
  }

  mount(container, head) {
    this.date = el('div', { class: 'home-date' });
    this.clock = el('div', { class: 'home-clock' });
    this.first = el('section', { class: 'home-time', 'aria-label': 'Current time' }, this.date, this.clock);
    this.pages = new Pages();
    this.photo = el('div', { class: 'home-photo', 'aria-hidden': 'true' });
    head.append(this.photo, this.pages.element);
    this.loadPhoto();

    this.top = el('div', { class: 'home-top' });
    this.main = el('div', { class: 'home-main' });
    this.side = el('div', { class: 'home-side' });
    container.append(this.top, el('div', { class: 'home-pair' }, this.main, this.side));
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
    this.pages.setPages([this.first, ...this.slot('home.pages').map((page) => page.render()).filter(Boolean)]);
    this.top.replaceChildren(...this.fill('home.top', ''));
    this.main.replaceChildren(...this.fill('home.main', 'Nothing to show here yet.'));
    this.side.replaceChildren(...this.fill('home.side', ''));
    this.tickAtNextMinute(now);
  }

  // Shows the photo once it has loaded. If there's no photo file, nothing changes.
  loadPhoto() {
    const img = new Image();
    img.onload = () => {
      this.photo.style.backgroundImage = `url("${PHOTO}")`;
      this.photo.classList.add('shown');
    };
    img.src = PHOTO;
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
