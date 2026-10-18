// Account: the account page, opened by the account button at the top right and the menu's
// Account row (Folio's 'account' slot). For now nobody can sign in: the page explains what an
// account will be for, says the app isn't Durham University's, and its "Sign in with Google"
// button says it's coming soon. Signing in (with Firebase) comes next.
//
// Saved data: none yet.

import { Feature, ui } from 'folio';

const { el } = ui;

export default class Account extends Feature {
  start() {
    this.user = null; // the signed-in person, once signing in works
    this.add('account', {
      name: () => this.user?.name || null,
      open: () => this.openWindow(),
    });
  }

  openWindow() {
    if (!this.window) this.window = ui.dialog({ title: 'Account', className: 'account-dialog' });
    this.window.setContent(this.signedOut());
    this.window.open();
  }

  signedOut() {
    return el('section', { class: 'account-out' },
      el('span', { class: 'account-avatar' }, ui.icon('account')),
      el('h3', {}, 'Not signed in'),
      el('p', {}, 'Sign in to back up your to-dos, notes and module colours, and to see your friends\' timetables. ',
        el('b', {}, 'Mobile Durham is made by students and isn\'t affiliated with Durham University.')),
      el('button', { type: 'button', class: 'btn primary block', onclick: () => this.toast('Signing in is coming soon.') },
        'Sign in with Google'),
      ui.hint('Coming soon. Everything works without an account, and your things stay on this phone.', { small: true }));
  }
}
