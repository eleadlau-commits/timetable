// More: the tab with everything else. Other features add cards to it, such as the campus card.
// Each card has its name and a short line at the top and a dark bar along the bottom, the same
// style as the cards on Spots. The bar can show a photo later (`photo`), fading into the dark.
//
// Slot 'more.items': cards on the More tab.
//   Item: { id, label, order, detail?() → short text, photo?, onClick(), visible?() }
//
// Saved data: none.

import { Feature, ui } from 'folio';

const { el } = ui;

export default class More extends Feature {
  start() {
    this.defineSlot('more.items',
      'Cards on the More tab. Item: { id, label, order, detail?() → short text, photo? (an image address for the bar), onClick(), visible?() }.');
    this.add('views', {
      id: 'more',
      label: 'More',
      icon: 'dots',
      order: 50,
      subtitle: () => 'Everything else',
      mount: (container) => {
        this.box = el('div', { class: 'more-cards' });
        container.append(this.box);
      },
      render: () => this.render(),
    });
  }

  render() {
    const slot = this.slot('more.items');
    const cards = slot.items
      .filter((item) => slot.run(item, (x) => (x.visible ? x.visible() : true), false))
      .map((item) => el('button', { type: 'button', class: 'more-card', onclick: () => slot.run(item, (x) => x.onClick()) },
        el('span', { class: 'more-card-text' },
          el('b', {}, item.label),
          el('span', {}, slot.run(item, (x) => x.detail?.(), '') || '')),
        el('span', {
          class: 'more-card-bar',
          style: item.photo ? `--photo: url("${encodeURI(item.photo)}")` : null,
        }, ui.icon('right'))));
    this.box.replaceChildren(...(cards.length ? cards : [ui.missing('Nothing to show here yet.')]));
  }
}
