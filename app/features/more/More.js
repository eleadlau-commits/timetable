// More: a tab that says what's coming. It has no content yet.
//
// Saved data: none.

import { Feature, ui } from 'folio';

const { el } = ui;

export default class More extends Feature {
  start() {
    this.add('views', {
      id: 'more',
      label: 'More',
      icon: 'dots',
      order: 40,
      mount: (container) => container.append(el('div', { class: 'empty' },
        el('b', {}, 'Coming soon'),
        el('div', {}, 'More features will be here.'))),
      render: () => {},
    });
  }
}
