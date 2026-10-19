// Library: how busy Bill Bryson Library is. A thin row on Home (name, free seats, a bar) and a
// small folded bar on the Study tab (busy or not, free seats, a bar). Tap it for a full-screen pop-up with free seats on each floor.
// Read from the library's public occupancy page every few minutes while it's on screen. No booking.
//
// In the Android app the page is read directly. In the web version the university's server may
// block that (CORS), so it goes through the personal relay if one is set up.
//
// Saved data: 'show' → false if the card is switched off in Settings
//             'last' → { at, occupancy } the last reading, shown while a new one loads
//             'open' → no longer used (the card used to unfold in place; the floors are now in a pop-up)

import { Feature, ui, time } from 'folio';
import { SOURCE, textOf, readOccupancy, busyness } from './occupancy.js';

const { el } = ui;
const FRESH = 5 * time.MINUTE;

export default class Library extends Feature {
  start() {
    this.show = this.storage.get('show', true);
    this.last = this.storage.get('last', null);
    this.loading = false;
    this.failed = null;
    this.tried = 0;

    this.add('home.top', { order: 10, render: () => this.thin() });
    this.add('study.cards', { order: 10, render: () => this.folded('Bill Bryson Library') });
    this.add('settings', { id: 'library', title: 'Library', order: 70, render: () => this.settingsSection() });
  }

  async download() {
    try {
      return await this.getText(SOURCE);
    } catch {
      // Blocked or offline: try the relay below.
    }
    const relay = this.use('relay');
    if (relay?.address && relay.fetchThroughRelay) return relay.fetchThroughRelay(SOURCE);
    throw new Error(this.native || relay?.address ? 'unreachable' : 'blocked');
  }

  async load() {
    if (this.loading) return;
    this.loading = true;
    this.tried = Date.now();
    this.refresh();
    if (this.window?.isOpen) this.drawWindow();
    try {
      const occupancy = readOccupancy(textOf(await this.download()));
      if (!occupancy) throw new Error('unreadable');
      this.last = { at: Date.now(), occupancy };
      this.storage.set('last', this.last);
      this.failed = null;
    } catch (err) {
      this.failed = ['blocked', 'unreadable'].includes(err.message) ? err.message : 'unreachable';
    } finally {
      this.loading = false;
      this.refresh();
      if (this.window?.isOpen) this.drawWindow();
    }
  }

  // Loads a new reading when the last one is more than a few minutes old.
  freshen() {
    if (!this.loading && Date.now() - this.tried > FRESH && navigator.onLine) this.load();
  }

  // On the Study tab (and on Home before the first reading): a small folded bar with how busy
  // it is, the free seats and a bar. Tap it to open the floors.
  folded(name) {
    if (!this.show) return null;
    this.freshen();
    const o = this.last?.occupancy;
    const open = () => this.openWindow();
    if (!o) {
      return el('button', { type: 'button', class: 'missing lib-missing', onclick: open },
        el('b', {}, name),
        el('span', {}, this.loading ? 'Checking how busy Bill Bryson Library is…' : this.problem()));
    }
    const band = busyness(o.free, o.seats);
    return el('button', {
      type: 'button',
      class: 'lib-home',
      'aria-label': `Bill Bryson Library, ${band.label.toLowerCase()}, ${o.free} seats free. Show each floor`,
      onclick: open,
    },
      el('span', { class: 'lib-line' },
        el('b', {}, name),
        el('span', { class: `lib-tag ${band.id}` }, band.label),
        el('span', { class: 'lib-free' }, el('strong', {}, o.free), ' seats free')),
      this.bar(o.free, o.seats));
  }

  // On Home: one thin row with the name, the free seats and the bar. Tap it to open the floors.
  thin() {
    if (!this.show) return null;
    const o = this.last?.occupancy;
    if (!o) return this.folded('Library');
    return el('button', {
      type: 'button',
      class: 'lib-home lib-thin',
      'aria-label': `Bill Bryson Library, ${busyness(o.free, o.seats).label.toLowerCase()}, ${o.free} seats free. Show each floor`,
      onclick: () => this.openWindow(),
    },
      el('b', {}, 'Library'),
      el('span', { class: 'lib-free' }, el('strong', {}, o.free), ' seats free'),
      this.bar(o.free, o.seats));
  }

  openWindow() {
    if (!this.window) this.window = ui.dialog({ title: 'Bill Bryson Library' });
    this.freshen();
    this.drawWindow();
    this.window.open();
  }

  // The pop-up: the whole library and each floor, with when it was last checked.
  drawWindow() {
    const o = this.last?.occupancy;
    const band = o && busyness(o.free, o.seats);
    const check = el('button', {
      type: 'button', class: `icon-btn ghost lib-check${this.loading ? ' spin' : ''}`, 'aria-label': 'Check again',
      onclick: () => this.load(),
    }, ui.icon('refresh'));
    const status = o
      ? [`Updated ${time.ago(this.last.at)}.`, this.failed && ` ${this.problem()}`]
      : [this.loading ? 'Checking how busy Bill Bryson Library is…' : this.problem()];
    this.window.setContent(el('section', { class: 'lib-detail' },
      el('div', { class: 'lib-line' },
        band && el('span', { class: `lib-tag ${band.id}` }, band.label),
        el('span', { class: 'lib-free' }, o ? [el('strong', {}, o.free), ' seats free'] : '')),
      o && this.bar(o.free, o.seats),
      ...(o ? o.floors.map((f) => this.floor(f)) : []),
      el('div', { class: 'lib-status' }, el('div', { class: 'hint small' }, ...status.filter(Boolean)), check),
      el('div', { class: 'lib-foot' }, this.pageLink())));
  }

  floor(f) {
    const band = busyness(f.free, f.seats);
    const taken = f.seats ? Math.round(100 * (1 - f.free / f.seats)) : 100;
    return el('div', { class: 'lib-floor' },
      el('div', { class: 'lib-row' },
        el('b', {}, f.name),
        el('span', { class: `lib-mini ${band.id}`, role: 'img', 'aria-label': `${taken}% of seats taken` }, el('i', { style: `width:${taken}%` })),
        el('span', { class: 'lib-count' }, el('strong', {}, f.free), ` / ${f.seats}`)),
      f.zones.length > 1 && el('div', { class: 'lib-zones hint small' },
        f.zones.map((z) => `${z.name} ${z.free}`).join(' · ')));
  }

  // A bar that fills up as the library fills up, with a dot at the fill level and a dotted
  // line for the free part.
  bar(free, seats) {
    const taken = seats ? Math.round(100 * (1 - free / seats)) : 100;
    return el('span', { class: `lib-bar ${busyness(free, seats).id}`, role: 'img', 'aria-label': `${taken}% of seats taken` },
      el('i', { class: 'lib-fill', style: `width:${taken}%` }), el('i', { class: 'lib-dot' }), el('i', { class: 'lib-rest' }));
  }

  problem() {
    if (this.failed === 'blocked') {
      return "The library's website doesn't let the web version read it directly. Set up the personal relay (Settings → Advanced) to see it here.";
    }
    if (this.failed === 'unreadable') return "The library's page has changed, so the app couldn't read the numbers.";
    if (!navigator.onLine) return "You're offline.";
    return "Couldn't reach the library's website.";
  }

  pageLink() {
    return el('a', { href: SOURCE, target: '_blank', rel: 'noopener' }, 'Open the library\'s page');
  }

  settingsSection() {
    return el('label', { class: 'lib-setting' },
      el('span', {}, 'Show how busy Bill Bryson Library is, on Home and the Study tab'),
      ui.toggle({
        checked: this.show,
        label: 'Show the library card',
        onChange: (on) => {
          this.show = on;
          this.storage.set('show', on);
          this.refresh();
        },
      }));
  }
}
