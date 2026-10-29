// Account: the account page, opened by the account button at the top right and the menu's
// Account row (Folio's 'account' slot). Sign in with Google, or with an email and password,
// through Firebase (firebase.js). Signed out, it explains what an account is for and says the
// app isn't Durham University's. Signed in, it shows your picture, name and email, with Sign out
// and Delete my account. A Privacy notice link on both.
//
// Email and password: Create account (name, email, password), Sign in, and Forgot password,
// which has Firebase email a link to choose a new one. After Create account, Firebase emails a
// link to confirm the address. Until it's tapped, the account page says so, and database()
// refuses with Error('unverified'), as the database's rules do, so made-up addresses can't use
// backup or friends. Firebase keeps the passwords (scrambled); the app never stores them.
//
// Stored online: only what rules.js's onlineData() lists, in the database protected by
// firebase/firestore.rules. Delete my account deletes all of it, then the account.
//
// In the web version, Google's sign-in window opens. In the Android app Google doesn't allow
// that window inside apps, so Google's own Android sign-in is used instead (the Capacitor
// Firebase Authentication plugin), and what it returns signs in to Firebase in the same way.
//
// Service 'account' (this object):
//   user            the signed-in person ({ uid, name, email, photo, via, verified }), or null
//   database()      Firebase's database (Firestore), once Firebase knows who is signed in;
//                   fails with Error('signed-out') if nobody is, and Error('unverified') if
//                   they signed in with an email they haven't confirmed yet
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
// Saved data: 'user' → { uid, name, email, photo, via, verified }, so the name shows straight
// away and offline ('via' is 'google' or 'email'; older saves don't have it, and mean Google).

import { Feature, ui } from 'folio';
import { connect, database, googleProvider, googleCredential } from './firebase.js';
import { toUser, explain, onlineData, checkNewAccount, checkEmail, MIN_PASSWORD } from './rules.js';
import { privacyNotice } from './privacy.js';

const { el } = ui;

export default class Account extends Feature {
  start() {
    this.addHelp();
    this.user = this.storage.get('user', null);
    this.busy = false;
    this.error = null;
    this.note = null;
    // The email form: which part shows ('signin', 'create' or 'reset'), and what's typed, so it
    // survives the page being drawn again. The password is never saved.
    this.mode = 'signin';
    this.form = { name: '', email: '', password: '' };
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
    const current = auth.currentUser;
    if (!current) throw new Error('signed-out');
    if (!toUser(current).verified && !(await this.checkConfirmed(current))) throw new Error('unverified');
    return database();
  }

  // Asks Firebase again whether the email address has been confirmed (the person taps the link
  // in the email, outside the app). If it has, gets a new pass for the database, which says so.
  async checkConfirmed(current) {
    await current.reload();
    if (!current.emailVerified) return false;
    await current.getIdToken(true);
    this.setUser(toUser(current));
    return true;
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

  // ---- Email and password ----

  async signInWithEmail() {
    const { email, password } = this.form;
    const problem = checkEmail(email) || (password ? null : 'Type your password.');
    if (problem) return this.showError(problem);
    if (!this.auth) return this.prepare();
    await this.attempt(async () => {
      const result = await this.auth.signInWithEmailAndPassword(email.trim(), password);
      this.form.password = '';
      this.setUser(toUser(result.user));
    });
  }

  async createAccount() {
    const problem = checkNewAccount(this.form);
    if (problem) return this.showError(problem);
    if (!this.auth) return this.prepare();
    await this.attempt(async () => {
      const result = await this.auth.createUserWithEmailAndPassword(this.form.email.trim(), this.form.password);
      await result.user.updateProfile({ displayName: this.form.name.trim() });
      this.form.password = '';
      this.setUser(toUser(result.user));
      await result.user.sendEmailVerification();
      this.note = `We've sent a link to ${result.user.email}. Tap it to confirm your email.`;
    });
  }

  async sendReset() {
    const problem = checkEmail(this.form.email);
    if (problem) return this.showError(problem);
    if (!this.auth) return this.prepare();
    await this.attempt(async () => {
      try {
        await this.auth.sendPasswordResetEmail(this.form.email.trim());
      } catch (err) {
        // Saying there's no such account would tell anyone who has one.
        if (err?.code !== 'auth/user-not-found') throw err;
      }
      this.mode = 'signin';
      this.note = 'If there\'s an account with that email, we\'ve sent it a link to choose a new password. Check your junk folder too.';
    });
  }

  async resendConfirmation() {
    await this.attempt(async () => {
      const current = (await this.watch()).currentUser;
      if (!current) return this.setUser(null);
      await current.sendEmailVerification();
      this.note = `Sent again to ${current.email}. Check your junk folder too.`;
    });
  }

  async confirmed() {
    await this.attempt(async () => {
      const current = (await this.watch()).currentUser;
      if (!current) return this.setUser(null);
      this.note = (await this.checkConfirmed(current)) ? 'Thanks, your email is confirmed.'
        : 'It isn\'t confirmed yet. Tap the link in the email first.';
    });
  }

  showError(text) {
    this.error = text;
    this.note = null;
    this.draw();
  }

  async signOut() {
    await this.attempt(async () => {
      const auth = await this.watch();
      await auth.signOut();
      this.note = null;
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
      // An email that was never confirmed can't have stored anything (the rules refuse it).
      const user = toUser(current);
      if (user.verified || (await this.checkConfirmed(current))) {
        const db = await database();
        for (const item of this.slot('account.cleanup').items) await item.remove(db, current.uid);
        for (const path of onlineData(current.uid)) await db.doc(path).delete();
      }
      try {
        await current.delete();
      } catch (err) {
        if (err?.code !== 'auth/requires-recent-login') throw err;
        // Firebase wants to be sure it's really you: sign in once more, then delete.
        await this.reauthenticate(current, user);
        await current.delete();
      }
      this.setUser(null);
      this.toast('Your account has been deleted.');
    });
  }

  async reauthenticate(current, user) {
    if (user.via === 'email') {
      const password = prompt('To delete your account, type your password once more:');
      if (!password) throw { code: 'auth/user-cancelled' };
      const credential = window.firebase.auth.EmailAuthProvider.credential(current.email, password);
      return current.reauthenticateWithCredential(credential);
    }
    if (this.native) return current.reauthenticateWithCredential(await this.androidCredential());
    return current.reauthenticateWithPopup(googleProvider());
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
    this.note = null;
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
    this.note = null;
    if (!this.user) this.prepare();
    this.draw(true);
    this.window.open();
  }

  draw(force = false) {
    if (!this.window || (!force && !this.window.isOpen)) return;
    const error = ui.errorBox();
    error.show(this.error);
    const note = this.note && el('p', { class: 'account-note', role: 'status' }, this.note);
    this.window.setContent(this.user ? this.signedIn(error, note) : this.signedOut(error, note));
  }

  signedOut(error, note) {
    const waiting = this.busy || (!this.auth && this.preparing);
    const button = el('button', {
      type: 'button',
      class: 'btn primary block',
      disabled: waiting,
      onclick: () => this.signIn(),
    }, this.busy && !this.emailBusy ? 'Signing in…' : waiting ? 'Getting ready…' : 'Sign in with Google');
    return el('section', { class: 'account-out' },
      el('span', { class: 'account-avatar' }, ui.icon('account')),
      el('h3', {}, 'Not signed in'),
      el('p', {}, 'Sign in to back up your timetable link and swap timetables with friends. ',
        el('b', {}, 'Mobile Durham is made by students and isn\'t affiliated with Durham University.')),
      button,
      el('p', { class: 'account-or' }, 'or with your email'),
      this.emailForm(waiting),
      note,
      error,
      ui.hint('Everything works without an account, and your things stay on this phone.', { small: true }),
      this.privacyLink());
  }

  // The email form: sign in, create an account, or get a link to choose a new password.
  emailForm(waiting) {
    const field = (key, label, attrs) => {
      const id = `account-${key}`;
      const input = el('input', { id, class: 'account-input', value: this.form[key], ...attrs });
      input.addEventListener('input', () => { this.form[key] = input.value; });
      return el('div', { class: 'account-field' }, el('label', { class: 'label', for: id }, label), input);
    };
    const email = field('email', 'Email', { type: 'email', autocomplete: 'email', inputmode: 'email', autocapitalize: 'off', spellcheck: 'false' });
    const modes = {
      signin: {
        fields: [email, field('password', 'Password', { type: 'password', autocomplete: 'current-password' })],
        button: 'Sign in', run: () => this.signInWithEmail(),
        links: [['Forgot password?', 'reset'], ['New here? Create an account', 'create']],
      },
      create: {
        fields: [
          field('name', 'Your first name', { type: 'text', autocomplete: 'given-name', maxlength: '30' }),
          email,
          field('password', `Password (at least ${MIN_PASSWORD} characters)`, { type: 'password', autocomplete: 'new-password', minlength: String(MIN_PASSWORD) }),
        ],
        button: 'Create account', run: () => this.createAccount(),
        links: [['Already have an account? Sign in', 'signin']],
      },
      reset: {
        intro: 'Type your email and we\'ll send you a link to choose a new password.',
        fields: [email],
        button: 'Send the link', run: () => this.sendReset(),
        links: [['Back to sign in', 'signin']],
      },
    };
    const mode = modes[this.mode] || modes.signin;
    const form = el('form', { class: 'account-email', novalidate: true },
      mode.intro && el('p', {}, mode.intro),
      ...mode.fields,
      el('button', { type: 'submit', class: 'btn block', disabled: waiting }, this.busy && this.emailBusy ? 'Please wait…' : mode.button),
      el('div', { class: 'account-links' }, ...mode.links.map(([label, next]) => el('button', {
        type: 'button',
        class: 'link-btn',
        onclick: () => { this.mode = next; this.error = null; this.note = null; this.draw(); },
      }, label))));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.emailBusy = true;
      try {
        await mode.run();
      } finally {
        this.emailBusy = false;
        this.draw();
      }
    });
    return form;
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

  signedIn(error, note) {
    const u = this.user;
    return el('div', { class: 'account-in' },
      el('section', { class: 'account-who' },
        this.picture(u),
        el('span', { class: 'account-name' }, el('b', {}, u.name), u.email && el('span', {}, u.email)),
        ui.hint(u.via === 'email' ? 'Signed in with your email.' : 'Signed in with Google.', { small: true })),
      u.verified === false && this.confirmBox(),
      note,
      error,
      ...this.slot('account.sections').map((section) => section.render(u)).filter(Boolean),
      el('button', { type: 'button', class: 'btn block', disabled: this.busy, onclick: () => this.signOut() },
        this.busy ? 'Please wait…' : 'Sign out'),
      el('button', { type: 'button', class: 'link-btn account-delete', disabled: this.busy, onclick: () => this.deleteAccount() },
        'Delete my account'),
      this.privacyLink(),
      ui.hint('Mobile Durham is made by students and isn\'t affiliated with Durham University.', { small: true }));
  }

  // Until the email address is confirmed: what to do, and buttons to check or send it again.
  confirmBox() {
    return el('section', { class: 'account-confirm' },
      el('b', {}, 'Confirm your email'),
      el('p', {}, `We've sent a link to ${this.user.email}. Tap it, then come back here. Until then, backup and friends don't work.`),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn small primary', disabled: this.busy, onclick: () => this.confirmed() }, 'I\'ve confirmed it'),
        el('button', { type: 'button', class: 'btn small', disabled: this.busy, onclick: () => this.resendConfirmation() }, 'Send it again')));
  }

  // The Google picture, or the person icon if there isn't one or it doesn't load.
  picture(u) {
    const fallback = () => el('span', { class: 'account-avatar' }, ui.icon('account'));
    if (!u.photo) return fallback();
    const img = el('img', { class: 'account-avatar', src: u.photo, alt: '', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => img.replaceWith(fallback()));
    return img;
  }

  // Questions and answers for the Help page.
  addHelp() {
    for (const item of [
      { group: 'account', order: 10, question: 'Do I need an account?', answer: () => [
        'No. Everything works without one, and your things stay on your phone. An account lets you back up your timetable link and swap timetables with friends.',
      ] },
      { group: 'account', order: 20, question: 'How do I sign in?', answer: () => [
        'Tap the person button at the top right, or Account in the menu. Then tap Sign in with Google, or use your email: sign in with your email and password, or tap Create an account if you\'re new.',
      ] },
      { group: 'account', order: 25, question: 'I\'ve forgotten my password', answer: () => [
        'On the account page, tap Forgot password?, type your email and tap Send the link. Open the email and choose a new password. Check your junk folder if it doesn\'t arrive. If you signed in with Google before, use Sign in with Google instead.',
      ] },
      { group: 'account', order: 26, question: 'Why do I need to confirm my email?', answer: () => [
        'So nobody can make an account with someone else\'s address. Tap the link in the email we sent when you created your account, then tap I\'ve confirmed it on the account page. Until then, backup and friends don\'t work.',
      ] },
      { group: 'account', order: 90, question: 'How do I delete my account?', answer: () => [
        'Open your account page and tap Delete my account at the bottom. Everything stored online is deleted straight away, then the account. What\'s on this phone stays until you remove the app.',
      ] },
      { group: 'privacy', order: 1, question: 'What do you do with my data?', answer: () => [
        'Without an account, nothing leaves your phone. With one, only what\'s needed for backup and friends is stored, and never sold or used for adverts. The privacy notice explains it all.',
      ], action: { label: 'Read the privacy notice', run: () => this.openPrivacy() } },
    ]) this.add('help.questions', item);
  }
}
