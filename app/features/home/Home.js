// Home: the tab the app opens on. At the top, on the dark area, small pages you swipe between
// (or pick with the dots under them): the first has the date and the clock; other features add
// more (Plan Today, Explore, Plan your journey). Behind them, a photo of Durham if there is one
// (photos/durham.jpg, or the one the person chose). Under that, widgets from other features on
// a grid, filling the screen down to the tab bar: Home doesn't scroll. The grid's rules (sizes,
// where each widget goes) are in grid.js. Home only draws the places; other features fill them.
// With no widgets at all, it shows "Missing content", so the screen keeps its shape.
//
// Slots:
//   'home.pages'   more pages at the top, after the clock, e.g. Plan Today. Item: { id, order, render() }
//                  Each page is one short row: a title and a line on the left, a button on the right:
//                  <section class="home-page-row"><div><h2 class="home-page-title">Explore</h2>
//                  <p class="home-page-line">…</p></div><button class="home-button"><b>Open</b>›</button></section>
//   'home.widgets' widgets for the grid. Item: { id, label, order, sizes: ['large', 'tall', …],
//                  start?, audience?, render(size) → element or null }. sizes lists the sizes it can be drawn
//                  in ('wide', 'tall', 'large'; see grid.js), the first being how it starts out.
//                  start: false leaves it off Home until someone adds it. render gets the size and
//                  should fill the space it's given.
//                  audience says which version of the app it's in (the welcome feature's
//                  'audience' service): nothing for the student version, 'business' for the
//                  business version, 'everyone' for both. Pages can say it too.
//   'home.layout'  the person's choices (from Customise Home). Only the first item is used.
//                  Item: { widgets() → [{ id, size }] in order, or undefined for the usual ones;
//                  photo() → a picture's address, or undefined for Home's own }
//   'home.tools'   small buttons on the dark area, at the right of the dots, e.g. Customise
//                  Home's pencil. Item: { id, label, icon, order, onClick() }
//
// Service 'home': widgets() → [{ id, label, sizes }], usual() → [{ id, size }] (what Home shows
// until someone chooses), rows() → how many rows fit on this phone, pack/fits (grid.js), and
// photo (the address of Home's own photo).
//
// Saved data: none. Home always opens on the first page.

import { Feature, ui, time } from 'folio';
import { Pages } from './pages.js';
import { pack, fits, rowsFor, SIZES } from './grid.js';

const { el } = ui;
// The photo behind the pages. Replace this file to change it (see photos/README.md); without
// it, the dark area simply has no photo.
const PHOTO = new URL('photos/durham.jpg', import.meta.url).href;

export default class Home extends Feature {
  start() {
    this.defineSlot('home.pages', 'More pages at the top of Home, swiped to after the clock. Item: { id, order, audience?: \'business\' or \'everyone\' (students only without it), render() → element or null }. One short row: use home-page-row, home-page-title, home-page-line and home-button.');
    this.defineSlot('home.widgets', "Widgets on Home's grid. Item: { id, label, order, sizes: ['wide' | 'tall' | 'large', …] (the first is how it starts), start?: false to leave it off until added, audience?: 'business' or 'everyone' (students only without it), render(size) → element or null }.");
    this.defineSlot('home.layout', "The person's choice of widgets and photo. Only the first item is used. Item: { widgets() → [{ id, size }] or undefined; photo() → address or undefined for Home's own }.");
    this.defineSlot('home.tools', 'Small buttons on the dark area of Home, at the right of the dots. Item: { id, label, icon, order, onClick() }.');
    this.timer = 0;
    this.rowCount = 8; // how many rows fit, measured once Home is on screen
    this.photoShown = undefined; // the address of the photo on screen

    this.provide('home', {
      photo: PHOTO,
      sizes: SIZES,
      widgets: () => this.widgetItems().map((w) => ({ id: w.id, label: w.label || w.id, sizes: w.sizes || [] })),
      usual: () => this.usual(),
      rows: () => this.rowCount,
      pack: (widgets) => pack(widgets, this.rowCount),
      fits: (widgets) => fits(widgets, this.rowCount),
    });

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
    this.on('audience:changed', () => this.refresh());
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
    this.tools = el('div', { class: 'home-tools' });
    this.pages.element.append(this.tools);
    this.photo = el('div', { class: 'home-photo', 'aria-hidden': 'true' });
    head.append(this.photo, this.pages.element);

    this.grid = el('div', { class: 'home-grid' });
    container.append(this.grid);
    // Counts the rows that fit whenever the space changes (a turned phone, a resized window).
    new ResizeObserver(() => {
      if (!this.grid.clientHeight) return; // Home isn't on screen
      const rows = rowsFor(this.grid.clientHeight);
      if (rows === this.rowCount) return;
      this.rowCount = rows;
      this.drawWidgets();
    }).observe(this.grid);
  }

  // Whether a widget or page belongs in this version of the app (student or business).
  isFor(item) {
    const audience = this.use('audience');
    if (audience) return audience.isFor(item);
    return item.audience !== 'business';
  }

  // The widgets for this version of the app.
  widgetItems() {
    return this.slot('home.widgets').items.filter((w) => this.isFor(w));
  }

  // The widgets Home shows until someone chooses: each in its first size, unless it says not.
  usual() {
    return this.widgetItems().filter((w) => w.start !== false && w.sizes?.length).map((w) => ({ id: w.id, size: w.sizes[0] }));
  }

  // The widgets to show ([{ id, size }]): the person's choice, or the usual ones.
  chosen() {
    const layout = this.slot('home.layout').items[0];
    const list = layout?.widgets ? this.slot('home.layout').run(layout, (l) => l.widgets()) : undefined;
    return Array.isArray(list) ? list : this.usual();
  }

  drawWidgets() {
    const slot = this.slot('home.widgets');
    const items = this.widgetItems();
    if (!items.length) {
      this.grid.style.gridTemplateRows = '';
      this.grid.replaceChildren(ui.missing('Nothing to show here yet.', { class: 'missing home-nothing' }));
      return;
    }
    const byId = new Map(items.map((w) => [w.id, w]));
    const wanted = this.chosen().filter((w) => byId.get(w.id)?.sizes?.includes(w.size));
    const { placed } = pack(wanted, this.rowCount, { stretch: true });
    this.grid.style.gridTemplateRows = `repeat(${this.rowCount}, minmax(0, 1fr))`;
    this.grid.replaceChildren(...placed.map((p) => {
      const drawn = slot.run(byId.get(p.id), (w) => w.render(p.size));
      return drawn && el('div', {
        class: `home-widget home-${p.size}`,
        'data-widget': p.id,
        style: `grid-area: ${p.row + 1} / ${p.col + 1} / span ${p.rows} / span ${p.cols}`,
      }, drawn);
    }).filter(Boolean));
  }

  render() {
    const now = new Date();
    this.date.textContent = time.formatLongDate(now);
    // "15:13", or "3:13" with a small "PM" on phones set to 12-hour time.
    const parts = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).formatToParts(now);
    const period = parts.find((p) => p.type === 'dayPeriod')?.value;
    const digits = parts.filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim();
    this.clock.replaceChildren(...[digits, period && el('small', {}, period)].filter(Boolean));
    this.pages.setPages([this.first, ...this.slot('home.pages').map((page) => (this.isFor(page) ? page.render() : null)).filter(Boolean)]);
    this.drawWidgets();
    this.drawTools();
    this.showPhoto();
    this.tickAtNextMinute(now);
  }

  drawTools() {
    const tools = this.slot('home.tools').items;
    this.pages.element.classList.toggle('has-tools', tools.length > 0);
    this.tools.replaceChildren(...tools.map((t) => el('button', {
      type: 'button', class: 'home-tool', 'aria-label': t.label, title: t.label,
      onclick: () => this.slot('home.tools').run(t, (x) => x.onClick()),
    }, ui.icon(t.icon))));
  }

  // The photo the person chose, or Home's own.
  showPhoto() {
    const layout = this.slot('home.layout').items[0];
    const url = (layout?.photo && this.slot('home.layout').run(layout, (l) => l.photo())) || PHOTO;
    if (url === this.photoShown) return;
    this.photoShown = url;
    const img = new Image();
    img.onload = () => {
      if (url !== this.photoShown) return; // another photo was chosen meanwhile
      this.photo.style.backgroundImage = `url("${url}")`;
      this.photo.classList.add('shown');
    };
    // Without the file, there's simply no photo.
    img.onerror = () => { if (url === this.photoShown) this.photo.classList.remove('shown'); };
    img.src = url;
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
