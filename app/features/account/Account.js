// Account: the account page, opened by the account button at the top right and the menu's
// Account row (Folio's 'account' slot). Sign in with Google, through Firebase (firebase.js).
// Signed out, it explains what an account is for and says the app isn't Durham University's.
// Signed in, it shows your picture, name and email, with Sign out and Delete my account.
// A Privacy notice link on both. Backup and friends come later.
//
// Stored online: only what rules.js's onlineData() lists, in the database protected by
// firebase/firestore.rules. Delete my account deletes all of it, then the account.
//
// In the web version, Google's sign-in window opens. In the Android app Google doesn't allow
// that window inside apps, so Google's own Android sign-in is used instead (the Capacitor
// Firebase Authentication plugin), and what it returns signs in to Firebase in the same way.
//
// Service 'account' (this object):
//   user            the signed-in person ({ uid, name, email, photo }), or null
//   database()      Firebase's database (Firestore), once Firebase knows who is signed in;
//                   fails with Error('signed-out') if nobody is
//   serverTime()    a value that the database turns into its own clock's time
//   open()          opens the account page
//   redraw()        draws the account page again, if it's open
// Slot 'account.sections': parts of the signed-in account page, e.g. Backup.
//   Item: { order, render(user) → element or null }
// Event 'account:changed': sent with the user (or null) when someone signs in or out.
// Saved data: 'user' → { uid, name, email, photo }, so the name shows straight away and offline.

import { Feature, ui } from 'folio';
import { connect, database, googleProvider, googleCredential } from './firebase.js';
import { toUser, explain, onlineData } from './rules.js';
import { privacyNotice } from './privacy.js';

const { el } = ui;

export default class Account extends Feature {
  start() {
    this.user = this.storage.get('user', null);
    this.busy = false;
    this.error = null;
    this.defineSlot('account.sections',
      'Parts of the signed-in account page, under your name. Item: { order, render(user) → element or null }.');
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
      // Firebase answers once it knows who is signed in (from its own memory), then on changes.
      this.known = new Promise((resolve) => {
        auth.onAuthStateChanged((firebaseUser) => {
          this.setUser(toUser(firebaseUser));
          resolve();
        });
      });
    }
    await this.known;
    return auth;
  }

  // ---- For other features ----

  open() {
    this.openWindow();
  }

  redraw() {
    this.draw();
  }

  async database() {
    const auth = await this.watch();
    if (!auth.currentUser) throw new Error('signed-out');
    return database();
  }

  serverTime() {
    return window.firebase.firestore.FieldValue.serverTimestamp();
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
    if (!confirm('Delete your Mobile Durham account? Everything you\'ve stored online is deleted straight away, and you\'re signed out. Everything on this phone stays.')) return;
    await this.attempt(async () => {
      const auth = await this.watch();
      const current = auth.currentUser;
      if (!current) return this.setUser(null);
      // First everything stored online (only you are allowed to delete it), then the account.
      const db = await database();
      for (const path of onlineData(current.uid)) await db.doc(path).delete();
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
      el('p', {}, 'Sign in to back up your timetable link and see your friends\' timetables (both coming soon). ',
        el('b', {}, 'Mobile Durham is made by students and isn\'t affiliated with Durham University.')),
      button,
      error,
      ui.hint('Everything works without an account, and your things stay on this phone.', { small: true }),
      this.privacyLink());
  }

  privacyLink() {
    return el('button', { type: 'button', class: 'link-btn account-privacy', onclick: () => this.openPrivacy() }, 'Privacy notice');
  }

  openPrivacy() {
    if (!this.privacy) {
      this.privacy = ui.dialog({ title: 'Privacy notice', className: 'privacy-dialog' });
      this.privacy.setContent(privacyNotice());
    }
    this.privacy.open();
  }

  signedIn(error) {
    const u = this.user;
    return el('div', { class: 'account-in' },
      el('section', { class: 'account-who' },
        this.picture(u),
        el('span', { class: 'account-name' }, el('b', {}, u.name), u.email && el('span', {}, u.email)),
        ui.hint('Signed in with Google.', { small: true })),
      error,
      ...this.slot('account.sections').map((section) => section.render(u)).filter(Boolean),
      el('section', { class: 'account-part' },
        el('h3', {}, 'Friends'),
        ui.hint('Coming soon: add friends and see each other\'s timetables, only once you\'ve both agreed.')),
      el('button', { type: 'button', class: 'btn block', disabled: this.busy, onclick: () => this.signOut() },
        this.busy ? 'Please wait…' : 'Sign out'),
      el('button', { type: 'button', class: 'link-btn account-delete', disabled: this.busy, onclick: () => this.deleteAccount() },
        'Delete my account'),
      this.privacyLink(),
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
