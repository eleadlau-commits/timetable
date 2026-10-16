// Library: how busy Bill Bryson Library is. A card on Home (busy or not, free seats, a bar) and
// a card on the Study tab with free seats on each floor. Read from the library's public
// occupancy page every few minutes while a card is on screen. No booking.
//
// In the Android app the page is read directly. In the web version the university's server may
// block that (CORS), so it goes through the personal relay if one is set up.
//
// Saved data: 'show' → false if the card is switched off in Settings
//             'last' → { at, occupancy } the last reading, shown while a new one loads
//             'open' → no longer used (the card used to fold; the floors are now on the Study tab)

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

    this.add('home.top', { order: 10, render: () => this.homeCard() });
    this.add('study.cards', { order: 10, render: () => this.studyCard() });
    this.add('settings', { id: 'library', title: 'Library', order: 70, render: () => this.settingsSection() });
  }

  async download() {
    try {
      const res = await fetch(SOURCE, { cache: 'no-store' });
      if (res.ok) return await res.text();
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
    }
  }

  // Loads a new reading when the last one is more than a few minutes old.
  freshen() {
    if (!this.loading && Date.now() - this.tried > FRESH && navigator.onLine) this.load();
  }

  // On Home: one card with how busy it is, the free seats and a bar. Tap it to see the floors.
  homeCard() {
    if (!this.show) return null;
    this.freshen();
    const o = this.last?.occupancy;
    const openStudy = () => this.app.shell.selectView('study');
    if (!o) {
      return el('button', { type: 'button', class: 'missing lib-missing', onclick: openStudy },
        el('b', {}, 'Library'),
        el('span', {}, this.loading ? 'Checking how busy Bill Bryson Library is…' : this.problem()));
    }
    const band = busyness(o.free, o.seats);
    return el('button', {
      type: 'button',
      class: 'lib-home',
      'aria-label': `Bill Bryson Library, ${band.label.toLowerCase()}, ${o.free} seats free`,
      onclick: openStudy,
    },
      el('span', { class: 'lib-line' },
        el('b', {}, 'Library'),
        el('span', { class: `lib-tag ${band.id}` }, band.label),
        el('span', { class: 'lib-free' }, el('strong', {}, o.free), ' seats free')),
      this.bar(o.free, o.seats));
  }

  // On the Study tab: the whole library and each floor, with when it was last checked.
  studyCard() {
    if (!this.show) return null;
    this.freshen();
    const o = this.last?.occupancy;
    const band = o && busyness(o.free, o.seats);
    const check = el('button', {
      type: 'button', class: `icon-btn ghost lib-check${this.loading ? ' spin' : ''}`, 'aria-label': 'Check again',
      onclick: () => this.load(),
    }, ui.icon('refresh'));
    const status = o
      ? [`Updated ${time.ago(this.last.at)}.`, this.failed && ` ${this.problem()}`]
      : [this.loading ? 'Checking how busy Bill Bryson Library is…' : this.problem()];
    return el('section', { class: 'lib-card' },
      el('div', { class: 'lib-line' },
        el('b', {}, 'Bill Bryson Library'),
        band && el('span', { class: `lib-tag ${band.id}` }, band.label),
        el('span', { class: 'lib-free' }, o ? [el('strong', {}, o.free), ' free'] : '')),
      o && this.bar(o.free, o.seats),
      ...(o ? o.floors.map((f) => this.floor(f)) : []),
      el('div', { class: 'lib-status' }, el('div', { class: 'hint small' }, ...status.filter(Boolean)), check),
      el('div', { class: 'lib-foot' }, this.pageLink()));
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
