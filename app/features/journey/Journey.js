// Plan your journey: the third page at the top of Home (slot 'home.pages'). Journey planning
// isn't built yet, so its button just says it's coming soon.
//
// Saved data: none.

import { Feature, ui } from 'folio';

const { el } = ui;

export default class Journey extends Feature {
  start() {
    this.add('home.pages', {
      id: 'journey',
      order: 20,
      render: () => el('section', { 'aria-label': 'Plan your journey' },
        el('h2', { class: 'home-page-title' }, 'Plan your journey'),
        el('p', { class: 'home-page-line' }, 'Getting to your next class, and back home.'),
        el('button', { type: 'button', class: 'home-button', onclick: () => this.toast('Plan your journey is coming soon.') },
          el('span', {}, el('b', {}, 'Plan a journey'), el('small', {}, 'Coming soon')),
          ui.icon('right'))),
    });
  }
}
