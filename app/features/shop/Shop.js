// Shop: for businesses on Spots. In the business version of the app (the welcome feature's
// 'audience' service), the owner of a café, pub or club looks after their own card on Spots:
//
//   - Setting up: sign in (the account page), then type the shop code the team handed them, which
//     links their account to their place. No code? "Ask to be listed" sends the team their details.
//   - The Your shop tab (the storefront feature's 'storefront.cards'): Your shop on Spots (the card
//     exactly as students see it), Student deal (what's on, and a new one being checked), and How
//     it's going (four weeks of how many phones saw the card, and tapped its Website or Menu,
//     without knowing who). The same three are widgets the owner can put on Home (two are there
//     to start with), plus a "Your shop" page at the top of Home.
//   - Change details (short line, opening times day by day, website, menu link) and Change the
//     deal (the deal and its last day). A change doesn't show to students straight away: it's
//     checked by the team first.
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
  millisToDay, weekOf, weeksBack, trend, trendSentence, toCount,
} from './rules.js';
import * as store from './store.js';
import { Approver } from './approve.js';

const { el } = ui;
const AGAIN_AFTER = 5 * time.MINUTE;
const TREND_WEEKS = 4; // weeks of counts on How it's going
const WEEK_NAMES = ['This week', 'Last week', '2 weeks ago', '3 weeks ago'];

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
    // The shop's cards on the Your shop tab (the storefront feature)…
    this.add('storefront.cards', {
      id: 'shop-card', order: 10, title: 'Your shop on Spots',
      heading: () => (this.step === 'linked' ? this.card?.name || '' : ''),
      tag: () => this.cardTag(),
      render: () => this.shopCard(),
      action: () => (this.step === 'linked'
        ? { label: 'Change details', onClick: () => this.openEdit('details') }
        : { label: 'Set up your shop', primary: true, onClick: () => this.openSetup() }),
    });
    this.add('storefront.cards', {
      id: 'shop-deal', order: 20, title: 'Student deal', visible: () => this.step === 'linked',
      render: () => this.dealCard(),
      action: () => ({ label: cardPreview(this.card)?.deal || this.waiting?.deal ? 'Change the deal' : 'Add a deal', primary: true, onClick: () => this.openEdit('deal') }),
    });
    this.add('storefront.cards', {
      id: 'shop-week', order: 30, title: 'How it\'s going', visible: () => this.step === 'linked',
      render: () => this.trendCard(),
    });
    // …and the same on Home, for the ones the owner picks (Customise Home). The ids are the ones
    // people's saved Home layouts already use, so they never change.
    this.add('home.widgets', {
      id: 'shop-week', label: 'How it\'s going', order: 1, sizes: ['wide', 'tall'], audience: 'business',
      render: (size) => this.weekWidget(size),
    });
    this.add('home.widgets', {
      id: 'shop-deal', label: 'Student deal', order: 2, sizes: ['wide', 'tall'], audience: 'business',
      render: (size) => this.dealWidget(size),
    });
    this.add('home.widgets', {
      id: 'shop-card', label: 'Your shop on Spots', order: 3, sizes: ['large', 'tall', 'wide'], start: false, audience: 'business',
      render: (size) => this.cardWidget(size),
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
          store.stats(db, owner.place, weeksBack(TREND_WEEKS)),
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
    if (this.waiting) return 'A change is being checked';
    if (this.mine?.change?.status === 'rejected') return 'Your last change wasn\'t approved';
    if (this.card && this.card.published !== true) return 'Not on Spots yet';
    return 'Students can see your shop on Spots';
  }

  page() {
    const linked = this.step === 'linked';
    const open = () => (linked ? this.openShop('details') : this.openSetup());
    return el('section', { class: 'home-page-row', 'aria-label': 'Your shop' },
      el('div', {},
        el('h2', { class: 'home-page-title' }, linked && this.card?.name ? this.card.name : 'Your shop'),
        el('p', { class: 'home-page-line' }, this.statusText())),
      el('button', { type: 'button', class: 'home-button', onclick: open },
        el('b', {}, linked ? 'Your shop' : 'Set up'), ui.icon('right')));
  }

  // Whether the Your shop tab is there (the storefront feature).
  hasStorefront() {
    return this.slot('views').items.some((v) => v.id === 'storefront');
  }

  // Live, Being checked or Not on Spots: the tag on the card.
  cardTag() {
    if (this.step !== 'linked') return null;
    if (this.waiting) return { text: 'Being checked', tone: 'wait' };
    if (this.card?.published !== true) return { text: 'Not on Spots', tone: 'off' };
    return { text: 'Live', tone: 'live' };
  }

  // The photo Spots shows for this place (a picture that comes with the app is only known to
  // the listings feature, through Spots).
  photoFor(place) {
    for (const kind of ['cafes', 'pubs', 'clubs']) {
      const found = this.slot('spots.places').first((item) => item.places(kind).find((p) => p.id === place));
      if (found?.photo) return found.photo;
    }
    return null;
  }

  // The card as students will see it: with a waiting change on top, and its photo.
  preview() {
    const preview = cardPreview(withChange(this.card, this.waiting));
    if (preview && !preview.photo) preview.photo = this.photoFor(preview.id);
    return preview;
  }

  notes() {
    if (this.waiting) {
      return el('p', { class: 'shop-note' }, `Your change is being checked by the Mobile Durham team (sent ${this.waiting.at ? time.ago(this.waiting.at) : 'just now'}), usually within a day. Until then, students see your shop as it was. This is how it will look:`);
    }
    if (this.mine?.change?.status === 'rejected') {
      return el('p', { class: 'shop-note' }, 'Your last change wasn\'t approved. Change it and send it again, or email mobiledurham.help@gmail.com.');
    }
    return null;
  }

  // Your shop on Spots: the card exactly as students see it, or how to set up.
  shopCard() {
    if (this.step !== 'linked') {
      return el('div', { class: 'shop-intro' },
        el('p', {}, 'Put your café, pub or club on Spots, where Durham students find places and deals. It\'s free.'),
        el('p', { class: 'hint' }, 'Sign in, then type the shop code we gave you. No code? You can ask to be listed.'));
    }
    const preview = this.preview();
    const spots = this.use('spots');
    return el('div', { class: 'shop-inside' },
      this.notes(),
      spots ? el('div', { class: 'shop-preview' }, spots.place(preview)) : el('p', {}, preview?.name || ''),
      !preview?.photo && el('p', { class: 'hint small' }, 'Want a photo on your card? Email one to mobiledurham.help@gmail.com and we\'ll add it.'));
  }

  // Student deal: what's on now, and a new one being checked.
  dealCard() {
    const now = cardPreview(this.card);
    const next = this.waiting ? cardPreview(withChange(this.card, this.waiting)) : null;
    const changing = next && (next.deal !== now?.deal || next.until !== now?.until);
    const row = (deal, until, tag, tone) => el('div', { class: 'shop-deal-row' },
      el('div', {}, el('b', {}, deal), el('small', {}, until || 'No end date')),
      el('span', { class: `shop-tag is-${tone}` }, tag));
    return el('div', { class: 'shop-deal-rows' },
      now?.deal ? row(now.deal, now.until, 'Live', 'live') : el('p', { class: 'hint' }, 'No student deal on right now. A deal is what makes students pick you: a discount or a freebie with their campus card.'),
      changing && (next.deal ? row(next.deal, next.until, 'Being checked', 'wait') : el('p', { class: 'hint small' }, 'Taking the deal off is being checked.')));
  }

  get points() {
    return trend(this.mine?.stats, weeksBack(TREND_WEEKS));
  }

  bars(points) {
    const most = Math.max(1, ...points.map((p) => p.seen));
    return el('div', { class: 'shop-bars', role: 'img', 'aria-label': points.map((p) => `Week of ${p.label}: ${p.seen}`).join(', ') },
      points.map((p, i) => el('div', { class: `shop-bar${i === points.length - 1 ? ' is-now' : ''}` },
        el('span', { class: 'shop-bar-fill', style: `height: ${Math.max(4, Math.round((p.seen / most) * 100))}%` }),
        el('b', {}, String(p.seen)),
        el('small', {}, WEEK_NAMES[points.length - 1 - i] || p.label))));
  }

  // How it's going: four weeks of how many students saw the shop, and a sentence about it.
  trendCard() {
    const points = this.points;
    return el('div', { class: 'shop-trend' },
      this.bars(points),
      el('p', {}, trendSentence(points)),
      el('p', { class: 'hint small' }, 'Each phone counts once a day. We never know who they are.'));
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
    const preview = this.preview();
    const tag = this.cardTag();
    return el('button', { type: 'button', class: `shop-widget shop-widget-${size} shop-card-widget`, onclick: () => this.openShop('details') },
      el('div', { class: 'shop-widget-head' },
        el('b', {}, 'Your shop on Spots'),
        tag && el('span', { class: `shop-tag is-${tag.tone}` }, tag.text)),
      el('div', { class: 'shop-card-summary' },
        el('b', { class: 'shop-card-name' }, preview?.name || 'Your place'),
        preview?.line && el('span', { class: 'shop-card-line' }, preview.line),
        preview?.deal && el('span', { class: 'shop-card-deal' }, preview.deal)));
  }

  // Opens the Your shop tab, or (without it) the window to change that part.
  openShop(part) {
    if (this.hasStorefront()) this.app.shell.selectView('storefront');
    else this.openEdit(part);
  }

  dealWidget(size) {
    if (this.step !== 'linked') return this.notReady('Student deal', size);
    const preview = cardPreview(this.card);
    return el('button', { type: 'button', class: `shop-widget shop-widget-${size} shop-deal-widget`, onclick: () => this.openShop('deal') },
      el('b', {}, 'Student deal'),
      el('span', { class: 'shop-deal-text' }, preview?.deal || 'No deal on right now'),
      el('small', {}, this.waiting ? 'A change is being checked' : preview?.until || (preview?.deal ? 'No end date' : 'Tap to add one')));
  }

  weekWidget(size) {
    if (this.step !== 'linked') return this.notReady('How it\'s going', size);
    const points = this.points;
    const now = points[points.length - 1];
    const before = points[points.length - 2];
    return el('button', { type: 'button', class: `shop-widget shop-widget-${size} shop-week-widget`, onclick: () => this.openShop('details') },
      el('div', { class: 'shop-widget-head' }, el('b', {}, 'How it\'s going')),
      el('small', {}, `${now.seen} saw you this week${before ? `, ${before.seen} last week` : ''}`),
      this.bars(points));
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
        ...intro('Everything about your shop is in the Your shop tab: how students see it, your student deal, and how it\'s going. Changes you make are checked by the Mobile Durham team before students see them, usually within a day.'),
        el('button', { type: 'button', class: 'btn primary block', onclick: () => { w.close(); this.openShop('details'); } }, 'Go to your shop')));
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

  // The boxes for the parts of a card an owner can change, filled with `values`: all of them, or
  // only one part ('deal' or 'details'). The others are kept as they are, so sending one part
  // doesn't change the rest. The opening times are asked day by day when Spots is there to
  // read them (the typed 'hours' line is then written from them); otherwise as typed text.
  cardFields(form, values, part = null) {
    const helpers = this.use('spots')?.hours || null;
    const boxes = [];
    // A deal whose last day has gone is already off the card: sending details shouldn't trip on it.
    const ended = !cardPreview({ ...values, id: 'x' })?.deal;
    for (const f of FIELDS) {
      const shown = (!part || f.part === part) && (f.type === 'week' ? !!helpers : f.key !== 'hours' || !helpers);
      if (!shown) {
        if (f.key in form) continue; // 'hours', already written from the opening times
        const gone = ended && (f.key === 'deal' || f.key === 'dealEnds');
        form[f.key] = { value: gone ? '' : f.type === 'date' ? millisToDay(values[f.key]) : (values[f.key] || '') };
        continue;
      }
      if (f.type === 'week') {
        const week = this.weekFields(helpers, values);
        form.open = week;
        // The short line older versions of the app show: written from the times, or kept as
        // typed if the owner hasn't set times.
        form.hours = { get value() { return week.touched || values.open ? helpers.summary(helpers.readOpen(week.value)) || '' : values.hours || ''; } };
        boxes.push(week.node);
        continue;
      }
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
      boxes.push(el('div', { class: 'shop-field' },
        el('label', { class: 'label', for: id }, f.label),
        input,
        f.hint && el('small', { class: 'hint small' }, f.hint)));
    }
    if (part === 'details' && helpers) {
      // Opening times sit with the other details, after the short line.
      const week = boxes.find((b) => b.classList?.contains('shop-week'));
      if (week) { boxes.splice(boxes.indexOf(week), 1); boxes.splice(1, 0, week); }
    }
    return boxes;
  }

  // Opening times, day by day: a switch for open or closed, and from and to. Returns { node,
  // value (as stored, or 'bad' if an open day is missing a time), touched }.
  weekFields(helpers, values) {
    const now = helpers.readOpen(values.open);
    const rows = helpers.DAY_NAMES.map((name, i) => {
      const day = now?.[i] || null;
      const open = el('input', { type: 'checkbox', id: `shop-open-${i}` });
      open.checked = !!day;
      const from = el('input', { type: 'time', 'aria-label': `${name} opens`, value: helpers.toInput(day?.from ?? 9 * 60) });
      const to = el('input', { type: 'time', 'aria-label': `${name} closes`, value: helpers.toInput(day?.to ?? 17 * 60) });
      const times = el('span', { class: 'shop-day-times' }, from, el('span', { 'aria-hidden': 'true' }, 'to'), to);
      const show = () => { times.hidden = !open.checked; closed.hidden = open.checked; };
      const closed = el('span', { class: 'shop-day-closed' }, 'Closed');
      open.addEventListener('change', show);
      show();
      return {
        open, from, to,
        node: el('div', { class: 'shop-day' },
          el('label', { class: 'shop-day-name', for: open.id, 'aria-label': `Open on ${name}` }, open, el('span', {}, helpers.DAYS[i])),
          times, closed),
      };
    });
    const week = {
      touched: false,
      get value() {
        const days = rows.map((r) => {
          if (!r.open.checked) return null;
          const from = helpers.fromInput(r.from.value);
          const to = helpers.fromInput(r.to.value);
          return from == null || to == null || from === to ? 'bad' : { from, to };
        });
        if (days.includes('bad')) return 'bad';
        return helpers.writeOpen(days);
      },
    };
    const copy = el('button', {
      type: 'button', class: 'link-btn',
      onclick: () => {
        for (const r of rows.slice(1, 5)) { r.open.checked = rows[0].open.checked; r.from.value = rows[0].from.value; r.to.value = rows[0].to.value; r.open.dispatchEvent(new Event('change')); }
        week.touched = true;
      },
    }, 'Same as Monday for Tuesday to Friday');
    week.node = el('fieldset', { class: 'shop-field shop-week' },
      el('legend', { class: 'label' }, 'Opening times'),
      !now && values.hours && el('small', { class: 'hint small' }, `Now on your card: "${values.hours}". Set your times below and students will also see whether you're open now.`),
      ...rows.map((r) => r.node),
      copy,
      el('small', { class: 'hint small' }, 'Open past midnight? Pick a closing time like 03:00.'));
    week.node.addEventListener('input', () => { week.touched = true; });
    week.node.addEventListener('change', () => { week.touched = true; });
    return week;
  }

  // ---- Changing the card ----

  // Opens the window to change one part of the card: 'deal' (the student deal) or 'details'
  // (everything else).
  openEdit(part = 'details') {
    if (this.step !== 'linked') return this.openSetup();
    if (!this.editWindow) this.editWindow = ui.dialog({ title: 'Change details', className: 'shop-dialog' });
    this.editPart = part === 'deal' ? 'deal' : 'details';
    this.editWindow.setTitle(this.editPart === 'deal' ? 'Your student deal' : 'Change details');
    this.drawEdit();
    this.editWindow.open();
  }

  drawEdit() {
    const w = this.editWindow;
    w.typing = false;
    const part = this.editPart || 'details';
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
      if (!confirm('Withdraw the change? Your shop stays as it is now.')) return;
      if (await this.attempt((db) => store.withdrawChange(db, this.mine.place), error)) await this.load();
    };
    const fields = this.cardFields(form, waiting || card, part);
    const node = el('div', { class: 'shop-form' },
      waiting
        ? el('p', { class: 'shop-note' }, `A change is being checked (sent ${waiting.at ? time.ago(waiting.at) : 'just now'}). Students see your shop as it was until then. You can change it again here.`)
        : this.mine?.change?.status === 'rejected'
          ? el('p', { class: 'shop-note' }, 'Your last change wasn\'t approved. Check it follows the guidelines below and send it again, or email mobiledurham.help@gmail.com.')
          : null,
      part === 'deal' && el('p', { class: 'hint' }, 'One clear deal students can use with their campus card, for example "10% off" or "Free pastry with any coffee before 10am".'),
      ...fields,
      ui.hint('Keep it honest and simple: a real deal students can use, no drinks deals that push heavy drinking. The Mobile Durham team checks every change before students see it.', { small: true }),
      error,
      el('button', { type: 'button', class: 'btn primary block', onclick: send }, 'Send to be checked'),
      waiting && el('button', { type: 'button', class: 'btn block', onclick: withdraw }, 'Withdraw the change'));
    // Don't redraw over what someone is typing.
    node.addEventListener('input', () => { w.typing = true; });
    node.addEventListener('change', () => { w.typing = true; });
    w.setContent(node);
  }

  // ---- The account page ----

  accountSection() {
    if (!this.business) return null;
    const linked = this.step === 'linked';
    return el('section', { class: 'shop-account' },
      el('h3', {}, 'Your business'),
      el('p', { class: 'hint' }, linked ? `You look after ${this.card?.name || 'a place'} on Spots.` : 'Not linked to a place yet.'),
      el('button', { type: 'button', class: 'btn small', onclick: () => (linked ? this.openShop('details') : this.openSetup()) }, linked ? 'Open your shop' : 'Set up your shop'));
  }

  // Questions and answers for the Help page.
  addHelp() {
    for (const item of [
      { group: 'business', order: 10, question: 'How do I put my business on Spots?', answer: () => [
        'Choose "I run a business" when you first open the app (or in Settings → Using the app as). Make an account, then type the shop code we gave you. No code? Tap Ask to be listed and we\'ll get in touch. Listing is free.',
      ] },
      { group: 'business', order: 20, question: 'How do I change my deal?', answer: () => [
        'Open the Your shop tab and tap Change the deal (or Change details for your opening times, website and menu). Tap Send to be checked: the Mobile Durham team checks every change, usually within a day, and until then students see your shop as it was.',
      ] },
      { group: 'business', order: 30, question: 'What does How it\'s going count?', answer: () => [
        'How many phones showed your shop on Spots each week, for the last four weeks, and how many tapped your Website or Menu button. Each phone counts once a day. We never know who they are.',
      ] },
      { group: 'business', order: 40, question: 'How do I choose what\'s on Home?', answer: () => [
        'Everything about your shop is in the Your shop tab. To also keep some of it on Home, tap Choose which of these are on Home at the bottom of that tab (or the pencil on Home), and add or remove cards.',
      ] },
      { group: 'business', order: 50, question: 'How do I add a photo?', answer: () => [
        'Email a photo of your shop to mobiledurham.help@gmail.com and we\'ll add it to your card. Only send a photo you took or are allowed to use.',
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
