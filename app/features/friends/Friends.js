// Friends: swap timetables with friends. The Friends button in the top bar opens it.
//
// - You get a friend code (and QR code) to give out. There's no searching for people.
// - Asking someone (with their code) lets them see your timetable straight away; you see theirs
//   once they accept. Cancelling, declining or removing stops it both ways.
// - What's shared: your classes for the next 4 weeks (the university's names, times and rooms),
//   without modules you've hidden. It's kept up to date while you have friends or requests,
//   and deleted when you have none.
// - A friend's timetable is shown in grey, or a tint you choose for them.
// The database rules (firebase/firestore.rules) enforce all of this; store.js does the writes.
//
// Saved data: 'profile' → { uid, name, code, people } a copy of your online profile, for showing
//             'shared'  → { uid, print, at } what was last shared, so it isn't sent again
//             'tints'   → { [friend's uid]: hue } colours you chose (none means grey)

import { Feature, ui, time } from 'folio';
import { FriendStore } from './store.js';
import { readCode, firstName, cleanName, sharedClasses, fingerprint, stalePeople, SHARE_DAYS } from './rules.js';
import { personRow, statusLine, statusTag, tintChoice, timetableView } from './screens.js';

const { el } = ui;
const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
const RESHARE = 12 * time.HOUR;

export default class Friends extends Feature {
  start() {
    this.account = this.use('account');
    this.sessions = this.use('sessions');
    this.store = new FriendStore(this.account);
    this.tints = this.storage.get('tints', {});
    this.state = { profile: null, friendships: [], timetables: {}, loading: false, error: null };

    this.add('header.actions', { id: 'friends', label: 'Friends', icon: 'people', order: 10, onClick: () => this.open() });
    this.add('account.sections', { order: 20, render: (user) => this.accountSection(user) });
    this.add('account.cleanup', { order: 10, remove: (db, uid) => FriendStore.removeAll(db, uid) });
    this.on('account:changed', (user) => { if (!user) this.forget(); });
    this.on('sessions:changed', () => this.share());
    this.on('timetable:changed', () => this.share());
    this.on('app:ready', () => { this.share(); this.openFromLink(); });
  }

  get me() {
    return this.account.user;
  }

  get cached() {
    const p = this.storage.get('profile', null);
    return p && p.uid === this.me?.uid ? p : null;
  }

  forget() {
    this.storage.remove('profile');
    this.storage.remove('shared');
    this.state = { profile: null, friendships: [], timetables: {}, loading: false, error: null };
  }

  // ---- Loading and saving ----

  async load() {
    this.state.loading = true;
    this.state.error = null;
    this.draw();
    try {
      const profile = await this.store.profile(firstName(this.me.name));
      const friendships = await this.store.friendships();
      const stale = stalePeople(profile.people, friendships, this.me.uid);
      await this.store.forget(stale);
      profile.people = profile.people.filter((p) => !stale.includes(p));
      this.state.profile = profile;
      this.state.friendships = friendships;
      this.storage.set('profile', { uid: this.me.uid, name: profile.name, code: profile.code, people: profile.people });
      await this.share();
      // Timetables you can see: friends, and people who asked you.
      const visible = friendships.filter((f) => f.status === 'accepted' || f.from !== this.me.uid);
      const timetables = {};
      await Promise.all(visible.map(async (f) => {
        const other = this.other(f);
        timetables[other] = await this.store.timetable(other).catch(() => null);
      }));
      this.state.timetables = timetables;
    } catch (err) {
      this.state.error = this.explain(err);
    } finally {
      this.state.loading = false;
      this.draw();
    }
  }

  // Keeps your shared timetable up to date while you have friends or requests; deletes it when not.
  async share({ force = false } = {}) {
    const profile = this.cached;
    if (!this.me || !profile || !this.sessions || !navigator.onLine) return;
    const last = this.storage.get('shared', null);
    try {
      if (!profile.people.length && !force) {
        if (last?.uid === this.me.uid) {
          await this.store.unshare();
          this.storage.remove('shared');
        }
        return;
      }
      const classes = sharedClasses(this.sessions.all, (s) => this.sessions.isShown(s));
      const print = fingerprint(classes);
      if (!force && last?.uid === this.me.uid && last.print === print && Date.now() - last.at < RESHARE) return;
      await this.store.share(classes);
      this.storage.set('shared', { uid: this.me.uid, print, at: Date.now() });
    } catch {
      // Tries again next time something changes, or when Friends is opened.
    }
  }

  other(f) {
    return f.users.find((u) => u !== this.me.uid);
  }

  nameOf(f) {
    return f.names?.[this.other(f)] || 'Friend';
  }

  explain(err) {
    if (!navigator.onLine) return 'You\'re offline. Friends needs the internet.';
    if (err?.message === 'full') return 'You\'ve reached 50 friends and requests. Remove someone first.';
    return 'Something went wrong. Check you\'re online and try again.';
  }

  // Runs a change, then loads everything again.
  async act(work, done) {
    try {
      await work();
      if (done) this.toast(done);
    } catch (err) {
      this.toast(this.explain(err));
    }
    await this.load();
  }

  // ---- The Friends page ----

  open() {
    if (!this.window) this.window = ui.dialog({ title: 'Friends', className: 'friends-dialog' });
    this.window.open();
    if (this.me) this.load();
    else this.draw();
  }

  draw() {
    if (!this.window?.isOpen) return;
    if (!this.me) return this.window.setContent(this.signedOut());
    const { profile, loading, error } = this.state;
    if (!profile) {
      return this.window.setContent(error ? el('div', { class: 'error' }, error) : ui.hint(loading ? 'Loading…' : ''));
    }
    this.window.setContent(this.page(profile));
  }

  signedOut() {
    return el('section', { class: 'fr-out' },
      el('h3', {}, 'Sign in to add friends'),
      el('p', {}, 'Swap timetables with friends and see when you\'re both free. Only people you\'ve asked or accepted can see yours.'),
      el('button', { type: 'button', class: 'btn primary block', onclick: () => { this.window.close(); this.account.open(); } }, 'Sign in'));
  }

  page(profile) {
    const mine = this.me.uid;
    const groups = { asking: [], friends: [], waiting: [] };
    for (const f of this.state.friendships) {
      if (f.status === 'accepted') groups.friends.push(f);
      else if (f.from === mine) groups.waiting.push(f);
      else groups.asking.push(f);
    }
    const list = (title, items, row) => items.length > 0 && el('section', { class: 'fr-group' },
      el('h3', {}, `${title} (${items.length})`), el('ul', {}, items.map(row)));
    return el('div', { class: 'fr-page' },
      this.state.error && el('div', { class: 'error' }, this.state.error),
      el('div', { class: 'fr-code' },
        el('span', {}, el('small', {}, 'Your friend code'), el('b', {}, profile.code)),
        el('button', { type: 'button', class: 'btn small', onclick: () => this.shareCode(profile.code) }, 'Share')),
      this.qrBox = el('div', { class: 'fr-qr', hidden: true }),
      el('div', { class: 'fr-buttons' },
        el('button', { type: 'button', class: 'btn primary', onclick: () => this.openAdd() }, 'Add a friend'),
        el('button', { type: 'button', class: 'btn', onclick: () => this.showQR(profile.code) }, 'Show QR code')),
      el('p', { class: 'fr-me' }, 'Friends see you as ', el('b', {}, profile.name), '. ',
        el('button', { type: 'button', class: 'link-btn', onclick: () => this.rename() }, 'Change')),
      list('Asking you', groups.asking, (f) => personRow({
        name: this.nameOf(f), hue: this.tints[this.other(f)],
        line: 'Wants to swap timetables. You can already see theirs.',
        onOpen: () => this.openFriend(f),
        right: el('span', { class: 'fr-actions' },
          el('button', { type: 'button', class: 'btn small primary', onclick: () => this.accept(f) }, 'Accept'),
          el('button', { type: 'button', class: 'btn small', onclick: () => this.end(f, 'Declined.') }, 'Decline')),
      })),
      list('Friends', groups.friends, (f) => {
        const status = statusLine(this.state.timetables[this.other(f)]?.classes);
        return personRow({ name: this.nameOf(f), hue: this.tints[this.other(f)], line: status.text, right: statusTag(status), onOpen: () => this.openFriend(f) });
      }),
      list('Waiting for them', groups.waiting, (f) => personRow({
        name: this.nameOf(f), hue: this.tints[this.other(f)],
        line: 'They can see your timetable. You\'ll see theirs once they accept.',
        right: el('button', { type: 'button', class: 'btn small', onclick: () => this.end(f, 'Request cancelled.') }, 'Cancel'),
      })),
      !this.state.friendships.length && ui.hint('No friends yet. Give someone your code, or add theirs.'),
      ui.hint(`Friends see your classes for the next ${SHARE_DAYS / 7} weeks: the university's names, times and rooms. Modules you've hidden, notes, reminders and to-dos are never shared.`, { small: true }));
  }

  async shareCode(code) {
    const text = `Add me on Mobile Durham: my friend code is ${code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(code); this.toast('Code copied.'); }
    } catch { /* closed the share sheet */ }
  }

  async showQR(code) {
    const box = this.qrBox;
    if (!box) return;
    box.hidden = !box.hidden;
    if (box.hidden || box.childElementCount) return;
    const link = new URL(location.pathname, location.origin);
    link.hash = `friend=${code}`;
    try {
      await ui.loadScript(QR_LIB);
      new window.QRCode(box, { text: link.href, width: 200, height: 200, correctLevel: window.QRCode.CorrectLevel.M });
    } catch {
      box.textContent = 'Couldn\'t make the QR code (are you offline?). Share the code instead.';
    }
  }

  async rename() {
    const name = cleanName(prompt('Your name for friends (up to 30 letters):', this.state.profile.name));
    if (!name || name === this.state.profile.name) return;
    await this.act(() => this.store.rename(this.state.profile, name, this.state.friendships), 'Name changed.');
  }

  async accept(f) {
    await this.act(async () => {
      await this.share({ force: true });
      await this.store.accept(this.state.profile, f);
    }, `You and ${this.nameOf(f)} are now friends.`);
  }

  async end(f, done) {
    await this.act(() => this.store.end(f), done);
    this.friendWindow?.close();
  }

  // ---- Adding a friend ----

  openFromLink() {
    const code = new URLSearchParams(location.hash.slice(1)).get('friend');
    if (!code) return;
    history.replaceState(null, '', location.pathname + location.search);
    this.openAdd(code);
  }

  openAdd(prefill = '') {
    if (!this.me) return this.open();
    if (!this.addWindow) this.addWindow = ui.dialog({ title: 'Add a friend', className: 'friends-add' });
    const input = el('input', { class: 'field fr-input', placeholder: 'MD-XXXX-XXXX', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', value: prefill });
    const result = el('div', { class: 'fr-result' });
    const find = async () => {
      const code = readCode(input.value);
      if (!code) return result.replaceChildren(el('div', { class: 'error' }, 'That doesn\'t look like a friend code. They look like MD-7K3Q-9P2X.'));
      result.replaceChildren(ui.hint('Looking…'));
      try {
        if (!this.state.profile) await this.load();
        const found = await this.store.lookup(code);
        if (!found) return result.replaceChildren(el('div', { class: 'error' }, 'No one has that code. Check it with your friend.'));
        if (found.uid === this.me.uid) return result.replaceChildren(el('div', { class: 'error' }, 'That\'s your own code.'));
        result.replaceChildren(await this.found(found, code));
      } catch (err) {
        result.replaceChildren(el('div', { class: 'error' }, this.explain(err)));
      }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') find(); });
    this.addWindow.setContent(
      el('label', { class: 'label' }, 'Their friend code'), input,
      el('button', { type: 'button', class: 'btn block', onclick: find }, 'Find'),
      result,
      ui.hint('There\'s no searching for people by name or email. Ask your friend for their code.', { small: true }));
    this.addWindow.open();
    if (prefill) find();
  }

  async found(person, code) {
    const existing = await this.store.friendship(person.uid);
    const card = (...kids) => el('div', { class: 'fr-card' }, personRow({ name: person.name }), ...kids);
    if (existing?.status === 'accepted') return card(ui.hint(`You and ${person.name} are already friends.`));
    if (existing?.from === this.me.uid) return card(ui.hint(`You've already asked ${person.name}.`));
    if (existing) {
      return card(ui.hint(`${person.name} has already asked you.`),
        el('button', { type: 'button', class: 'btn primary block', onclick: () => { this.addWindow.close(); this.accept(existing); } }, 'Accept'));
    }
    return card(
      el('p', { class: 'fr-warn' }, el('b', {}, `Sending a request lets ${person.name} see your timetable straight away`),
        ` (your classes for the next ${SHARE_DAYS / 7} weeks). You'll see theirs once they accept. You can cancel at any time.`),
      el('button', {
        type: 'button', class: 'btn primary block', onclick: () => {
          this.addWindow.close();
          this.act(async () => {
            await this.share({ force: true });
            await this.store.ask(this.state.profile, person, code);
          }, `Request sent to ${person.name}.`);
        },
      }, 'Send request'));
  }

  // ---- A friend's timetable ----

  openFriend(f) {
    if (!this.friendWindow) this.friendWindow = ui.dialog({ title: '', className: 'friends-timetable' });
    this.current = f;
    this.drawFriend();
    this.friendWindow.open();
  }

  drawFriend() {
    const f = this.current;
    const other = this.other(f);
    const name = this.nameOf(f);
    const hue = this.tints[other] ?? null;
    const today = new Date();
    const mine = this.sessions ? this.sessions.onDay(today).filter((s) => !s.cancelled).map((s) => ({ s: +s.start, e: +s.end })) : [];
    this.friendWindow.setTitle(`${name}'s timetable`);
    this.friendWindow.setContent(
      el('div', { class: 'fr-tint-row' }, el('span', {}, 'Colour'), tintChoice(hue, (h) => this.setTint(other, h))),
      timetableView({ name, shared: this.state.timetables[other], hue, mine }),
      f.status === 'accepted'
        ? el('button', { type: 'button', class: 'link-btn fr-remove', onclick: () => confirm(`Remove ${name}? You'll both stop seeing each other's timetable.`) && this.end(f, `Removed ${name}.`) }, `Remove ${name} as a friend`)
        : el('button', { type: 'button', class: 'btn primary block', onclick: () => { this.friendWindow.close(); this.accept(f); } }, `Accept and share mine with ${name}`));
  }

  setTint(uid, hue) {
    if (hue == null) delete this.tints[uid];
    else this.tints[uid] = hue;
    this.storage.set('tints', this.tints);
    this.drawFriend();
    this.draw();
  }

  // ---- On the account page ----

  accountSection(user) {
    if (!user) return null;
    const profile = this.cached;
    return el('section', { class: 'account-part' },
      el('h3', {}, 'Friends'),
      ui.hint(profile
        ? `Friends see you as ${profile.name}. Your code is ${profile.code}.`
        : 'Swap timetables with friends. Only people you\'ve asked or accepted can see yours.'),
      el('button', { type: 'button', class: 'btn small', onclick: () => this.open() }, 'Open Friends'));
  }
}
