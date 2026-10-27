// Spots: the tab for places around Durham. A card for each kind of place (cafés, pubs and
// clubs). Each card has a dark bar along the bottom; give a spot a `photo` (e.g.
// new URL('photos/cafes.jpg', import.meta.url).href) to show it in the bar, fading into the
// dark like the photo on Home. Also the Explore page at the top of Home (slot 'home.pages'),
// with a button that opens the Spots tab.
//
// The places themselves come from the 'spots.places' slot (the listings feature, from the
// online database). Without it, or while a kind has no places, its card says it's coming soon.
// Above the cards, a Student deals section lists every place with a deal on now.
//
// Slot 'spots.places': where the places come from. Only the first item is used.
//   Item: { places(kind) → [place], deals() → [place], update?() }
//   kind is 'cafes', 'pubs' or 'clubs'; place is { id, name, line?, deal?, until?, address?, link? }
//   (deal: what the deal is, only while it's on; until: e.g. "Until 30 Nov"; link: https only).
//   update() is called whenever the tab is drawn, so the places can be fetched again if old.
//
// Saved data: none.

import { Feature, ui } from 'folio';

const { el } = ui;

const SPOTS = [
  { id: 'cafes', label: 'Cafés', line: 'Coffee, cake and somewhere to sit', photo: null },
  { id: 'pubs', label: 'Pubs', line: 'A drink and a catch-up', photo: null },
  { id: 'clubs', label: 'Clubs', line: 'Nights out in Durham', photo: null },
];

export default class Spots extends Feature {
  start() {
    this.defineSlot('spots.places',
      "Places on the Spots tab. Only the first item is used. Item: { places(kind) → [{ id, name, line?, deal?, until?, address?, link? }], deals() → places with a deal on now, update?() }, kind 'cafes', 'pubs' or 'clubs'.");
    this.add('views', {
      id: 'spots',
      label: 'Spots',
      icon: 'pin',
      order: 40,
      subtitle: () => 'Places around Durham',
      mount: (container) => {
        this.box = el('div', { class: 'spot-tab' });
        container.append(this.box);
      },
      render: () => this.render(),
    });
    this.add('home.pages', {
      id: 'explore',
      order: 10,
      render: () => {
        const deals = this.deals().length;
        return el('section', { class: 'home-page-row', 'aria-label': 'Explore' },
          el('div', {},
            el('h2', { class: 'home-page-title' }, 'Explore'),
            el('p', { class: 'home-page-line' }, deals ? `${deals} student ${deals === 1 ? 'deal' : 'deals'} on now` : 'Cafés, pubs and clubs')),
          el('button', { type: 'button', class: 'home-button', onclick: () => this.app.shell.selectView('spots') },
            el('b', {}, 'Open Spots'), ui.icon('right')));
      },
    });
  }

  // ---- Where the places come from ----

  get source() {
    return this.slot('spots.places').items[0] || null;
  }

  places(kind) {
    const list = this.slot('spots.places').first((item) => item.places(kind));
    return Array.isArray(list) ? list : [];
  }

  deals() {
    const list = this.slot('spots.places').first((item) => item.deals());
    return Array.isArray(list) ? list : [];
  }

  // ---- The tab ----

  render() {
    if (!this.box) return;
    if (this.source?.update) this.slot('spots.places').run(this.source, (item) => item.update());
    const deals = this.deals();
    this.box.replaceChildren(
      deals.length ? el('section', { class: 'spot-deals', 'aria-label': 'Student deals' },
        el('h2', { class: 'sub-head' }, 'Student deals'),
        el('div', { class: 'spot-places' }, deals.map((place) => this.place(place)))) : null,
      el('div', { class: 'spot-cards' }, SPOTS.map((spot) => this.card(spot))));
    // A window that's open shows the places as they are now.
    if (this.window?.isOpen && this.showing) this.fill(this.showing);
  }

  card(spot) {
    const n = this.places(spot.id).length;
    return el('button', { type: 'button', class: 'spot-card', onclick: () => this.openKind(spot) },
      el('span', { class: 'spot-card-text' }, el('b', {}, spot.label), el('span', {}, spot.line)),
      el('span', { class: 'spot-card-bar', style: spot.photo ? `--photo: url("${encodeURI(spot.photo)}")` : null },
        el('span', {}, n ? `${n} ${n === 1 ? 'place' : 'places'}` : 'Coming soon'),
        ui.icon('right')));
  }

  // One place: its name and line, the deal if there is one, where it is, and its website.
  place(place) {
    return el('article', { class: 'spot-place' },
      el('div', { class: 'spot-place-head' },
        el('b', {}, place.name),
        place.line && el('span', {}, place.line)),
      place.deal && el('p', { class: 'spot-deal' },
        el('span', { class: 'spot-deal-tag' }, 'Deal'),
        el('span', {}, place.deal),
        place.until && el('small', {}, place.until)),
      (place.address || place.link) && el('div', { class: 'spot-place-foot' },
        place.address && el('span', { class: 'spot-place-where' }, ui.icon('pin'), place.address),
        place.link && el('a', { class: 'btn small', href: place.link, target: '_blank', rel: 'noopener' }, 'Website')));
  }

  openKind(spot) {
    if (!this.places(spot.id).length) {
      this.toast(`${spot.label} are coming soon.`);
      return;
    }
    if (!this.window) this.window = ui.dialog({ title: spot.label, className: 'spot-dialog', onClose: () => { this.showing = null; } });
    this.showing = spot;
    this.fill(spot);
    this.window.open();
  }

  fill(spot) {
    const places = this.places(spot.id);
    this.window.setTitle(spot.label);
    this.window.setContent(places.length
      ? el('div', { class: 'spot-places' }, places.map((place) => this.place(place)))
      : ui.missing(`${spot.label} to show`));
  }
}
