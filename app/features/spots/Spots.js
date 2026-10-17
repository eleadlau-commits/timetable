// Spots: a tab kept for later. It has nothing in it yet. Also the Explore page at the top of
// Home (slot 'home.pages'), with a button that opens the Spots tab.
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
    this.add('home.pages', {
      id: 'explore',
      order: 10,
      render: () => el('section', { 'aria-label': 'Explore' },
        el('h2', { class: 'home-page-title' }, 'Explore'),
        el('p', { class: 'home-page-line' }, 'Places to study, eat and meet around Durham.'),
        el('button', { type: 'button', class: 'home-button', onclick: () => this.app.shell.selectView('spots') },
          el('span', {}, el('b', {}, 'Open Spots'), el('small', {}, 'Coming soon')),
          ui.icon('right'))),
    });
  }
}
