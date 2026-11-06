// Friends: swap timetables with friends. The Friends button in the top bar opens it.
//
// - You get a friend code, an invite link and a QR code to give out, and can scan a friend's QR
//   code. There's no searching for people.
// - Asking someone (with their code) lets them see your timetable straight away; you see theirs
//   once they accept. Cancelling, declining or removing stops it both ways.
// - What's shared: your classes for the next 4 weeks (the university's names, times and rooms),
//   without modules you've hidden. It's kept up to date while you have friends or requests,
//   and deleted when you have none.
// - For each person you choose what they see: everything, or only when you're free or busy.
//   You can also pause sharing altogether.
// - A friend's timetable is shown in grey, or a tint you choose for them.
// - A Home widget shows which friends are free right now, from what was last loaded.
// The database rules (firebase/firestore.rules) enforce all of this; store.js does the writes.
//
// Saved data: 'profile' → { uid, name, code, people, paused } a copy of your online profile
//             'shared'  → { uid, print, at } what was last shared, so it isn't sent again
//             'tints'   → { [friend's uid]: hue } colours you chose (none means grey)
//             'circle'  → { uid, at, people: [{ uid, name, classes, paused }] } friends' next
//                         two days, for the Home widget
//             'invite'  → a friend code from an invite link, kept while you sign in

import { Feature, ui, time } from 'folio';
import { FriendStore } from './store.js';
import {
  codeFrom, inviteLink, firstName, cleanName, sharedClasses, fingerprint, stalePeople, explainProblem,
  onlyBusy, whoIsFree, SHARE_DAYS,
} from './rules.js';
import { personRow, statusLine, statusTag, tintChoice, shareChoice, timetableView, friendsWidget } from './screens.js';
import { startScanner } from './scanner.js';

const { el } = ui;
const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
const RESHARE = 12 * time.HOUR;
const RECHECK = 20 * time.MINUTE; // how old the Home widget's friends can get before they're loaded again

export default class Friends extends Feature {
  start() {
    this.addHelp();
    this.account = this.use('account');
    this.sessions = this.use('sessions');
    this.store = new FriendStore(this.account);
    this.tints = this.storage.get('tints', {});
    this.state = { profile: null, friendships: [], timetables: {}, loading: false, error: null };

    this.add('header.actions', { id: 'friends', label: 'Friends', icon: 'people', order: 10, visible: () => this.forStudents(), onClick: () => this.open() });
    this.add('account.sections', { order: 20, render: (user) => this.accountSection(user) });
    this.add('account.cleanup', { order: 10, remove: (db, uid) => FriendStore.removeAll(db, uid) });
    this.add('home.widgets', {
      id: 'friends', label: 'Friends', order: 35, sizes: ['wide', 'tall'],
      render: (size) => this.widget(size),
    });
    this.on('account:changed', (user) => {
      if (!user) return this.forget();
      this.recheck();
      const invite = this.storage.get('invite', null);
      if (invite) { this.storage.remove('invite'); this.openAdd(invite); }
    });
    this.on('sessions:changed', () => this.share());
    this.on('timetable:changed', () => this.share());
    this.on('app:ready', () => { this.share(); this.openFromLink(); this.recheck(); });
    this.on('app:resume', () => this.recheck());
    // An invite link opened while the web version is already open in that tab.
    window.addEventListener('hashchange', () => this.openFromLink());
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
    this.storage.remove('circle');
    this.state = { profile: null, friendships: [], timetables: {}, loading: false, error: null };
  }

  // ---- Loading and saving ----

  // Loads friends again in the background for the Home widget, if it's been a while. Only for
  // people who have opened Friends before (so it never makes a friend code by itself).
  recheck() {
    if (!this.me || !this.cached || !navigator.onLine || this.state.loading || this.window?.isOpen) return;
    const circle = this.storage.get('circle', null);
    if (circle?.uid === this.me.uid && Date.now() - circle.at < RECHECK) return;
    this.load();
  }

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
      this.storage.set('profile', { uid: this.me.uid, name: profile.name, code: profile.code, people: profile.people, paused: profile.paused === true });
      await this.share();
      // Timetables you can see: friends, and people who asked you (only when they're busy, if
      // that's all they share with you).
      const visible = friendships.filter((f) => f.status === 'accepted' || f.from !== this.me.uid);
      const timetables = {};
      await Promise.all(visible.map(async (f) => {
        const other = this.other(f);
        timetables[other] = await this.store.timetable(other, onlyBusy(f, other)).catch(() => null);
      }));
      this.state.timetables = timetables;
      this.keepCircle();
    } catch (err) {
      this.state.error = this.explain(err);
    } finally {
      this.state.loading = false;
      this.draw();
    }
  }

  // Friends' next two days, kept on the phone for the Home widget.
  keepCircle() {
    const now = Date.now();
    const soon = now + 2 * time.DAY;
    const people = this.state.friendships.filter((f) => f.status === 'accepted').map((f) => {
      const other = this.other(f);
      const shared = this.state.timetables[other];
      return {
        uid: other, name: this.nameOf(f), paused: shared?.paused === true,
        classes: shared ? shared.classes.filter((c) => c.e > now && c.s < soon).map(({ s, e, t }) => (t ? { s, e, t } : { s, e })) : null,
      };
    });
    this.storage.set('circle', { uid: this.me.uid, at: now, people });
    this.refresh();
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
      const paused = profile.paused === true;
      const classes = sharedClasses(this.sessions.all, (s) => this.sessions.isShown(s));
      const print = paused ? 'paused' : fingerprint(classes);
      if (!force && last?.uid === this.me.uid && last.print === print && Date.now() - last.at < RESHARE) return;
      await this.store.share(classes, { paused });
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
    return explainProblem(err, navigator.onLine);
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
        el('button', { type: 'button', class: 'btn small', onclick: () => this.shareInvite(profile.code) }, 'Send invite')),
      this.qrBox = el('div', { class: 'fr-qr', hidden: true }),
      el('div', { class: 'fr-buttons' },
        el('button', { type: 'button', class: 'btn primary', onclick: () => this.openAdd() }, 'Add a friend'),
        el('button', { type: 'button', class: 'btn', onclick: () => this.showQR(profile.code) }, 'Show my QR code')),
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
        const status = statusLine(this.state.timetables[this.other(f)]);
        return personRow({ name: this.nameOf(f), hue: this.tints[this.other(f)], line: status.text, right: statusTag(status), onOpen: () => this.openFriend(f) });
      }),
      list('Waiting for them', groups.waiting, (f) => personRow({
        name: this.nameOf(f), hue: this.tints[this.other(f)],
        line: 'They can see your timetable. You\'ll see theirs once they accept.',
        right: el('button', { type: 'button', class: 'btn small', onclick: () => this.end(f, 'Request cancelled.') }, 'Cancel'),
      })),
      !this.state.friendships.length && ui.hint('No friends yet. Send someone your invite, show them your QR code, or add their code.'),
      el('div', { class: 'fr-pause' },
        el('span', {}, el('b', {}, 'Share my timetable'),
          el('small', {}, profile.paused ? 'Paused: friends see "Has paused sharing".' : 'Friends see what you chose for each of them.')),
        ui.toggle({ checked: !profile.paused, label: 'Share my timetable', onChange: (on) => this.setPaused(!on) })),
      ui.hint(`Friends see your classes for the next ${SHARE_DAYS / 7} weeks: the university's names, times and rooms, or only when you're busy if you choose that for them (tap a friend). Modules you've hidden, notes, reminders and to-dos are never shared.`, { small: true }));
  }

  // The invite: a link that opens Add a friend with your code filled in, sent through the phone's
  // share menu (WhatsApp, Messages…), or copied.
  async shareInvite(code) {
    const link = inviteLink(code);
    const text = `Add me on Mobile Durham: ${link} (or type my friend code ${code} under Friends → Add a friend)`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(link); this.toast('Invite link copied.'); }
    } catch { /* closed the share sheet */ }
  }

  async setPaused(paused) {
    await this.act(async () => {
      await this.store.setPaused(paused);
      this.storage.set('profile', { ...this.cached, paused });
      await this.share({ force: true });
    }, paused ? 'Sharing paused.' : 'Sharing again.');
  }

  async showQR(code) {
    const box = this.qrBox;
    if (!box) return;
    box.hidden = !box.hidden;
    if (box.hidden || box.childElementCount) return;
    try {
      await ui.loadScript(QR_LIB);
      new window.QRCode(box, { text: inviteLink(code), width: 220, height: 220, colorDark: '#000000', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
      box.append(el('small', {}, 'Your friend opens Friends → Add a friend → Scan, or points their camera at it.'));
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

  // An invite link (…#friend=MD-…) opened the app: Add a friend, with the code filled in. If
  // you're not signed in, the code is kept until you are.
  openFromLink() {
    const code = codeFrom(location.hash);
    if (!code) return;
    history.replaceState(null, '', location.pathname + location.search);
    if (!this.me) {
      this.storage.set('invite', code);
      this.toast('Sign in to add your friend.');
    }
    this.openAdd(code);
  }

  openAdd(prefill = '') {
    if (!this.me) return this.open();
    if (!this.addWindow) this.addWindow = ui.dialog({ title: 'Add a friend', className: 'friends-add', onClose: () => this.scanner?.stop() });
    this.scanner?.stop();
    const input = el('input', { class: 'field fr-input', placeholder: 'MD-XXXX-XXXX', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', value: prefill });
    const result = el('div', { class: 'fr-result' });
    const camera = el('div', { class: 'fr-camera' });
    const find = async () => {
      const code = codeFrom(input.value);
      if (code) input.value = code;
      if (!code) return result.replaceChildren(el('div', { class: 'error' }, 'That doesn\'t look like a friend code or invite link. Codes look like MD-7K3Q-9P2X.'));
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
    const scan = () => {
      result.replaceChildren();
      this.scanner = startScanner(camera, {
        onText: (text) => {
          this.scanner = null;
          input.value = text;
          find();
        },
        onProblem: (text) => { this.scanner = null; result.replaceChildren(el('div', { class: 'error' }, text)); },
      });
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') find(); });
    input.addEventListener('paste', () => setTimeout(() => codeFrom(input.value) && find()));
    this.addWindow.setContent(
      el('button', { type: 'button', class: 'btn primary block fr-scan-btn', onclick: scan }, ui.icon('qr'), 'Scan their QR code'),
      camera,
      el('label', { class: 'label' }, 'Or type their friend code, or paste their invite link'), input,
      el('button', { type: 'button', class: 'btn block', onclick: find }, 'Find'),
      result,
      ui.hint('There\'s no searching for people by name or email. Ask your friend for their code, invite or QR code.', { small: true }));
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
    let busyOnly = false;
    const choice = el('div');
    const drawChoice = () => choice.replaceChildren(shareChoice(person.name, busyOnly, (value) => { busyOnly = value; drawChoice(); }));
    drawChoice();
    return card(
      el('p', { class: 'fr-warn' }, el('b', {}, `Sending a request lets ${person.name} see your timetable straight away`),
        ` (the next ${SHARE_DAYS / 7} weeks). You'll see theirs once they accept. You can cancel at any time.`),
      choice,
      el('button', {
        type: 'button', class: 'btn primary block', onclick: () => {
          this.addWindow.close();
          this.act(async () => {
            await this.share({ force: true });
            await this.store.ask(this.state.profile, person, code, busyOnly);
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
      shareChoice(name, onlyBusy(f, this.me.uid), (on) => this.setBusyOnly(f, on)),
      timetableView({ name, shared: this.state.timetables[other], hue, mine }),
      f.status === 'accepted'
        ? el('button', { type: 'button', class: 'link-btn fr-remove', onclick: () => confirm(`Remove ${name}? You'll both stop seeing each other's timetable.`) && this.end(f, `Removed ${name}.`) }, `Remove ${name} as a friend`)
        : el('button', { type: 'button', class: 'btn primary block', onclick: () => { this.friendWindow.close(); this.accept(f); } }, `Accept and share mine with ${name}`));
  }

  async setBusyOnly(f, on) {
    const name = this.nameOf(f);
    await this.act(() => this.store.setBusyOnly(f, on), on ? `${name} now sees only when you're busy.` : `${name} now sees your classes.`);
    const fresh = this.state.friendships.find((x) => x.id === f.id);
    if (fresh && this.friendWindow?.isOpen) { this.current = fresh; this.drawFriend(); }
  }

  // ---- The Home widget: which friends are free right now ----

  widget(size) {
    const open = () => this.open();
    if (!this.me) return friendsWidget({ size, message: 'Sign in to see which friends are free.', onOpen: open });
    const circle = this.storage.get('circle', null);
    if (circle?.uid !== this.me.uid) return friendsWidget({ size, message: 'Add friends to see who\'s free right now.', onOpen: open });
    if (!circle.people.length) return friendsWidget({ size, message: 'No friends yet. Tap to send an invite.', onOpen: open });
    const people = circle.people.map((p) => ({ ...p, hue: this.tints[p.uid] ?? null }));
    const { list, free } = whoIsFree(people);
    return friendsWidget({ size, list, free, onOpen: open });
  }

  setTint(uid, hue) {
    if (hue == null) delete this.tints[uid];
    else this.tints[uid] = hue;
    this.storage.set('tints', this.tints);
    this.drawFriend();
    this.draw();
    this.refresh();
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

  // Questions and answers for the Help page.
  addHelp() {
    for (const item of [
      { group: 'friends', order: 10, question: 'How do I add a friend?', answer: () => [
        'Sign in first. Then tap the Friends button (two people) at the top. Either send your invite (Send invite, then pick WhatsApp or Messages), show your QR code, or tap Add a friend and scan their QR code or type their code. There\'s no searching by name or email.',
      ] },
      { group: 'friends', order: 15, question: 'Can I see which friends are free on Home?', answer: () => [
        'Yes: the Friends widget on Home shows who\'s free right now. If it isn\'t there, add it with the pencil on Home (Customise Home). It updates when you open the app, at most every 20 minutes.',
      ] },
      { group: 'friends', order: 20, question: 'What can my friends see?', answer: () => [
        'Your name for friends and your classes for the next 4 weeks, with their times and rooms. Never hidden modules, your own module names, notes, reminders, to-dos, your timetable link, your email or your picture.',
        'You can choose, for each person, to share only when you\'re busy (not what or where): tap them in Friends and choose Only free or busy. To stop sharing with everyone for a while, switch off Share my timetable at the bottom of Friends.',
        'When you send a request, they can see yours straight away. You see theirs once they accept.',
      ] },
      { group: 'friends', order: 30, question: 'How do I stop sharing with someone?', answer: () => [
        'Open them in Friends and tap Remove. You both stop seeing each other\'s timetable straight away. For a request you sent, tap Cancel.',
      ] },
    ]) this.add('help.questions', item);
  }

  // Friends is for students: not in the business version, nor on the welcome screen before
  // anyone has chosen.
  forStudents() {
    const audience = this.use('audience');
    return !audience || audience.kind === 'student';
  }
}
