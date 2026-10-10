// Web relay (web version only): some university servers stop web pages from reading the
// timetable link directly (a browser rule called CORS). The person can run their own free relay
// (extras/worker.js, set up as in extras/README.md) and paste its address in Settings. When the
// direct download is blocked, the timetable is fetched through the relay instead.
//
// Service 'relay': { address, setPending(address) }
// Saved data: 'address' → the relay's web address

import { Feature, ui } from 'folio';

const { el } = ui;

export default class WebRelay extends Feature {
  start() {
    this.address = this.storage.get('address');
    this.importOldData();
    this.provide('relay', this);

    this.add('timetable.fetch', { order: 10, fetch: (link) => this.fetchThroughRelay(link) });
    this.add('timetable.explain', {
      explain: (err) => {
        if (err.status || !navigator.onLine) return undefined;
        return this.address
          ? "Couldn't reach your timetable, even through your relay. Check the relay address in Settings → Advanced: personal relay."
          : "Your university's server stopped this app from reading the link directly (a browser security rule). Either import the .ics file instead, or set up the free personal relay and add it under Settings → Advanced: personal relay.";
      },
    });
    this.add('settings', { id: 'relay', order: 80, render: () => this.settingsSection() });
  }

  // Before this app used Folio, the address was saved as "tt.relay".
  importOldData() {
    this.storage.once('import-from-v1', () => {
      const old = this.app.storage.raw('tt.relay');
      if (old && !this.address) {
        this.address = old;
        this.storage.set('address', old);
      }
    });
  }

  // A relay address that arrived with a QR code; it's used if the person loads that link.
  setPending(address) {
    if (!this.address) this.save(address);
  }

  save(raw) {
    const text = (raw || '').trim();
    if (!text) {
      this.address = null;
      this.storage.remove('address');
      return true;
    }
    try {
      const url = new URL(text);
      if (!/^https?:$/.test(url.protocol)) return false;
      this.address = url.href;
      this.storage.set('address', this.address);
      return true;
    } catch {
      return false;
    }
  }

  async fetchThroughRelay(link) {
    if (!this.address) return null;
    // The link goes in the body, not the address, so it doesn't end up in request logs.
    const res = await fetch(this.address, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: link, cache: 'no-store' });
    if (!res.ok) throw Object.assign(new Error('relay'), { status: res.status });
    return res.text();
  }

  settingsSection() {
    const input = el('input', {
      id: 'relay-address', type: 'url', inputmode: 'url', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      placeholder: 'https://timetable-relay.yourname.workers.dev',
    });
    input.value = this.address || '';
    const error = ui.errorBox();
    input.addEventListener('change', () => {
      error.show(this.save(input.value) ? null : 'The relay address should start with https://');
    });
    return el('details', { class: 'advanced' },
      el('summary', {}, 'Advanced: personal relay'),
      ui.hint('Some university servers stop web apps from reading the link directly. If loading says it was blocked, set up the free relay described in this feature\'s extras/README.md and paste its address here.'),
      input,
      error);
  }
}
