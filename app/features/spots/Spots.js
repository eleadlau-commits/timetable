// Spots: a tab kept for later. It has nothing in it yet.
//
// Saved data: none.

import { Feature, ui } from 'folio';

const { el } = ui;

export default class Spots extends Feature {
  start() {
    this.add('views', {
      id: 'spots',
      label: 'Spots',
      icon: 'pin',
      order: 40,
      subtitle: () => '',
      mount: (container) => container.append(el('div', { class: 'empty' },
        el('b', {}, 'Coming soon'),
        el('div', {}, 'There\'s nothing here yet.'))),
      render: () => {},
    });
  }
}
