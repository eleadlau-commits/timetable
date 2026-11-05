// Explore: the tab for things to discover around Durham (it used to be the Spots tab). Big cards,
// one for each thing, added by other features: Spots (cafés, pubs and clubs, with student deals)
// and Societies. Each card has its name and a short line at the top, and a dark bar along the
// bottom with a short detail (e.g. "2 student deals on now"); tapping it opens that feature's
// own full-screen window.
//
// Slot 'explore.cards': the cards on the tab.
//   Item: { id, label, line, order, onClick(), detail?() → short text for the bar, photo? (an
//   image address for the bar, fading into the dark), homeLine?() → a short line for the Explore
//   page on Home (the first card that gives one is used), visible?() → false to hide it }.
//
// Also the Explore page at the top of Home (slot 'home.pages', in both versions of the app), with
// a button that opens the tab.
//
// Saved data: none.

import { Feature, ui } from 'folio';
import { cardsToShow } from './rules.js';

const { el } = ui;

export default class Explore extends Feature {
  start() {
    this.defineSlot('explore.cards',
      'Cards on the Explore tab. Item: { id, label, line, order, onClick(), detail?() → short text for the dark bar, photo? (image address), visible?() }.');
    this.add('views', {
      id: 'explore',
      label: 'Explore',
      icon: 'pin',
      order: 40,
      subtitle: () => 'Around Durham',
      mount: (container) => {
        this.box = el('div', { class: 'explore-cards' });
        container.append(this.box);
      },
      render: () => this.render(),
    });
    this.add('home.pages', {
      id: 'explore-tab',
      order: 10,
      audience: 'everyone',
      render: () => el('section', { class: 'home-page-row', 'aria-label': 'Explore' },
        el('div', {},
          el('h2', { class: 'home-page-title' }, 'Explore'),
          el('p', { class: 'home-page-line' }, this.homeLine())),
        el('button', { type: 'button', class: 'home-button', onclick: () => this.app.shell.selectView('explore') },
          el('b', {}, 'Open Explore'), ui.icon('right'))),
    });
  }

  // A line for Home: the first card's own line (e.g. '2 student deals on now'), or the cards' names.
  homeLine() {
    const slot = this.slot('explore.cards');
    const cards = cardsToShow(slot.items);
    for (const card of cards) {
      const line = slot.run(card, (c) => c.homeLine?.(), '');
      if (line) return line;
    }
    return cards.length ? cards.map((c) => c.label).join(', ') : 'Around Durham';
  }

  render() {
    if (!this.box) return;
    const slot = this.slot('explore.cards');
    const cards = cardsToShow(slot.items).map((card) => el('button', {
      type: 'button', class: 'explore-card', onclick: () => slot.run(card, (c) => c.onClick()),
    },
      el('span', { class: 'explore-card-text' },
        el('b', {}, card.label),
        card.line && el('span', {}, card.line)),
      el('span', { class: 'explore-card-bar', style: card.photo ? `--photo: url("${encodeURI(card.photo)}")` : null },
        el('span', {}, slot.run(card, (c) => c.detail?.(), '') || ''),
        ui.icon('right'))));
    this.box.replaceChildren(...(cards.length ? cards : [ui.missing('Things to explore')]));
  }
}
