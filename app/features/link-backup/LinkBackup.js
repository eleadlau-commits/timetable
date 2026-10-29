// Link backup: while you're signed in, your timetable link is saved to your private area online,
// which only you can read (firebase/firestore.rules). On a new phone, signing in brings your
// timetable back.
//
// - Saving: when you sign in, whenever the timetable's link changes, and when the app starts or
//   comes back online if the last save didn't happen. Only a timetable from a link is saved,
//   not one imported from a file. On by default; the switch on the account page turns it off,
//   which deletes the online copy.
// - Bringing it back: automatically only right after you sign in on a phone with no timetable
//   (otherwise removing your timetable would bring it straight back). The setup screen also has
//   a button for it.
// - Delete my account deletes the private area itself (account's onlineData).
//
// Saved data: 'on'    → false if backup is switched off
//             'saved' → { uid, link, at } what was last saved online, so it isn't saved again

import { Feature, ui, time } from 'folio';
import { backupPath, isSaved, linkToBackUp } from './rules.js';

const { el } = ui;

export default class LinkBackup extends Feature {
  start() {
    this.addHelp();
    this.account = this.use('account');
    this.timetable = this.use('timetable');
    this.enabled = this.storage.get('on', true);
    this.saved = this.storage.get('saved', null);
    this.busy = false;
    this.problem = null;

    this.add('account.sections', { order: 10, render: (user) => this.section(user) });
    this.add('timetable.setup', { order: 5, render: () => this.setupLine() });
    this.on('account:changed', (user) => (user ? this.signedIn() : this.forget()));
    this.on('timetable:changed', () => this.sync());
    this.on('app:ready', () => this.sync());
    this.on('app:online', () => this.sync());
  }

  get user() {
    return this.account.user;
  }

  get link() {
    return linkToBackUp(this.timetable);
  }

  get isSaved() {
    return isSaved(this.saved, this.user?.uid, this.link);
  }

  // ---- Saving and bringing back ----

  async signedIn() {
    if (!this.timetable.hasData) await this.restore({ quiet: true });
    else await this.sync();
  }

  forget() {
    this.saved = null;
    this.storage.remove('saved');
  }

  // Saves the link if it isn't saved to this account yet.
  async sync() {
    if (!this.enabled || !this.user || !this.link || this.isSaved || this.busy || !navigator.onLine) return;
    const user = this.user;
    const link = this.link;
    await this.step(async () => {
      const db = await this.account.database();
      await db.doc(backupPath(user.uid)).set({ link, updatedAt: this.account.serverTime() });
      this.saved = { uid: user.uid, link, at: Date.now() };
      this.storage.set('saved', this.saved);
    }, "Couldn't save your link to your account. It'll try again next time.");
  }

  // Loads the timetable from the link saved in your account. Returns true if it did.
  async restore({ quiet = false } = {}) {
    if (!this.user) return false;
    let restored = false;
    await this.step(async () => {
      const db = await this.account.database();
      const snap = await db.doc(backupPath(this.user.uid)).get();
      const link = snap.exists ? snap.data().link : null;
      if (!link) {
        if (!quiet) this.toast('There\'s no timetable saved in your account yet.');
        return;
      }
      await this.timetable.load(link);
      this.saved = { uid: this.user.uid, link: this.link, at: Date.now() };
      this.storage.set('saved', this.saved);
      this.toast('Your timetable is back, from your account.');
      restored = true;
    }, "Couldn't bring your timetable back from your account. Check you're online and try again.");
    return restored;
  }

  async setEnabled(on) {
    this.enabled = on;
    this.storage.set('on', on);
    if (on) return this.sync();
    // Switched off: delete the online copy.
    const user = this.user;
    await this.step(async () => {
      const db = await this.account.database();
      await db.doc(backupPath(user.uid)).delete();
      this.forget();
    }, "Couldn't delete the link from your account. Check you're online and try again.");
  }

  // Runs a step that talks to the database, showing it's busy and remembering any problem.
  async step(work, problem) {
    this.busy = true;
    this.problem = null;
    this.refresh();
    try {
      await work();
    } catch {
      this.problem = problem;
    } finally {
      this.busy = false;
      this.refresh();
      this.account.redraw();
    }
  }

  // ---- On the account page ----

  section(user) {
    if (!user) return null;
    return el('section', { class: 'account-part backup-part' },
      el('h3', {}, 'Backup'),
      el('div', { class: 'backup-switch' },
        el('span', {}, 'Back up my timetable link'),
        ui.toggle({ checked: this.enabled, label: 'Back up my timetable link', disabled: this.busy, onChange: (on) => this.setEnabled(on) })),
      ui.hint(this.status(), { small: true }),
      this.problem && el('div', { class: 'error' }, this.problem),
      this.enabled && !this.timetable.hasData && el('button', {
        type: 'button', class: 'btn small', disabled: this.busy, onclick: () => this.restore(),
      }, 'Bring back my timetable'));
  }

  status() {
    if (this.busy) return 'Talking to your account…';
    if (!this.enabled) return 'Off. Your link isn\'t stored online.';
    if (!this.timetable.hasData) return 'There\'s no timetable on this phone yet. If you saved one from another phone, bring it back below.';
    if (!this.link) return 'Your timetable was added from a file, so there\'s no link to back up.';
    if (this.isSaved) return `Saved to your account ${time.ago(this.saved.at)}. Only you can see it. On a new phone, sign in and your timetable comes back.`;
    return 'Not saved yet. It\'s saved as soon as you\'re online.';
  }

  // ---- On the setup screen ----

  setupLine() {
    if (this.user) {
      return el('div', {},
        el('b', {}, 'Saved one before?'), ' Bring back the timetable saved in your account.',
        el('button', { type: 'button', class: 'btn block', disabled: this.busy, onclick: () => this.restore() }, 'Bring back my timetable'));
    }
    return el('div', {},
      el('b', {}, 'Used Mobile Durham on another phone?'), ' If you backed up your timetable there, sign in and it comes back.',
      el('button', { type: 'button', class: 'btn block', onclick: () => this.account.open() }, 'Sign in'));
  }

  // Questions and answers for the Help page.
  addHelp() {
    for (const item of [
      { group: 'account', order: 30, question: 'I\'ve got a new phone. How do I get my timetable back?', answer: () => [
        'If you were signed in on your old phone, your timetable link was backed up. Sign in on the new phone with the same account and your timetable comes back. If it doesn\'t, tap Bring back my timetable on the account page.',
        'Notes, to-dos, reminders and your campus card are kept on the phone only, so they don\'t move across.',
      ] },
    ]) this.add('help.questions', item);
  }
}
