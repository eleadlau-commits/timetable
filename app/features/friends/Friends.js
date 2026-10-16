// Friends: the Friends button in the top bar, left of the account button. There's no Friends
// screen yet, so tapping it just says it's coming soon.
//
// Saved data: none.

import { Feature } from 'folio';

export default class Friends extends Feature {
  start() {
    this.add('header.actions', {
      id: 'friends',
      label: 'Friends',
      icon: 'people',
      order: 10,
      onClick: () => this.toast('Friends is coming soon.'),
    });
  }
}
