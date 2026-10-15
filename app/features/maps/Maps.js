// Maps: shows which building a session is in, a small map with a pin on it, and opens Google
// Maps when you tap the location. Buildings come from the 'places' service (Durham rooms) when
// it's installed, or from building names the person types in themselves.
//
// Saved data: 'typed' → { [building text]: full name }, 'area' → text added to map searches

import { Feature, ui } from 'folio';

const { el } = ui;
const ONLINE_RE = /\b(online|teams|zoom|virtual|remote|collaborate)\b/i;
const isPhysical = (location) => !!location && !/https?:\/\//.test(location) && !ONLINE_RE.test(location);

// The building part of a location: room codes like "CLC013" removed, as they confuse map
// searches. Locations that are only a code stay as they are.
function buildingOf(location) {
  const building = location.replace(/\b[A-Z]{1,5}\d{2,4}[A-Z]?\b/g, '').replace(/\s{2,}/g, ' ').replace(/[\s,;–-]+$/, '').trim();
  return building || location.trim();
}

export default class Maps extends Feature {
  start() {
    this.sessions = this.use('sessions');
    this.places = this.use('places'); // null if Durham rooms isn't installed
    this.typedNames = this.storage.get('typed', {});
    this.area = this.storage.get('area', '');
    this.importOldData();

    this.add('session.location', {
      label: (location) => this.label(location),
      link: (location) => this.link(location),
      linkLabel: (location) => (isPhysical(location) ? 'Directions' : undefined),
    });
    this.add('session.details', { order: 10, render: (s) => this.details(s), close: () => this.hideMap() });
    this.add('settings', { id: 'maps', title: 'Maps', order: 30, render: () => this.settingsSection() });
    this.on('timetable:cleared', () => {
      this.typedNames = {};
      this.area = '';
      this.storage.clear();
    });
  }

  // Before this app used Folio, these were saved in "tt.prefs".
  importOldData() {
    this.storage.once('import-from-v1', () => {
      const old = this.app.storage.rawJSON('tt.prefs', {}) || {};
      if (old.places) this.typedNames = { ...old.places, ...this.typedNames };
      if (old.mapsArea && !this.area) this.area = old.mapsArea;
      this.storage.set('typed', this.typedNames);
      this.storage.set('area', this.area);
    });
  }

  typed(location) {
    return isPhysical(location) ? this.typedNames[buildingOf(location)] || '' : '';
  }

  known(location) {
    return isPhysical(location) ? this.places?.lookup(location) || null : null;
  }

  // Location as shown on cards: the timetable's text, plus the building name when it adds something.
  label(location) {
    const full = this.typed(location).split(',')[0].trim() || this.known(location)?.building || '';
    return full && !location.toLowerCase().includes(full.toLowerCase()) ? `${location} · ${full}` : undefined;
  }

  link(location) {
    if (!isPhysical(location)) return undefined;
    const typed = this.typed(location);
    const known = this.known(location);
    let query;
    if (typed) {
      const area = this.area && !typed.toLowerCase().includes(this.area.toLowerCase()) ? this.area : '';
      query = [typed, area].filter(Boolean).join(', ');
    } else if (known) {
      // Coordinates put the pin exactly on the building rather than wherever a text search lands.
      query = `${known.lat},${known.lng}`;
    } else {
      query = [buildingOf(location), this.area].filter(Boolean).join(', ');
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  // ---- Session details ----

  details(s) {
    if (!isPhysical(s.location)) return null;
    const location = s.location;
    const detail = el('p', { class: 'ses-place-detail' });
    this.frame = el('iframe', { class: 'ses-map', title: 'Map', loading: 'lazy', referrerpolicy: 'no-referrer', hidden: true });
    const summary = el('summary');
    const input = el('input', { id: 'maps-building', type: 'text', autocomplete: 'off', placeholder: buildingOf(location) });
    input.value = this.typed(location);

    const update = () => {
      const typed = this.typed(location);
      const known = this.known(location);
      detail.textContent = known && !typed ? [known.room, `${known.building}, ${known.address}`].filter(Boolean).join(' · ') : '';
      detail.hidden = !detail.textContent;
      this.showMap(known && !typed ? known : null);
      summary.textContent = typed
        ? `Building: ${typed} (change)`
        : known ? 'Wrong building? Type the right one' : 'Unknown building? Type its full name';
    };
    input.addEventListener('input', () => {
      const name = input.value.trim();
      const building = buildingOf(location);
      if (name) this.typedNames[building] = name;
      else delete this.typedNames[building];
      this.storage.set('typed', this.typedNames);
      update();
      this.sessions.changed();
    });
    update();

    return el('div', { class: 'maps-details' },
      detail,
      this.frame,
      el('details', { class: 'place-edit' },
        summary,
        el('label', { class: 'label', for: 'maps-building' }, 'Full building name'),
        input,
        ui.hint('Used for directions and shown on every session in this building. Add the town if Maps still finds the wrong place.', { small: true })));
  }

  // A small OpenStreetMap preview with a pin on the building. Needs internet; hidden when offline.
  showMap(place) {
    const frame = this.frame;
    if (!frame) return;
    if (!place || !navigator.onLine) {
      frame.hidden = true;
      frame.removeAttribute('src');
      return;
    }
    const { lat, lng } = place;
    const box = [lng - 0.0013, lat - 0.0005, lng + 0.0013, lat + 0.0005].map((n) => n.toFixed(5)).join(',');
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${box}&layer=mapnik&marker=${lat},${lng}`;
    if (frame.getAttribute('src') !== src) frame.src = src;
    frame.title = `Map showing ${place.building}`;
    frame.hidden = false;
  }

  hideMap() {
    this.showMap(null);
  }

  // ---- Settings ----

  settingsSection() {
    const input = el('input', { id: 'maps-area', type: 'text', autocomplete: 'off', placeholder: 'e.g. your university\'s name and town' });
    input.value = this.area;
    input.addEventListener('input', () => {
      this.area = input.value.trim();
      this.storage.set('area', this.area);
    });
    return el('div', { class: 'group' },
      el('label', { class: 'label', for: 'maps-area' }, 'Area for map searches'),
      input,
      ui.hint('Added to map searches for buildings the app doesn\'t know, so Maps finds the right place.', { small: true }));
  }
}
