// Plan your journey: the last page at the top of Home (slot 'home.pages'), "Plan a journey".
// Journey planning isn't built yet, so its Soon button just says it's coming soon.
//
// Saved data: none.

import { Feature, ui } from 'folio';

const { el } = ui;

export default class Journey extends Feature {
  start() {
    this.add('home.pages', {
      id: 'journey',
      order: 20,
      render: () => el('section', { class: 'home-page-row', 'aria-label': 'Plan your journey' },
        el('div', {},
          el('h2', { class: 'home-page-title' }, 'Plan a journey'),
          el('p', { class: 'home-page-line' }, 'To your next class, and back home')),
        el('button', { type: 'button', class: 'home-button', onclick: () => this.toast('Plan your journey is coming soon.') },
          el('b', {}, 'Soon'), ui.icon('right'))),
    });
  }
}
