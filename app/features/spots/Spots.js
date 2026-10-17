// Spots: the tab for places around Durham. For now, a card for each kind of place (cafés, pubs
// and clubs), each saying it's coming soon. Each card has a dark bar along the bottom; give a
// spot a `photo` (e.g. new URL('photos/cafes.jpg', import.meta.url).href) to show it in the bar,
// fading into the dark like the photo on Home. Also the Explore page at the top of Home
// (slot 'home.pages'), with a button that opens the Spots tab.
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
    this.add('views', {
      id: 'spots',
      label: 'Spots',
      icon: 'pin',
      order: 40,
      subtitle: () => 'Places around Durham',
      mount: (container) => container.append(el('div', { class: 'spot-cards' }, SPOTS.map((spot) => this.card(spot)))),
      render: () => {},
    });
    this.add('home.pages', {
      id: 'explore',
      order: 10,
      render: () => el('section', { 'aria-label': 'Explore' },
        el('h2', { class: 'home-page-title' }, 'Explore'),
        el('p', { class: 'home-page-line' }, 'Places to study, eat and meet around Durham.'),
        el('button', { type: 'button', class: 'home-button', onclick: () => this.app.shell.selectView('spots') },
          el('span', {}, el('b', {}, 'Open Spots'), el('small', {}, 'Cafés, pubs and clubs')),
          ui.icon('right'))),
    });
  }

  card(spot) {
    return el('button', { type: 'button', class: 'spot-card', onclick: () => this.toast(`${spot.label} are coming soon.`) },
      el('span', { class: 'spot-card-text' }, el('b', {}, spot.label), el('span', {}, spot.line)),
      el('span', { class: 'spot-card-bar', style: spot.photo ? `--photo: url("${encodeURI(spot.photo)}")` : null },
        el('span', {}, 'Coming soon'),
        ui.icon('right')));
  }
}
