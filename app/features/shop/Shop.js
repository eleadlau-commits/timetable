// Shop: for businesses on Spots. In the business version of the app (the welcome feature's
// 'audience' service), the owner of a café, pub or club looks after their own card on Spots:
//
//   - Setting up: sign in (the account page), then type the shop code the team handed them, which
//     links their account to their place. No code? "Ask to be listed" sends the team their details.
//   - Home (business version): My card (the card as students see it), My deal, and This week (how
//     many phones saw the card and tapped its Website or Menu, without knowing who), plus a
//     "Your shop" page at the top.
//   - Edit card: the short line, the deal and its last day, opening hours, website and menu link.
//     A change doesn't show to students straight away: it waits until the team approves it.
//
// For the team: a signed-in account listed in the database's 'admins' collection gets an
// Approve changes row in the menu (with how many are waiting): approve or reject owners'
// changes and requests to be listed, and make shop codes (approve.js).
//
// On every phone in the student version, it counts (once a day per place) when Spots shows a
// place and when someone taps its Website or Menu ('spots:shown' and 'spots:tapped').
//
// What's stored online, and the rules for it, are in store.js and firebase/firestore.rules.
//
// Saved data (on this phone):
//   'mine'     → { place, card, change, stats, at }: the owner's place, its card as stored, a
//                change sent for approval, and the week's counts, so Home shows them straight away
//   'admin'    → true if this account approves changes
//   'counted'  → { day, seen: [ids], taps: [ids] }: what this phone counted today
//   'no-count' → true in test builds (app/tests/seed.js), so tests never count

import { Feature, ui, time } from 'folio';
import {
  FIELDS, KINDS, checkEdit, checkRequest, cleanCode, cardPreview, withChange, setupStep,
  millisToDay, weekOf, lastWeek, toCount,
} from './rules.js';
import * as store from './store.js';
import { Approver } from './approve.js';

const { el } = ui;
const AGAIN_AFTER = 5 * time.MINUTE;

export default class Shop extends Feature {
  start() {
    this.account = this.use('account');
    this.mine = this.storage.get('mine', null);
    this.admin = this.storage.get('admin', false) === true;
    this.request = null;
    this.loaded = false;
    this.waitingCount = 0;
    this.approver = new Approver(this);
    this.addHelp();

    this.add('home.pages', { id: 'shop', order: 1, audience: 'business', render: () => this.page() });
    this.add('home.widgets', {
      id: 'shop-card', label: 'My card', order: 1, sizes: ['large', 'tall', 'wide'], audience: 'business',
      render: (size) => this.cardWidget(size),
    });
    this.add('home.widgets', {
      id: 'shop-week', label: 'This week', order: 2, sizes: ['tall', 'wide'], audience: 'business',
      render: (size) => this.weekWidget(size),
    });
    this.add('home.widgets', {
      id: 'shop-deal', label: 'My deal', order: 3, sizes: ['wide', 'tall'], audience: 'business',
      render: (size) => this.dealWidget(size),
    });
    const feature = this;
    this.add('header.buttons', {
      id: 'approve', icon: 'check', order: 30,
      get label() { return feature.waitingCount ? `Approve changes (${feature.waitingCount})` : 'Approve changes'; },
      visible: () => this.admin && !!this.account?.user,
      onClick: () => this.approver.open(),
    });
    this.add('account.sections', { order: 15, render: () => this.accountSection() });
    this.add('account.cleanup', { order: 20, remove: (db, uid) => store.removeAll(db, uid) });

    this.on('app:ready', () => this.load());
    this.on('account:changed', (user) => {
      if (!user) this.forget();
      this.load();
    });
    this.on('audience:changed', ({ kind, first } = {}) => {
      this.load();
      if (kind === 'business' && first && this.step !== 'linked') this.openSetup();
    });
    this.on('app:resume', () => { if (Date.now() - (this.loadedAt || 0) > AGAIN_AFTER) this.load(); });
    this.on('spots:shown', (ids) => this.count('seen', ids));
    this.on('spots:tapped', (id) => this.count('taps', [id]));
  }

  get business() {
    return !!this.use('audience')?.isBusiness();
  }

  get step() {
    return setupStep({ user: this.account?.user, loaded: this.loaded || !!this.mine, owner: this.mine, request: this.request });
  }

  // ---- Loading from the database ----

  forget() {
    this.mine = null;
    this.admin = false;
    this.request = null;
    this.loaded = false;
    this.waitingCount = 0;
    this.storage.remove('mine');
    this.storage.remove('admin');
  }

  // Asks the database for this account's shop (in the business version) and whether it
  // approves changes. Nothing to do for someone signed out.
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
    if (!user?.verified) { this.loaded = true; return; }
    const db = await this.account.database();
    this.db = db;
    this.admin = await store.isAdmin(db, user.uid).catch(() => false);
    this.storage.set('admin', this.admin);
    if (this.business) {
      const owner = await store.ownerOf(db, user.uid);
      if (owner) {
        const [card, change, stats] = await Promise.all([
          store.placeDoc(db, owner.place).catch(() => null),
          store.changeOf(db, owner.place).catch(() => null),
          store.stats(db, owner.place, [weekOf(), lastWeek()]),
        ]);
        this.mine = { place: owner.place, card, change, stats, at: Date.now() };
        this.storage.set('mine', this.mine);
        this.request = null;
      } else {
        this.mine = null;
        this.storage.remove('mine');
        this.request = await store.requestOf(db, user.uid).catch(() => null);
      }
    }
    if (this.admin) {
      const { changes, requests } = await store.waiting(db).catch(() => ({ changes: [], requests: [] }));
      this.waitingCount = changes.length + requests.length;
    }
    this.loaded = true;
    this.loadedAt = Date.now();
  }

  redraw() {
    if (this.setupWindow?.isOpen) this.drawSetup();
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

  // ---- Home: the "Your shop" page and the widgets ----

  get card() {
    return this.mine?.card ? { ...this.mine.card, id: this.mine.place } : null;
  }

  get waiting() {
    return this.mine?.change?.status === 'waiting' ? this.mine.change : null;
  }

  statusText() {
    if (this.step !== 'linked') return 'Set up your place on Spots';
    if (this.waiting) return 'A change is waiting for approval';
    if (this.mine?.change?.status === 'rejected') return 'Your last change wasn\'t approved';
    if (this.card && this.card.published !== true) return 'Not on Spots yet';
    return 'Your card is live on Spots';
  }

  page() {
    const linked = this.step === 'linked';
    return el('section', { class: 'home-page-row', 'aria-label': 'Your shop' },
      el('div', {},
        el('h2', { class: 'home-page-title' }, linked && this.card?.name ? this.card.name : 'Your shop'),
        el('p', { class: 'home-page-line' }, this.statusText())),
      el('button', { type: 'button', class: 'home-button', onclick: () => (linked ? this.openEdit() : this.openSetup()) },
        el('b', {}, linked ? 'Edit card' : 'Set up'), ui.icon('right')));
  }

  notReady(title, size) {
    return el('div', { class: `shop-widget shop-widget-${size} shop-later` },
      el('b', {}, title),
      el('span', {}, 'Once your shop is set up'));
  }

  cardWidget(size) {
    if (this.step !== 'linked') {
      return el('button', { type: 'button', class: `shop-widget shop-widget-${size} shop-setup-widget`, onclick: () => this.openSetup() },
        el('b', {}, 'Set up your shop'),
        el('span', {}, 'Sign in and type the shop code we gave you, or ask to be listed.'),
        el('span', { class: 'btn small primary' }, 'Start'));
    }
    // The card as it will be once a waiting change is approved.
    const preview = cardPreview(withChange(this.card, this.waiting));
    return el('div', { class: `shop-widget shop-widget-${size} shop-card-widget` },
      el('div', { class: 'shop-widget-head' },
        el('b', {}, 'My card'),
        el('span', { class: `shop-tag ${this.waiting ? 'is-waiting' : ''}` }, this.waiting ? 'Waiting' : this.card?.published === true ? 'Live' : 'Not live')),
      el('div', { class: 'shop-card-summary' },
        el('b', { class: 'shop-card-name' }, preview?.name || 'Your place'),
        preview?.line && el('span', { class: 'shop-card-line' }, preview.line),
        preview?.deal && el('span', { class: 'shop-card-deal' }, preview.deal),
        preview?.hours && el('span', { class: 'shop-card-line' }, preview.hours)),
      el('button', { type: 'button', class: 'btn small', onclick: () => this.openEdit() }, 'Edit card'));
  }

  dealWidget(size) {
    if (this.step !== 'linked') return this.notReady('My deal', size);
    const preview = cardPreview(this.card);
    return el('button', { type: 'button', class: `shop-widget shop-widget-${size} shop-deal-widget`, onclick: () => this.openEdit('deal') },
      el('b', {}, 'My deal'),
      el('span', { class: 'shop-deal-text' }, preview?.deal || 'No deal on right now'),
      el('small', {}, this.waiting ? 'New deal waiting for approval' : preview?.until || (preview?.deal ? 'No end date' : 'Tap to add one')));
  }

  weekWidget(size) {
    if (this.step !== 'linked') return this.notReady('This week', size);
    const [now, before] = this.mine?.stats || [];
    const number = (n, words) => el('div', { class: 'shop-number' }, el('b', {}, String(n || 0)), el('span', {}, words));
    return el('div', { class: `shop-widget shop-widget-${size} shop-week-widget` },
      el('b', {}, 'This week'),
      number(now?.seen, 'saw your card'),
      number(now?.taps, 'tapped your website or menu'),
      el('small', {}, `Last week: ${before?.seen || 0} saw it`));
  }

  // ---- Setting up ----

  openSetup() {
    if (!this.setupWindow) this.setupWindow = ui.dialog({ title: 'Set up your business', className: 'shop-dialog' });
    this.asking = false;
    this.drawSetup();
    this.setupWindow.open();
    if (this.account?.user && !this.loaded) this.load();
  }

  drawSetup() {
    const step = this.step;
    const w = this.setupWindow;
    const intro = (...lines) => lines.map((l) => el('p', {}, l));
    if (!this.account) {
      w.setContent(ui.missing('Accounts are switched off'));
    } else if (step === 'signed-out') {
      w.setContent(el('div', { class: 'shop-setup' },
        this.steps(1),
        ...intro('First, make an account for your business (or sign in). It keeps your place yours: only you can change its card.'),
        el('button', { type: 'button', class: 'btn primary block', onclick: () => this.account.open() }, 'Sign in or create an account')));
    } else if (step === 'unconfirmed') {
      w.setContent(el('div', { class: 'shop-setup' },
        this.steps(1),
        ...intro('Confirm your email address: tap the link in the email we sent you, then come back here.'),
        el('button', { type: 'button', class: 'btn block', onclick: () => this.account.open() }, 'Open your account')));
    } else if (step === 'loading') {
      w.setContent(el('p', { class: 'hint' }, 'Checking…'));
    } else if (step === 'linked') {
      w.setContent(el('div', { class: 'shop-setup' },
        this.steps(3),
        el('h3', {}, `You look after ${this.card?.name || 'your place'}`),
        ...intro('Your card and your deal are on Home. Changes you make are checked by the Mobile Durham team before students see them, usually within a day.'),
        el('button', { type: 'button', class: 'btn primary block', onclick: () => { w.close(); this.app.shell.selectView('home'); } }, 'Go to your shop')));
    } else if (step === 'asked') {
      w.setContent(el('div', { class: 'shop-setup' },
        this.steps(2),
        el('h3', {}, 'Thanks! Your request is waiting'),
        ...intro(`We'll look at ${this.request.name} and get in touch (${this.request.contact}). Once it's approved, your card appears on Spots and here on Home.`),
        el('button', { type: 'button', class: 'btn block', onclick: () => this.withdrawRequest() }, 'Withdraw my request')));
    } else if (this.asking) {
      w.setContent(this.requestForm());
    } else {
      w.setContent(this.codeForm(step === 'refused'));
    }
  }

  steps(at) {
    return el('ol', { class: 'shop-steps', 'aria-label': `Step ${at} of 3` },
      ['Account', 'Your place', 'Done'].map((name, i) => el('li', { class: i + 1 < at ? 'done' : i + 1 === at ? 'now' : '' }, name)));
  }

  codeForm(refused) {
    const input = el('input', {
      id: 'shop-code', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
      placeholder: 'e.g. K7QM-2XPA', maxlength: '12',
    });
    const error = ui.errorBox();
    const go = async () => {
      const code = cleanCode(input.value);
      if (!code) return error.show('A shop code has 8 letters and numbers, like K7QM-2XPA.');
      const done = await this.attempt((db) => store.useCode(db, this.account.user.uid, code), error);
      if (done) {
        this.toast('Your place is linked to your account.');
        await this.load();
      }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    return el('div', { class: 'shop-setup' },
      this.steps(2),
      refused && el('p', { class: 'shop-note' }, 'We couldn\'t list your place from your last request. Email mobiledurham.help@gmail.com if you\'d like to talk about it.'),
      el('h3', {}, 'Have a shop code?'),
      el('p', {}, 'When your place joins Spots, we give you a code. Type it here to link your place to this account.'),
      el('label', { class: 'label', for: 'shop-code' }, 'Shop code'),
      el('div', { class: 'field' }, input, el('button', { type: 'button', class: 'btn primary', onclick: go }, 'Link')),
      error,
      el('div', { class: 'shop-or' }, el('span', {}, 'or')),
      el('h3', {}, 'No code yet?'),
      el('p', {}, 'Tell us about your place and we\'ll be in touch. Listing on Spots is free.'),
      el('button', { type: 'button', class: 'btn block', onclick: () => { this.asking = true; this.drawSetup(); } }, 'Ask to be listed'));
  }

  requestForm() {
    const form = {};
    const error = ui.errorBox();
    const box = (key, label, attrs = {}) => {
      const input = el('input', { id: `shop-ask-${key}`, type: 'text', ...attrs });
      form[key] = input;
      return el('div', { class: 'shop-field' }, el('label', { class: 'label', for: input.id }, label), input);
    };
    const kind = ui.select([['', 'Choose…'], ...KINDS], { id: 'shop-ask-kind' });
    form.kind = kind;
    const send = async () => {
      const typed = Object.fromEntries(Object.entries(form).map(([k, input]) => [k, input.value]));
      const { request, error: wrong } = checkRequest(typed);
      if (wrong) return error.show(wrong);
      const done = await this.attempt((db) => store.sendRequest(db, this.account.fields, this.account.user.uid, request), error);
      if (done) {
        this.asking = false;
        this.toast('Request sent. We\'ll be in touch.');
        await this.load();
      }
    };
    return el('div', { class: 'shop-setup shop-form' },
      this.steps(2),
      el('h3', {}, 'Ask to be listed'),
      box('name', 'Name of your place', { maxlength: '60' }),
      el('div', { class: 'shop-field' }, el('label', { class: 'label', for: 'shop-ask-kind' }, 'What kind of place'), kind),
      box('address', 'Address', { maxlength: '120' }),
      box('contact', 'Phone or email, so we can get in touch', { maxlength: '120' }),
      ...this.cardFields(form, {}),
      error,
      el('button', { type: 'button', class: 'btn primary block', onclick: send }, 'Send request'),
      el('button', { type: 'button', class: 'btn block', onclick: () => { this.asking = false; this.drawSetup(); } }, 'Back'));
  }

  async withdrawRequest() {
    if (!confirm('Withdraw your request to be listed?')) return;
    if (await this.attempt((db) => store.withdrawRequest(db, this.account.user.uid))) await this.load();
  }

  // The boxes for the parts of a card an owner can change, filled with `values`.
  cardFields(form, values) {
    return FIELDS.map((f) => {
      const id = `shop-${f.key}`;
      const input = el('input', {
        id,
        type: f.type === 'date' ? 'date' : f.type === 'link' ? 'url' : 'text',
        maxlength: f.most ? String(f.most) : null,
        inputmode: f.type === 'link' ? 'url' : null,
        autocapitalize: f.type === 'link' ? 'off' : null,
        placeholder: f.type === 'link' ? 'https://…' : null,
      });
      input.value = f.type === 'date' ? millisToDay(values[f.key]) : (values[f.key] || '');
      form[f.key] = input;
      return el('div', { class: 'shop-field' },
        el('label', { class: 'label', for: id }, f.label),
        input,
        el('small', { class: 'hint small' }, f.hint));
    });
  }

  // ---- Editing the card ----

  openEdit(focus = null) {
    if (this.step !== 'linked') return this.openSetup();
    if (!this.editWindow) this.editWindow = ui.dialog({ title: 'Edit your card', className: 'shop-dialog' });
    this.drawEdit();
    this.editWindow.open();
    if (focus) this.editWindow.content?.querySelector(`#shop-${focus}`)?.focus();
  }

  drawEdit() {
    const w = this.editWindow;
    w.typing = false;
    const card = this.card || {};
    const waiting = this.waiting;
    const form = {};
    const error = ui.errorBox();
    const send = async () => {
      const typed = Object.fromEntries(Object.entries(form).map(([k, input]) => [k, input.value]));
      const { change, error: wrong } = checkEdit(typed);
      if (wrong) return error.show(wrong);
      const done = await this.attempt((db) => store.sendChange(db, this.account.fields, this.account.user.uid, this.mine.place, change), error);
      if (done) {
        this.toast('Sent. We\'ll check it, usually within a day.');
        w.close();
        await this.load();
      }
    };
    const withdraw = async () => {
      if (!confirm('Withdraw the change? Your card stays as it is now.')) return;
      if (await this.attempt((db) => store.withdrawChange(db, this.mine.place), error)) await this.load();
    };
    const fields = this.cardFields(form, waiting || card);
    const node = el('div', { class: 'shop-form' },
      waiting
        ? el('p', { class: 'shop-note' }, `A change is waiting for approval (sent ${waiting.at ? time.ago(waiting.at) : 'just now'}). Students see your card as it was until then. You can change it again below.`)
        : this.mine?.change?.status === 'rejected'
          ? el('p', { class: 'shop-note' }, 'Your last change wasn\'t approved. Check it follows the guidelines below and send it again, or email mobiledurham.help@gmail.com.')
          : null,
      this.use('spots') && el('div', { class: 'shop-preview' },
        el('span', { class: 'label' }, waiting ? 'How it will look once approved' : 'How students see it now'),
        this.use('spots').place(cardPreview(withChange(card, waiting)))),
      el('h3', {}, `Change ${card.name || 'your card'}`),
      ...fields,
      ui.hint('Keep it honest and simple: a real deal students can use, no drinks deals that push heavy drinking. The Mobile Durham team checks every change before students see it.', { small: true }),
      error,
      el('button', { type: 'button', class: 'btn primary block', onclick: send }, waiting ? 'Send new version' : 'Send for approval'),
      waiting && el('button', { type: 'button', class: 'btn block', onclick: withdraw }, 'Withdraw the change'));
    // Don't redraw over what someone is typing.
    node.addEventListener('input', () => { w.typing = true; });
    w.setContent(node);
  }

  // ---- The account page ----

  accountSection() {
    if (!this.business) return null;
    const linked = this.step === 'linked';
    return el('section', { class: 'shop-account' },
      el('h3', {}, 'Your business'),
      el('p', { class: 'hint' }, linked ? `You look after ${this.card?.name || 'a place'} on Spots.` : 'Not linked to a place yet.'),
      el('button', { type: 'button', class: 'btn small', onclick: () => (linked ? this.openEdit() : this.openSetup()) }, linked ? 'Edit card' : 'Set up your shop'));
  }

  // Questions and answers for the Help page.
  addHelp() {
    for (const item of [
      { group: 'business', order: 10, question: 'How do I put my business on Spots?', answer: () => [
        'Choose "I run a business" when you first open the app (or in Settings → Using the app as). Make an account, then type the shop code we gave you. No code? Tap Ask to be listed and we\'ll get in touch. Listing is free.',
      ] },
      { group: 'business', order: 20, question: 'How do I change my deal?', answer: () => [
        'On Home, tap My deal or Edit card, change what you need and tap Send for approval. The Mobile Durham team checks every change, usually within a day; until then students see your card as it was.',
      ] },
      { group: 'business', order: 30, question: 'What does This week count?', answer: () => [
        'How many phones showed your card on Spots this week, and how many tapped your Website or Menu button. Each phone counts once a day. We never know who they are.',
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
