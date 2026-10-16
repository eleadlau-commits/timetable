// Help and feedback: the Help and Feedback rows in the menu. Neither is built yet, so tapping
// either just says it's coming soon.
//
// Saved data: none.

import { Feature } from 'folio';

export default class Help extends Feature {
  start() {
    this.add('header.buttons', {
      id: 'help',
      label: 'Help',
      icon: 'help',
      order: 70,
      onClick: () => this.toast('Help is coming soon.'),
    });
    this.add('header.buttons', {
      id: 'feedback',
      label: 'Feedback',
      icon: 'chat',
      order: 90,
      onClick: () => this.toast('Feedback is coming soon.'),
    });
  }
}
