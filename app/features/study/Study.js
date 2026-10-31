// Study: the tab for places to study. It only draws the place; other features add cards to it,
// such as Library (how busy Bill Bryson Library is).
//
// Slot 'study.cards': cards on the Study tab. Item: { order, render() → element, or null }.
//
// Saved data: none.

import { Feature, ui } from 'folio';

const { el } = ui;

export default class Study extends Feature {
  start() {
    this.defineSlot('study.cards', 'Cards on the Study tab. Item: { order, render() → element or null }.');
    this.add('views', {
      id: 'study',
      label: 'Study',
      icon: 'book',
      order: 5,
      visible: () => !this.use('audience')?.isBusiness(), // not in the business version
      subtitle: () => 'Places to study',
      mount: (container) => {
        this.box = el('div', { class: 'study-cards' });
        container.append(this.box);
      },
      render: () => {
        const cards = this.slot('study.cards').map((card) => card.render()).filter(Boolean);
        this.box.replaceChildren(...(cards.length ? cards : [ui.missing('Nothing to show here yet.')]));
      },
    });
  }
}
