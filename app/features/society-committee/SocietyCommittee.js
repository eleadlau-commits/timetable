// Your society: for society committees, who are students and stay in the student version. A
// committee member looks after their society's card on Explore, the way a shop looks after its
// card on Spots:
//
//   - Setting up: on the account page (signed in), "I run a society", then the society code the
//     team handed them, which links their account to the society. One code per person.
//   - The Your society window: the same card frame as the business version's Your shop tab (the
//     storefront feature's 'storefront' service), with Your society on Explore (the card exactly
//     as students see it, with Change details) and How it's going (four weeks of how many phones
//     showed the society, and tapped Instagram or Join, without knowing who).
//   - Change details (short line, when and where you meet, joining fee, Instagram, join link). A
//     change doesn't show to students straight away: the team checks it first.
//   - A Your society widget people can add to Home (off until added).
//
// For the team: a Societies part in the shop feature's Approve changes window ('approve.parts'):
// approve or reject changes, and make society codes (approve.js).
//
// On every phone in the student version, it counts (once a day per society) when the Societies
// list shows a society and when someone taps its Instagram or Join ('societies:shown' and
// 'societies:tapped', from the societies feature).
//
// What's stored online, and the rules for it, are in store.js and firebase/firestore.rules.
//
// Saved data (on this phone):
//   'mine'     → { society, code, card, change, stats, at }: the society this account helps run,
//                its card as stored, a change sent for approval and the counts, so it shows
//                straight away
//   'counted'  → { day, seen: [ids], taps: [ids] }: what this phone counted today
//   'no-count' → true in test builds (app/tests/seed.js), so tests never count

import { Feature, ui, time } from 'folio';
import {
  FIELDS, checkEdit, cleanCode, showInstagram, withChange, setupStep, weekOf, weeksBack, trend, trendSentence, toCount,
} from './rules.js';
import * as store from './store.js';
import { SocietyApprovals } from './approve.js';

const { el } = ui;
const AGAIN_AFTER = 5 * time.MINUTE;
const TREND_WEEKS = 4;
const WEEK_NAMES = ['This week', 'Last week', '2 weeks ago', '3 weeks ago'];

export default class SocietyCommittee extends Feature {
  start() {
    this.account = this.use('account');
    this.mine = this.storage.get('mine', null);
    this.loaded = false;
    this.approvals = new SocietyApprovals(this);
    this.addHelp();

    this.add('account.sections', { order: 16, render: () => this.accountSection() });
    this.add('account.cleanup', { order: 25, remove: (db, uid) => store.removeAll(db, uid) });
    this.add('approve.parts', this.approvals.part());
    this.add('home.widgets', {
      id: 'society', label: 'Your society', order: 40, sizes: ['wide', 'tall'], start: false,
      render: (size) => this.widget(size),
    });

    this.on('app:ready', () => this.load());
    this.on('account:changed', (user) => {
      if (!user) this.forget();
      this.load();
    });
    this.on('audience:changed', () => this.refresh());
    this.on('app:resume', () => { if (Date.now() - (this.loadedAt || 0) > AGAIN_AFTER) this.load(); });
    this.on('societies:shown', (ids) => this.count('seen', ids));
    this.on('societies:tapped', (id) => this.count('taps', [id]));
  }

  get business() {
    return !!this.use('audience')?.isBusiness();
  }

  get step() {
    return setupStep({ user: this.account?.user, loaded: this.loaded, mine: this.mine });
  }

  get linked() {
    return this.step === 'linked';
  }

  // ---- Loading from the database ----

  forget() {
    this.mine = null;
    this.loaded = false;
    this.storage.remove('mine');
  }

  load() {
    if (this.loading) return this.loading;
    this.loading = this.fetch()
      .catch(() => {})
      .finally(() => {
        this.loading = null;
        this.redraw();
      });
    return this.loading;
  }

  async fetch() {
    const user = this.account?.user;
    if (!user?.verified || this.business) { this.loaded = true; return; }
    const db = await this.account.database();
    const owner = await store.ownerOf(db, user.uid);
    if (owner) {
      const [card, change, stats] = await Promise.all([
        store.societyDoc(db, owner.society).catch(() => null),
        store.changeOf(db, owner.society).catch(() => null),
        store.stats(db, owner.society, weeksBack(TREND_WEEKS)),
      ]);
      this.mine = { society: owner.society, code: owner.code, card, change, stats, at: Date.now() };
      this.storage.set('mine', this.mine);
    } else {
      this.forget();
    }
    this.loaded = true;
    this.loadedAt = Date.now();
  }

  redraw() {
    if (this.setupWindow?.isOpen) this.drawSetup();
    if (this.pageWindow?.isOpen) this.drawPage();
    if (this.editWindow?.isOpen && !this.editWindow.typing) this.drawEdit();
    this.account?.redraw();
    this.refresh();
  }

  // Runs a step that talks to the database, showing a plain message if it fails.
  async attempt(step, errorBox) {
    if (this.busy) return false;
    this.busy = true;
    errorBox?.show('');
    try {
      await step(await this.account.database());
      return true;
    } catch (err) {
      const message = explain(err);
      if (errorBox) errorBox.show(message);
      else this.toast(message);
      return false;
    } finally {
      this.busy = false;
    }
  }

  // ---- Counting, on students' phones ----

  async count(kind, ids) {
    if (this.business || this.storage.get('no-count', false) || !this.account || !navigator.onLine) return;
    const { fresh, record } = toCount(this.storage.get('counted', null), kind, ids || []);
    if (!fresh.length) return;
    this.storage.set('counted', record);
    try {
      const db = await this.account.publicDatabase();
      const week = weekOf();
      for (const id of fresh) await store.count(db, this.account.fields, id, week, kind).catch(() => {});
    } catch { /* offline, or Firebase couldn't load: it's only a count */ }
  }

  // ---- The society, as students see it ----

  get card() {
    return this.mine?.card ? { ...this.mine.card, id: this.mine.society } : null;
  }

  get waiting() {
    return this.mine?.change?.status === 'waiting' ? this.mine.change : null;
  }

  get name() {
    return this.card?.name || 'your society';
  }

  // The card with a waiting change on top, tidied the way the Societies list tidies it.
  preview() {
    const shown = withChange(this.card, this.waiting);
    if (!shown) return null;
    const societies = this.use('societies');
    return societies ? societies.tidy(shown.id, shown) : { id: shown.id, name: String(shown.name || '') };
  }

  tag() {
    if (!this.linked) return null;
    if (this.waiting) return { text: 'Being checked', tone: 'wait' };
    if (this.card?.published !== true) return { text: 'Not on Explore', tone: 'off' };
    return { text: 'Live', tone: 'live' };
  }

  get points() {
    return trend(this.mine?.stats, weeksBack(TREND_WEEKS));
  }

  // ---- The account page ----

  accountSection() {
    if (this.business || !this.account) return null;
    if (!this.linked) {
      return el('section', { class: 'committee-account' },
        el('h3', {}, 'Societies'),
        el('p', { class: 'hint' }, 'On a society\'s committee? Keep its card on Explore up to date yourself.'),
        el('button', { type: 'button', class: 'btn small', onclick: () => this.openSetup() }, 'I run a society'));
    }
    return el('section', { class: 'committee-account' },
      el('h3', {}, 'Your society'),
      el('p', { class: 'hint' }, `You help run ${this.name} on Explore.`),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn small primary', onclick: () => this.openPage() }, 'Open Your society'),
        el('button', { type: 'button', class: 'link-btn', onclick: () => this.leave() }, 'Stop looking after it')));
  }

  async leave() {
    if (!confirm(`Stop looking after ${this.name}? You'll need a new society code to look after it again.`)) return;
    const owner = { code: this.mine?.code };
    if (await this.attempt((db) => store.leave(db, this.account.user.uid, owner))) {
      this.forget();
      this.toast('Done. You no longer look after the society.');
      this.pageWindow?.close();
      await this.load();
    }
  }

  // ---- Setting up: the society code ----

  openSetup() {
    if (this.linked) return this.openPage();
    if (!this.setupWindow) this.setupWindow = ui.dialog({ title: 'I run a society', className: 'committee-dialog' });
    this.drawSetup();
    this.setupWindow.open();
    if (this.account?.user && !this.loaded) this.load();
  }

  drawSetup() {
    const w = this.setupWindow;
    const step = this.step;
    if (!this.account) return w.setContent(ui.missing('Accounts are switched off'));
    if (step === 'linked') {
      return w.setContent(el('div', { class: 'committee-setup' },
        el('h3', {}, `You help run ${this.name}`),
        el('p', {}, 'Everything about your society is in Your society: how students see it, and how it\'s going. Changes you send are checked by the Mobile Durham team before students see them, usually within a day.'),
        el('button', { type: 'button', class: 'btn primary block', onclick: () => { w.close(); this.openPage(); } }, 'Open Your society')));
    }
    if (step === 'signed-out') {
      return w.setContent(el('div', { class: 'committee-setup' },
        el('p', {}, 'Sign in first. It keeps your society\'s card safe: only committee members can send changes.'),
        el('button', { type: 'button', class: 'btn primary block', onclick: () => this.account.open() }, 'Sign in')));
    }
    if (step === 'unconfirmed') {
      return w.setContent(el('div', { class: 'committee-setup' },
        el('p', {}, 'Confirm your email address first: tap the link in the email we sent you, then come back here.'),
        el('button', { type: 'button', class: 'btn block', onclick: () => this.account.open() }, 'Open your account')));
    }
    if (step === 'loading') return w.setContent(el('p', { class: 'hint' }, 'Checking…'));
    const input = el('input', {
      id: 'society-code', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
      placeholder: 'e.g. K7QM-2XPA', maxlength: '12',
    });
    const error = ui.errorBox();
    const go = async () => {
      const code = cleanCode(input.value);
      if (!code) return error.show('A society code has 8 letters and numbers, like K7QM-2XPA.');
      const done = await this.attempt((db) => store.useCode(db, this.account.user.uid, code), error);
      if (done) {
        this.toast('Your society is linked to your account.');
        await this.load();
        if (this.linked) { w.close(); this.openPage(); }
      }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    w.setContent(el('div', { class: 'committee-setup' },
      el('h3', {}, 'Have a society code?'),
      el('p', {}, 'The Mobile Durham team gives each committee member a code for their society. Type yours to link the society to this account. Then you can change its card and see how it\'s going.'),
      el('label', { class: 'label', for: 'society-code' }, 'Society code'),
      el('div', { class: 'field' }, input, el('button', { type: 'button', class: 'btn primary', onclick: go }, 'Link')),
      error,
      el('h3', {}, 'No code yet?'),
      el('p', {}, 'Email mobiledurham.help@gmail.com from your society\'s email, or ask your president to. If your society isn\'t on Explore yet, tell us about it and we\'ll add it.')));
  }

  // ---- Your society: the society's cards ----

  cards() {
    return [
      {
        id: 'society-card', order: 10, title: 'Your society on Explore',
        tag: () => this.tag(),
        render: () => this.societyCard(),
        action: () => ({ label: 'Change details', primary: true, onClick: () => this.openEdit() }),
      },
      {
        id: 'society-week', order: 20, title: 'How it\'s going',
        render: () => this.trendCard(),
      },
    ];
  }

  openPage() {
    if (!this.linked) return this.openSetup();
    if (!this.pageWindow) this.pageWindow = ui.dialog({ title: 'Your society', className: 'committee-dialog committee-page' });
    this.drawPage();
    this.pageWindow.open();
    if (Date.now() - (this.loadedAt || 0) > AGAIN_AFTER) this.load();
  }

  drawPage() {
    const w = this.pageWindow;
    if (!this.linked) return w.close();
    w.setTitle(this.card?.name || 'Your society');
    const frame = this.use('storefront');
    const cards = frame ? frame.cards(this.cards()) : this.cards().map((c) => this.plainCard(c)).filter(Boolean);
    w.setContent(el('div', { class: 'storefront committee-cards' }, ...(cards.length ? cards : [ui.missing('Your society\'s details')])));
  }

  // A card without the storefront feature: a title, what's inside and its button.
  plainCard(card) {
    try {
      const action = card.action?.();
      return el('section', { class: 'committee-plain-card', 'aria-label': card.title },
        el('h2', {}, card.title),
        card.render(),
        action && el('button', { type: 'button', class: 'btn block primary', onclick: action.onClick }, action.label));
    } catch {
      return null;
    }
  }

  notes() {
    if (this.waiting) {
      return el('p', { class: 'committee-note' }, `Your change is being checked by the Mobile Durham team (sent ${this.waiting.at ? time.ago(this.waiting.at) : 'just now'}), usually within a day. Until then, students see your society as it was. This is how it will look:`);
    }
    if (this.mine?.change?.status === 'rejected') {
      return el('p', { class: 'committee-note' }, 'Your last change wasn\'t approved. Change it and send it again, or email mobiledurham.help@gmail.com.');
    }
    if (this.card && this.card.published !== true) {
      return el('p', { class: 'committee-note' }, 'Your society isn\'t on Explore yet. The team puts it on once its card is ready.');
    }
    return null;
  }

  societyCard() {
    const preview = this.preview();
    const societies = this.use('societies');
    return el('div', { class: 'committee-inside' },
      this.notes(),
      preview && societies ? el('div', { class: 'committee-preview' }, societies.card(preview)) : el('p', {}, preview?.name || this.name),
      !preview?.photo && el('p', { class: 'hint small' }, 'Want a photo or logo on your card? Email one to mobiledurham.help@gmail.com and we\'ll add it.'));
  }

  bars(points) {
    const most = Math.max(1, ...points.map((p) => p.seen));
    return el('div', { class: 'committee-bars', role: 'img', 'aria-label': points.map((p) => `Week of ${p.label}: ${p.seen}`).join(', ') },
      points.map((p, i) => el('div', { class: `committee-bar${i === points.length - 1 ? ' is-now' : ''}` },
        el('span', { class: 'committee-bar-fill', style: `height: ${Math.max(4, Math.round((p.seen / most) * 100))}%` }),
        el('b', {}, String(p.seen)),
        el('small', {}, WEEK_NAMES[points.length - 1 - i] || p.label))));
  }

  trendCard() {
    const points = this.points;
    return el('div', { class: 'committee-trend' },
      this.bars(points),
      el('p', {}, trendSentence(points)),
      el('p', { class: 'hint small' }, 'Each phone counts once a day. We never know who they are.'));
  }

  // ---- Changing the card ----

  openEdit() {
    if (!this.linked) return this.openSetup();
    if (!this.editWindow) this.editWindow = ui.dialog({ title: 'Change details', className: 'committee-dialog' });
    this.drawEdit();
    this.editWindow.open();
  }

  drawEdit() {
    const w = this.editWindow;
    w.typing = false;
    const values = this.waiting || this.card || {};
    const form = {};
    const error = ui.errorBox();
    const boxes = FIELDS.map((f) => {
      const id = `society-${f.key}`;
      const input = el('input', {
        id,
        type: f.type === 'link' ? 'url' : 'text',
        maxlength: f.most ? String(f.most) : null,
        inputmode: f.type === 'link' ? 'url' : null,
        autocapitalize: f.type ? 'off' : null,
        placeholder: f.type === 'link' ? 'https://…' : f.type === 'instagram' ? '@yoursociety' : null,
      });
      input.value = f.type === 'instagram' ? showInstagram(values[f.key]) : String(values[f.key] || '');
      form[f.key] = input;
      return el('div', { class: 'committee-field' },
        el('label', { class: 'label', for: id }, f.label),
        input,
        f.hint && el('small', { class: 'hint small' }, f.hint));
    });
    const send = async () => {
      const typed = Object.fromEntries(Object.entries(form).map(([k, input]) => [k, input.value]));
      const { change, error: wrong } = checkEdit(typed);
      if (wrong) return error.show(wrong);
      const done = await this.attempt((db) => store.sendChange(db, this.account.fields, this.account.user.uid, this.mine.society, change), error);
      if (done) {
        this.toast('Sent. We\'ll check it, usually within a day.');
        w.close();
        await this.load();
      }
    };
    const withdraw = async () => {
      if (!confirm('Withdraw the change? Your society\'s card stays as it is now.')) return;
      if (await this.attempt((db) => store.withdrawChange(db, this.mine.society), error)) await this.load();
    };
    const node = el('div', { class: 'committee-form' },
      this.waiting && el('p', { class: 'committee-note' }, 'A change is being checked. Students see your society as it was until then. You can change it again here.'),
      ...boxes,
      ui.hint('Keep it honest and friendly: the Mobile Durham team checks every change before students see it. To change your society\'s name or photo, email mobiledurham.help@gmail.com.', { small: true }),
      error,
      el('button', { type: 'button', class: 'btn primary block', onclick: send }, 'Send to be checked'),
      this.waiting && el('button', { type: 'button', class: 'btn block', onclick: withdraw }, 'Withdraw the change'));
    node.addEventListener('input', () => { w.typing = true; });
    w.setContent(node);
  }

  // ---- Home ----

  widget(size) {
    if (!this.linked) {
      return el('button', { type: 'button', class: `committee-widget committee-widget-${size} is-setup`, onclick: () => this.openSetup() },
        el('b', {}, 'Your society'),
        el('span', {}, 'On a committee? Link your society with its code.'));
    }
    const now = this.points[this.points.length - 1];
    const tag = this.tag();
    return el('button', { type: 'button', class: `committee-widget committee-widget-${size}`, onclick: () => this.openPage() },
      el('div', { class: 'committee-widget-head' },
        el('b', {}, this.card?.name || 'Your society'),
        tag && el('span', { class: `committee-tag is-${tag.tone}` }, tag.text)),
      el('span', { class: 'committee-widget-count' }, String(now?.seen || 0)),
      el('small', {}, 'saw it this week'));
  }

  addHelp() {
    for (const item of [
      { group: 'around', order: 45, question: 'How do I keep my society\'s card up to date?', answer: () => [
        'Ask us for a society code (email mobiledurham.help@gmail.com). Sign in, open your account page and tap I run a society, then type the code. Your society shows your card as students see it, and how many saw it each week. Tap Change details to change your short line, when you meet, your fee, Instagram or join link. We check each change before students see it, usually within a day.',
        'Each committee member needs their own code. When you hand over to next year\'s committee, tap Stop looking after it on your account page.',
      ] },
    ]) this.add('help.questions', item);
  }
}

// What went wrong, in plain words.
function explain(err) {
  switch (err?.message) {
    case 'bad-code': return 'We couldn\'t find that code. Check it, or ask us for a new one.';
    case 'used-code': return 'That code has already been used by another account. Ask us for a new one.';
    case 'signed-out': return 'Sign in first.';
    case 'unverified': return 'Confirm your email address first: tap the link in the email we sent you.';
    case 'load': return 'Couldn\'t connect. Check you\'re online and try again.';
    default:
      if (err?.code === 'permission-denied') return 'That isn\'t allowed. If you think it should be, email mobiledurham.help@gmail.com.';
      if (err?.code === 'unavailable') return 'Couldn\'t connect. Check you\'re online and try again.';
      return 'Something went wrong. Please try again.';
  }
}
