// Approve changes: the window for the people who look after Spots (accounts in the database's
// 'admins' collection), from the menu. Three parts:
//   - Changes: each owner's change, with what's on the card now and what it would become.
//     Approve puts it on the card (students see it within 6 hours); Reject leaves the card.
//   - Asking to be listed: businesses without a code. Approve adds their place to Spots,
//     published, with them as its owner.
//   - Shop codes: make a code for a place, to hand to its owner when they say yes.

import { ui } from 'folio';
import { differences, makeCode, showCode, KINDS, showValue, FIELDS } from './rules.js';
import * as store from './store.js';

const { el } = ui;
const KIND_NAMES = Object.fromEntries(KINDS);

export class Approver {
  constructor(shop) {
    this.shop = shop;
  }

  open() {
    if (!this.window) this.window = ui.dialog({ title: 'Approve changes', className: 'shop-dialog shop-approve' });
    this.window.setContent(el('p', { class: 'hint' }, 'Loading…'));
    this.window.open();
    this.load();
  }

  async load() {
    try {
      const db = await this.shop.account.database();
      const [{ changes, requests }, places, codes] = await Promise.all([store.waiting(db), store.allPlaces(db), store.codes(db)]);
      // What's on each changed card now, to compare.
      const cards = new Map();
      for (const change of changes) cards.set(change.place, await store.placeDoc(db, change.place).catch(() => null));
      this.data = { changes, requests, places, codes, cards };
      this.shop.waitingCount = changes.length + requests.length;
      this.shop.refresh();
      this.draw();
    } catch (err) {
      this.window.setContent(ui.missing(err?.code === 'permission-denied' ? 'Permission to approve changes' : 'A connection to the database'));
    }
  }

  draw(madeCode = null) {
    const { changes, requests, places, codes, cards } = this.data;
    const names = new Map(places.map((p) => [p.id, p.name]));
    this.window.setContent(
      el('section', { class: 'shop-approve-part' },
        el('h3', { class: 'sub-head' }, `Changes (${changes.length})`),
        changes.length ? changes.map((c) => this.changeCard(c, cards.get(c.place), names.get(c.place))) : ui.hint('No changes waiting.')),
      el('section', { class: 'shop-approve-part' },
        el('h3', { class: 'sub-head' }, `Asking to be listed (${requests.length})`),
        requests.length ? requests.map((r) => this.requestCard(r)) : ui.hint('No requests waiting.')),
      el('section', { class: 'shop-approve-part' },
        el('h3', { class: 'sub-head' }, 'Shop codes'),
        this.codeMaker(places, madeCode),
        this.codeList(codes, names)));
  }

  changeCard(change, card, name) {
    const rows = differences(card || {}, change);
    return el('article', { class: 'shop-approve-card' },
      el('b', {}, name || card?.name || 'A place'),
      rows.length
        ? el('dl', { class: 'shop-diff' }, rows.map((r) => [
          el('dt', {}, r.label),
          el('dd', {}, el('span', { class: 'shop-was' }, r.now || '(empty)'), el('span', { class: 'shop-new' }, r.next || '(empty)')),
        ]).flat())
        : ui.hint('Nothing different from the card now.', { small: true }),
      this.buttons(
        () => store.approveChange(this.db, change),
        () => store.rejectChange(this.db, change)));
  }

  requestCard(request) {
    const line = (label, value) => value && [el('dt', {}, label), el('dd', {}, value)];
    return el('article', { class: 'shop-approve-card' },
      el('b', {}, request.name),
      el('dl', { class: 'shop-diff' },
        ...[
          line('Kind', KIND_NAMES[request.kind] || request.kind),
          line('Address', request.address),
          line('Contact', request.contact),
          ...FIELDS.filter((f) => f.type !== 'week').map((f) => line(f.label, showValue(f.key, request[f.key]))),
        ].filter(Boolean).flat()),
      this.buttons(
        () => store.approveRequest(this.db, request),
        () => store.rejectRequest(this.db, request)));
  }

  buttons(approve, reject) {
    const error = ui.errorBox();
    const run = (step, done) => async () => {
      try {
        this.db = await this.shop.account.database();
        await step();
        this.shop.toast(done);
        await this.load();
        this.shop.load(); // in case it was this account's own place
      } catch {
        error.show('That didn\'t work. Check you\'re online and try again.');
      }
    };
    return el('div', {},
      el('div', { class: 'shop-approve-buttons' },
        el('button', { type: 'button', class: 'btn primary small', onclick: run(approve, 'Approved. Students see it within 6 hours.') }, 'Approve'),
        el('button', { type: 'button', class: 'btn small', onclick: run(reject, 'Rejected.') }, 'Reject')),
      error);
  }

  codeMaker(places, madeCode) {
    if (!places.length) return ui.hint('Add a place in the Firebase console first (see the listings README), then make its code here.');
    const pick = ui.select(places.map((p) => [p.id, p.published ? p.name : `${p.name} (draft)`]), { id: 'shop-code-place' });
    const error = ui.errorBox();
    const make = async () => {
      try {
        const db = await this.shop.account.database();
        const code = makeCode();
        await store.addCode(db, this.shop.account.fields, code, pick.value);
        this.data.codes = await store.codes(db);
        this.draw({ code, place: pick.value });
      } catch {
        error.show('Couldn\'t make a code. Check you\'re online and try again.');
      }
    };
    const name = madeCode && places.find((p) => p.id === madeCode.place)?.name;
    return el('div', { class: 'shop-code-maker' },
      el('label', { class: 'label', for: 'shop-code-place' }, 'Make a code for'),
      el('div', { class: 'field' }, pick, el('button', { type: 'button', class: 'btn primary', onclick: make }, 'Make code')),
      error,
      madeCode && el('div', { class: 'shop-made-code', role: 'status' },
        el('span', {}, `Code for ${name || 'the place'}`),
        el('b', {}, showCode(madeCode.code)),
        el('small', {}, 'Write it down for the owner. It works once, for one account.')));
  }

  codeList(codes, names) {
    if (!codes.length) return null;
    return el('ul', { class: 'shop-codes' }, codes.map((c) => el('li', {},
      el('code', {}, showCode(c.code)),
      el('span', {}, names.get(c.place) || c.place),
      el('small', {}, c.used ? 'Used' : 'Not used yet'),
      !c.used && el('button', {
        type: 'button', class: 'link-btn', 'aria-label': `Delete code ${showCode(c.code)}`,
        onclick: async () => {
          if (!confirm(`Delete code ${showCode(c.code)}? It won't work any more.`)) return;
          try {
            const db = await this.shop.account.database();
            await store.removeCode(db, c.code);
            this.data.codes = await store.codes(db);
            this.draw();
          } catch {
            this.shop.toast('Couldn\'t delete it. Try again.');
          }
        },
      }, 'Delete'))));
  }
}
