// Societies: student societies, on the Explore tab (the explore feature). A Societies card there
// opens a full-screen window with a search box, a switch for each type (All, Sport, Academic,
// Arts and music, …) and a card for each society: its photo or logo, name, a short line, when
// and where it meets, its joining fee, and Instagram and Join buttons.
//
// The societies come from the online database's 'societies' collection, which the team fills in
// the Firebase console (see README.md). Everyone can read the published ones, signed in or not;
// the app can't change them. They're kept on the phone, so they show straight away and offline,
// and the database is asked again only when the copy is older than FRESH_FOR (rules.js).
//
// Saved data: 'saved' → { at (ms), list: [{ id, type, name, line, meets, fee, instagram, join, photo, order }] }

import { Feature, ui } from 'folio';
import { toSociety, pick, typesIn, isStale, MOST } from './rules.js';

const { el } = ui;

// A pound sign in a circle, for the joining fee.
const FEE = '<circle cx="12" cy="12" r="9"/><path d="M14.6 8.6A2.6 2.6 0 0 0 9.8 10v6.2M8.2 12.6h4.6M8.2 16.2h7.6"/>';

export default class Societies extends Feature {
  start() {
    this.account = this.use('account');
    this.saved = this.storage.get('saved', null);
    this.type = 'all';
    this.search = '';
    this.addHelp();
    this.add('explore.cards', {
      id: 'societies', label: 'Societies', line: 'Clubs and societies to join, from sport to singing', order: 20,
      detail: () => {
        this.update();
        const n = this.list.length;
        return n ? `${n} ${n === 1 ? 'society' : 'societies'}` : 'Coming soon';
      },
      onClick: () => this.open(),
    });
  }

  get list() {
    return Array.isArray(this.saved?.list) ? this.saved.list : [];
  }

  // ---- From the database ----

  // Asks the database again if the saved copy is old (at most once at a time, and not offline).
  update() {
    if (this.loading || !navigator.onLine || !this.account || !isStale(this.saved)) return;
    if (this.failedAt && Date.now() - this.failedAt < 5 * 60000) return;
    this.loading = this.load()
      .catch(() => { this.failedAt = Date.now(); })
      .finally(() => { this.loading = null; });
  }

  async load() {
    const db = await this.account.publicDatabase();
    const snap = await db.collection('societies').where('published', '==', true).limit(MOST).get();
    const list = snap.docs.map((d) => toSociety(d.id, d.data(), import.meta.url)).filter(Boolean);
    const changed = JSON.stringify(list) !== JSON.stringify(this.list);
    this.saved = { at: Date.now(), list };
    this.storage.set('saved', this.saved);
    if (changed) {
      this.refresh();
      if (this.window?.isOpen) this.fill();
    }
  }

  // ---- The window ----

  open() {
    this.update();
    if (!this.list.length) {
      this.toast('Societies are coming soon.');
      return;
    }
    if (!this.window) this.window = ui.dialog({ title: 'Societies', className: 'society-dialog' });
    this.fill();
    this.window.open();
  }

  fill() {
    const types = typesIn(this.list);
    if (this.type !== 'all' && !types.some((t) => t.id === this.type)) this.type = 'all';
    const searchBox = el('input', {
      type: 'search', id: 'society-search', placeholder: 'Search societies', value: this.search,
      autocomplete: 'off', 'aria-label': 'Search societies',
    });
    const results = el('div', { class: 'society-list' });
    const draw = () => {
      const shown = pick(this.list, this.type, this.search);
      results.replaceChildren(...(shown.length
        ? shown.map((s) => this.card(s))
        : [el('p', { class: 'hint' }, this.search ? `No societies match "${this.search}".` : 'No societies here yet.')]));
    };
    searchBox.addEventListener('input', () => { this.search = searchBox.value; draw(); });
    const chip = (id, name) => el('button', {
      type: 'button', class: `society-chip${this.type === id ? ' is-on' : ''}`, 'aria-pressed': String(this.type === id),
      onclick: () => { this.type = id; this.fill(); },
    }, name);
    this.window.setContent(el('div', { class: 'society-window' },
      searchBox,
      types.length > 1 && el('div', { class: 'society-chips', 'data-own-swipe': '' }, chip('all', 'All'), ...types.map((t) => chip(t.id, t.name))),
      results));
    draw();
  }

  // One society.
  card(s) {
    return el('article', { class: 'society-card' },
      s.photo && el('div', { class: 'society-photo', style: `--photo: url("${encodeURI(s.photo)}")`, role: 'img', 'aria-label': `Photo of ${s.name}` }),
      el('div', { class: 'society-head' },
        el('b', {}, s.name),
        s.line && el('span', {}, s.line)),
      (s.meets || s.fee) && el('div', { class: 'society-facts' },
        s.meets && el('p', {}, ui.icon('clock'), el('span', {}, s.meets)),
        s.fee && el('p', {}, ui.icon(FEE), el('span', {}, s.fee))),
      (s.instagram || s.join) && el('div', { class: 'society-links' },
        s.instagram && el('a', { class: 'btn small', href: s.instagram, target: '_blank', rel: 'noopener' }, 'Instagram'),
        s.join && el('a', { class: 'btn small primary', href: s.join, target: '_blank', rel: 'noopener' }, 'Join')));
  }

  // Questions and answers for the Help page.
  addHelp() {
    for (const item of [
      { group: 'around', order: 30, question: 'Where are societies?', answer: () => [
        'On the Explore tab, tap Societies. Search by name, or pick a type such as Sport or Academic. Join opens the society\'s own sign-up page.',
      ] },
      { group: 'around', order: 40, question: 'How do I get my society on the app?', answer: () => [
        'Email mobiledurham.help@gmail.com with your society\'s name, a short line about it, when and where you meet, your joining fee, your Instagram and your sign-up link. Soon committees will be able to keep their own card up to date.',
      ] },
    ]) this.add('help.questions', item);
  }
}
