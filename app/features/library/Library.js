// Library: a card on Home showing how busy Bill Bryson Library is, with free seats on each
// floor. Read from the library's public occupancy page every few minutes while the card is on
// screen. No booking.
//
// In the Android app the page is read directly. In the web version the university's server may
// block that (CORS), so it goes through the personal relay if one is set up.
//
// Saved data: 'show' → false if the card is switched off in Settings
//             'last' → { at, occupancy } the last reading, shown while a new one loads
//             'open' → true if the card is unfolded to show the floors

import { Feature, ui, time } from 'folio';
import { SOURCE, textOf, readOccupancy, busyness } from './occupancy.js';

const { el } = ui;
const FRESH = 5 * time.MINUTE;
const TOO_OLD = 2 * time.HOUR; // an older reading isn't shown as if it were current

export default class Library extends Feature {
  start() {
    this.show = this.storage.get('show', true);
    this.last = this.storage.get('last', null);
    this.loading = false;
    this.failed = null;
    this.tried = 0;
    this.open = this.storage.get('open', false);

    this.add('home.top', { order: 10, render: () => this.card() });
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

  // Folded (the default): name, how busy, free seats and a bar. Tap it to unfold the floors.
  // Folded or unfolded is remembered. Without a recent reading, Home shows "Missing content"
  // with the reason instead.
  card() {
    if (!this.show) return { missing: 'the library card is switched off', action: () => this.app.shell.openSettings() };
    if (!this.loading && Date.now() - this.tried > FRESH && navigator.onLine) this.load();

    const recent = this.last && Date.now() - this.last.at < TOO_OLD;
    if (!recent && !this.loading) {
      const blocked = this.failed === 'blocked' && navigator.onLine;
      return { missing: this.missingReason(), action: () => (blocked ? this.app.shell.openSettings() : this.load()) };
    }
    const o = recent ? this.last.occupancy : null;
    const band = o && busyness(o.free, o.seats);
    const summary = el('summary', { 'aria-label': o ? `Bill Bryson Library, ${band.label}, ${o.free} seats free` : 'Bill Bryson Library' },
      el('span', { class: 'lib-line' },
        el('span', { class: 'lib-name' }, 'Library'),
        band
          ? el('span', { class: `lib-tag ${band.id}` }, band.label)
          : el('span', { class: 'lib-free' }, 'Checking…'),
        o && el('span', { class: 'lib-free lib-push' }, el('strong', {}, o.free), ' seats free')),
      o && this.bar(o.free, o.seats));

    const check = el('button', {
      type: 'button', class: `icon-btn ghost lib-check${this.loading ? ' spin' : ''}`, 'aria-label': 'Check again',
      onclick: () => this.load(),
    }, ui.icon('refresh'));
    const status = o
      ? [`Bill Bryson Library · updated ${time.ago(this.last.at)}.`, this.failed && ` ${this.problem()}`]
      : [this.loading ? 'Checking how busy Bill Bryson Library is…' : this.problem()];

    const card = el('details', {
      class: 'lib-card',
      ontoggle: (e) => { this.open = e.target.open; this.storage.set('open', this.open); },
    },
      summary,
      el('div', { class: 'lib-status' }, el('div', { class: 'hint small' }, ...status.filter(Boolean)), check),
      ...(o ? o.floors.map((f) => this.floor(f)) : []),
      el('div', { class: 'lib-foot' }, this.pageLink()));
    card.open = this.open;
    return card;
  }

  floor(f) {
    const band = busyness(f.free, f.seats);
    return el('div', { class: 'lib-floor' },
      el('div', { class: 'lib-row' },
        el('b', {}, f.name),
        el('span', { class: `lib-count ${band.id}` }, `${f.free} free of ${f.seats}`)),
      this.bar(f.free, f.seats),
      el('div', { class: 'lib-zones hint small' },
        f.zones.map((z) => `${z.name} ${z.free}`).join(' · ')));
  }

  // A bar that fills up as the library fills up, with a dot where it ends and a dotted line
  // for the seats still free.
  bar(free, seats) {
    const taken = seats ? Math.round(100 * (1 - free / seats)) : 100;
    return el('span', { class: `lib-bar ${busyness(free, seats).id}`, role: 'img', 'aria-label': `${taken}% of seats taken` },
      el('i', { class: 'lib-fill', style: `width:${taken}%` }), el('i', { class: 'lib-dot' }), el('i', { class: 'lib-rest' }));
  }

  // Why there's no card: a few words for Home's "Missing content" box.
  missingReason() {
    if (!navigator.onLine) return "you're offline";
    if (this.failed === 'blocked') return 'the library site is blocked here (see Settings → Advanced)';
    if (this.failed === 'unreadable') return "couldn't read the library's page";
    return "couldn't reach the library's website";
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
      el('span', {}, 'Show how busy Bill Bryson Library is on Home'),
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
