// Account: the account page, opened by the account button at the top right and the menu's
// Account row (Folio's 'account' slot). Sign in with Google or Apple, through Firebase
// (firebase.js). Signed out, it explains what an account is for and says the app isn't Durham
// University's. Signed in, it shows your picture, name and email, with Sign out and Delete my
// account. A Privacy notice link on both.
//
// Stored online: only what rules.js's onlineData() lists, in the database protected by
// firebase/firestore.rules. Delete my account deletes all of it, then the account.
//
// In the web version, Google's or Apple's sign-in window opens. Those windows don't work inside
// the phone apps, so there the phone's own sign-in is used instead (the Capacitor Firebase
// Authentication plugin): Google's on Android and iPhone, Apple's on iPhone. What it returns
// signs in to Firebase in the same way. Which ways are offered where: methodsFor() in rules.js.
//
// Service 'account' (this object):
//   user            the signed-in person ({ uid, name, email, photo, via }), or null
//   database()      Firebase's database (Firestore), once Firebase knows who is signed in;
//                   fails with Error('signed-out') if nobody is
//   publicDatabase() the database without needing anyone signed in, for what everyone may
//                   read (such as the places on Spots); the rules decide what that is
//   serverTime()    a value that the database turns into its own clock's time
//   fields          Firestore's FieldValue (arrayUnion, arrayRemove, …), once database() has run
//   open()          opens the account page
//   redraw()        draws the account page again, if it's open
// Slot 'account.sections': parts of the signed-in account page, e.g. Backup.
//   Item: { order, render(user) → element or null }
// Slot 'account.cleanup': online data other features keep that Delete my account must remove
//   first, e.g. friendships. Item: { order, remove(db, uid) → Promise }
// Event 'account:changed': sent with the user (or null) when someone signs in or out.
// Saved data: 'user' → { uid, name, email, photo, via }, so the name shows straight away and
// offline ('via' is 'google' or 'apple'; older saves don't have it, and mean Google).

import { Feature, ui } from 'folio';
import { connect, database, googleProvider, googleCredential, appleProvider, appleCredential } from './firebase.js';
import { toUser, explain, onlineData, methodsFor } from './rules.js';
import { privacyNotice } from './privacy.js';

const { el } = ui;

export default class Account extends Feature {
  start() {
    this.user = this.storage.get('user', null);
    this.busy = false;
    this.error = null;
    this.defineSlot('account.cleanup',
      'Online data to remove when someone deletes their account, before their own areas. Item: { order, remove(db, uid) → Promise }.');
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

  async publicDatabase() {
    await connect();
    return database();
  }

  serverTime() {
    return this.fields.serverTimestamp();
  }

  get fields() {
    return window.firebase.firestore.FieldValue;
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

  // method: 'google' or 'apple'.
  async signIn(method) {
    if (!this.auth) return this.prepare();
    const auth = this.auth;
    this.method = method;
    await this.attempt(async () => {
      let name = null;
      let result;
      if (this.native) {
        const phone = await this.phoneSignIn(method);
        name = phone.name;
        result = await auth.signInWithCredential(phone.credential);
      } else {
        result = await auth.signInWithPopup(method === 'apple' ? appleProvider() : googleProvider());
      }
      // Apple gives the person's name only the first time, and only to the app, not to
      // Firebase, so it's kept on their Firebase account here.
      if (name && !result.user.displayName) await result.user.updateProfile({ displayName: name }).catch(() => {});
      this.setUser(toUser(result.user));
    });
  }

  // In the phone apps: the phone's own sign-in, turned into something Firebase accepts, and the
  // person's name if Apple gave it.
  async phoneSignIn(method) {
    const plugin = this.plugin('FirebaseAuthentication');
    if (!plugin) throw new Error('no-plugin');
    if (method === 'apple') {
      const result = await plugin.signInWithApple();
      return {
        credential: appleCredential(result?.credential?.idToken, result?.credential?.nonce),
        name: result?.user?.displayName || null,
      };
    }
    const result = await plugin.signInWithGoogle();
    return { credential: googleCredential(result?.credential?.idToken), name: null };
  }

  async signOut() {
    await this.attempt(async () => {
      const auth = await this.watch();
      await auth.signOut();
      // In the phone apps, also forget the Google account, so next time you can choose again.
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
      for (const item of this.slot('account.cleanup').items) await item.remove(db, current.uid);
      for (const path of onlineData(current.uid)) await db.doc(path).delete();
      try {
        await current.delete();
      } catch (err) {
        if (err?.code !== 'auth/requires-recent-login') throw err;
        // Firebase wants to be sure it's really you: sign in once more, the same way, then delete.
        const method = toUser(current).via;
        if (this.native) await current.reauthenticateWithCredential((await this.phoneSignIn(method)).credential);
        else await current.reauthenticateWithPopup(method === 'apple' ? appleProvider() : googleProvider());
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
    const label = (method) => (this.busy && this.method === method ? 'Signing in…'
      : waiting ? 'Getting ready…' : `Sign in with ${method === 'apple' ? 'Apple' : 'Google'}`);
    const buttons = methodsFor(this.platform).map((method) => el('button', {
      type: 'button',
      class: `btn block sign-in sign-in-${method}`,
      disabled: waiting,
      onclick: () => this.signIn(method),
    }, method === 'apple' ? appleLogo() : googleLogo(), el('span', {}, label(method))));
    return el('section', { class: 'account-out' },
      el('span', { class: 'account-avatar' }, ui.icon('account')),
      el('h3', {}, 'Not signed in'),
      el('p', {}, 'Sign in to back up your timetable link and swap timetables with friends. ',
        el('b', {}, 'Mobile Durham is made by students and isn\'t affiliated with Durham University.')),
      el('div', { class: 'sign-in-buttons' }, ...buttons),
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
        ui.hint(`Signed in with ${u.via === 'apple' ? 'Apple' : 'Google'}.`, { small: true })),
      error,
      ...this.slot('account.sections').map((section) => section.render(u)).filter(Boolean),
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

// The logos on the sign-in buttons, drawn as each company asks.
const SVG = 'http://www.w3.org/2000/svg';

function logo(viewBox, paths) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'sign-in-logo');
  for (const [d, fill] of paths) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', fill);
    svg.append(path);
  }
  return svg;
}

function appleLogo() {
  return logo('0 0 17 20', [['M14.04 10.63c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM11.86 4.17c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.21z', 'currentColor']]);
}

function googleLogo() {
  return logo('0 0 18 18', [
    ['M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z', '#4285F4'],
    ['M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z', '#34A853'],
    ['M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z', '#FBBC05'],
    ['M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z', '#EA4335'],
  ]);
}
