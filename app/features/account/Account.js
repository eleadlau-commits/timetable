// Account: the account page, opened by the account button at the top right and the menu's
// Account row (Folio's 'account' slot). Sign in with Google, through Firebase (firebase.js).
// Signed out, it explains what an account is for and says the app isn't Durham University's.
// Signed in, it shows your picture, name and email, with Sign out and Delete my account.
// Backup and friends come later. Nothing is stored online yet.
//
// In the web version, Google's sign-in window opens. In the Android app Google doesn't allow
// that window inside apps, so Google's own Android sign-in is used instead (the Capacitor
// Firebase Authentication plugin), and what it returns signs in to Firebase in the same way.
//
// Service 'account': { user } the signed-in person ({ uid, name, email, photo }) or null.
// Event 'account:changed': sent with the user (or null) when someone signs in or out.
// Saved data: 'user' → { uid, name, email, photo }, so the name shows straight away and offline.

import { Feature, ui } from 'folio';
import { connect, googleProvider, googleCredential } from './firebase.js';
import { toUser, explain } from './rules.js';

const { el } = ui;

export default class Account extends Feature {
  start() {
    this.user = this.storage.get('user', null);
    this.busy = false;
    this.error = null;
    this.provide('account', this);
    this.add('account', {
      name: () => this.user?.name || null,
      open: () => this.openWindow(),
    });
    // Someone signed in before: check with Firebase that they still are, in the background.
    if (this.user) this.on('app:ready', () => this.watch().catch(() => {}));
  }

  // Follows Firebase's idea of who is signed in (it remembers between visits by itself).
  async watch() {
    const auth = await connect();
    if (!this.auth) {
      this.auth = auth;
      auth.onAuthStateChanged((firebaseUser) => this.setUser(toUser(firebaseUser)));
    }
    return auth;
  }

  // Gets Firebase ready while the page is open, so tapping Sign in can open Google's window
  // straight away (browsers block windows that open after a wait).
  prepare() {
    if (this.auth || this.preparing) return;
    this.preparing = this.watch()
      .catch((err) => { if (!this.user) this.error = explain(err); })
      .finally(() => { this.preparing = null; this.draw(); });
  }

  setUser(user) {
    if (JSON.stringify(user) === JSON.stringify(this.user)) return;
    this.user = user;
    if (user) this.storage.set('user', user);
    else this.storage.remove('user');
    this.emit('account:changed', user);
    this.refresh();
    this.draw();
  }

  // ---- Signing in and out ----

  async signIn() {
    if (!this.auth) return this.prepare();
    const auth = this.auth;
    await this.attempt(async () => {
      const result = this.native
        ? await auth.signInWithCredential(await this.androidCredential())
        : await auth.signInWithPopup(googleProvider());
      this.setUser(toUser(result.user));
    });
  }

  // In the Android app: Google's own sign-in, turned into something Firebase accepts.
  async androidCredential() {
    const google = this.plugin('FirebaseAuthentication');
    if (!google) throw new Error('no-plugin');
    const result = await google.signInWithGoogle();
    return googleCredential(result?.credential?.idToken);
  }

  async signOut() {
    await this.attempt(async () => {
      const auth = await this.watch();
      await auth.signOut();
      // In the Android app, also forget the Google account, so next time you can choose again.
      if (this.native) await this.plugin('FirebaseAuthentication')?.signOut().catch(() => {});
      this.setUser(null);
    });
  }

  async deleteAccount() {
    if (!confirm('Delete your Mobile Durham account? You\'ll be signed out. Everything on this phone stays, and nothing else is stored online yet.')) return;
    await this.attempt(async () => {
      const auth = await this.watch();
      const current = auth.currentUser;
      if (!current) return this.setUser(null);
      try {
        await current.delete();
      } catch (err) {
        if (err?.code !== 'auth/requires-recent-login') throw err;
        // Google wants to be sure it's really you: sign in once more, then delete.
        if (this.native) await current.reauthenticateWithCredential(await this.androidCredential());
        else await current.reauthenticateWithPopup(googleProvider());
        await current.delete();
      }
      this.setUser(null);
      this.toast('Your account has been deleted.');
    });
  }

  // Runs a step with the page showing it's busy, and explains anything that goes wrong.
  async attempt(step) {
    if (this.busy) return;
    if (!navigator.onLine) {
      this.error = "You're offline. This needs the internet.";
      this.draw();
      return;
    }
    this.busy = true;
    this.error = null;
    this.draw();
    try {
      await step();
    } catch (err) {
      this.error = explain(err);
    } finally {
      this.busy = false;
      this.draw();
    }
  }

  // ---- The page ----

  openWindow() {
    if (!this.window) this.window = ui.dialog({ title: 'Account', className: 'account-dialog' });
    this.error = null;
    if (!this.user) this.prepare();
    this.draw(true);
    this.window.open();
  }

  draw(force = false) {
    if (!this.window || (!force && !this.window.isOpen)) return;
    const error = ui.errorBox();
    error.show(this.error);
    this.window.setContent(this.user ? this.signedIn(error) : this.signedOut(error));
  }

  signedOut(error) {
    const waiting = this.busy || (!this.auth && this.preparing);
    const button = el('button', {
      type: 'button',
      class: 'btn primary block',
      disabled: waiting,
      onclick: () => this.signIn(),
    }, this.busy ? 'Signing in…' : waiting ? 'Getting ready…' : 'Sign in with Google');
    return el('section', { class: 'account-out' },
      el('span', { class: 'account-avatar' }, ui.icon('account')),
      el('h3', {}, 'Not signed in'),
      el('p', {}, 'Sign in to back up your to-dos, notes and module colours, and to see your friends\' timetables. ',
        el('b', {}, 'Mobile Durham is made by students and isn\'t affiliated with Durham University.')),
      button,
      error,
      ui.hint('Everything works without an account, and your things stay on this phone.', { small: true }));
  }

  signedIn(error) {
    const u = this.user;
    return el('div', { class: 'account-in' },
      el('section', { class: 'account-who' },
        this.picture(u),
        el('span', { class: 'account-name' }, el('b', {}, u.name), u.email && el('span', {}, u.email)),
        ui.hint('Signed in with Google.', { small: true })),
      error,
      el('section', { class: 'account-part' },
        el('h3', {}, 'Backup'),
        ui.hint('Coming soon: your to-dos, notes and module colours, saved to your account so they\'re safe if you change phones. Nothing is stored online yet.')),
      el('section', { class: 'account-part' },
        el('h3', {}, 'Friends'),
        ui.hint('Coming soon: add friends and see each other\'s timetables, only once you\'ve both agreed.')),
      el('button', { type: 'button', class: 'btn block', disabled: this.busy, onclick: () => this.signOut() },
        this.busy ? 'Please wait…' : 'Sign out'),
      el('button', { type: 'button', class: 'link-btn account-delete', disabled: this.busy, onclick: () => this.deleteAccount() },
        'Delete my account'),
      ui.hint('Mobile Durham is made by students and isn\'t affiliated with Durham University.', { small: true }));
  }

  // The Google picture, or the person icon if there isn't one or it doesn't load.
  picture(u) {
    const fallback = () => el('span', { class: 'account-avatar' }, ui.icon('account'));
    if (!u.photo) return fallback();
    const img = el('img', { class: 'account-avatar', src: u.photo, alt: '', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => img.replaceWith(fallback()));
    return img;
  }
}
