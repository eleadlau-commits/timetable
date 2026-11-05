// The Societies part of Approve changes (the shop feature's window, slot 'approve.parts'), for the
// team: committees' changes, with what's on the card now and what it would become, and making
// society codes. It mirrors the shop's own parts (shop/approve.js), which step 3 will share.

import { ui } from 'folio';
import { differences, makeCode, showCode } from './rules.js';
import * as store from './store.js';

const { el } = ui;

export class SocietyApprovals {
  constructor(feature) {
    this.feature = feature;
    this.data = { changes: [], societies: [], codes: [] };
    this.made = null;
  }

  get account() {
    return this.feature.account;
  }

  // The item for the 'approve.parts' slot.
  part() {
    return {
      id: 'societies',
      order: 50,
      waiting: async (db) => (await store.waiting(db)).length,
      load: (db) => this.load(db),
      render: (window) => this.render(window),
    };
  }

  async load(db) {
    const [changes, societies, codes] = await Promise.all([store.waiting(db), store.allSocieties(db), store.codes(db)]);
    this.data = { changes, societies, codes };
    return changes.length;
  }

  render(window) {
    const { changes, societies, codes } = this.data;
    const byId = new Map(societies.map((s) => [s.id, s]));
    return [
      el('section', { class: 'committee-approve' },
        el('h3', { class: 'sub-head' }, `Society changes (${changes.length})`),
        changes.length ? changes.map((c) => this.changeCard(c, byId.get(c.society), window)) : ui.hint('No society changes waiting.')),
      el('section', { class: 'committee-approve' },
        el('h3', { class: 'sub-head' }, 'Society codes'),
        this.codeMaker(societies, window),
        this.codeList(codes, byId, window)),
    ];
  }

  changeCard(change, society, window) {
    const rows = differences(society || {}, change);
    const error = ui.errorBox();
    const run = (step, done) => async () => {
      try {
        await step(await this.account.database());
        this.feature.toast(done);
        await window.reload();
        window.done();
        this.feature.load(); // in case it was this account's own society
      } catch {
        error.show('That didn\'t work. Check you\'re online and try again.');
      }
    };
    return el('article', { class: 'committee-approve-card' },
      el('b', {}, society?.name || 'A society'),
      rows.length
        ? el('dl', { class: 'committee-diff' }, rows.map((r) => [
          el('dt', {}, r.label),
          el('dd', {}, el('span', { class: 'committee-was' }, r.now || '(empty)'), el('span', { class: 'committee-new' }, r.next || '(empty)')),
        ]).flat())
        : ui.hint('Nothing different from the card now.', { small: true }),
      el('div', { class: 'committee-approve-buttons' },
        el('button', { type: 'button', class: 'btn primary small', onclick: run((db) => store.approveChange(db, change), 'Approved. Students see it within 12 hours.') }, 'Approve'),
        el('button', { type: 'button', class: 'btn small', onclick: run((db) => store.rejectChange(db, change), 'Rejected.') }, 'Reject')),
      error);
  }

  codeMaker(societies, window) {
    if (!societies.length) return ui.hint('Add a society in the Firebase console first (see the societies README), then make its code here.');
    const pick = ui.select(societies.map((s) => [s.id, s.published ? s.name : `${s.name} (draft)`]), { id: 'society-code-for' });
    const error = ui.errorBox();
    const make = async () => {
      try {
        const db = await this.account.database();
        const code = makeCode();
        await store.addCode(db, this.account.fields, code, pick.value);
        this.made = { code, society: pick.value };
        await window.reload();
      } catch {
        error.show('Couldn\'t make a code. Check you\'re online and try again.');
      }
    };
    const made = this.made;
    const name = made && societies.find((s) => s.id === made.society)?.name;
    return el('div', { class: 'committee-code-maker' },
      el('label', { class: 'label', for: 'society-code-for' }, 'Make a code for'),
      el('div', { class: 'field' }, pick, el('button', { type: 'button', class: 'btn primary', onclick: make }, 'Make code')),
      error,
      made && el('div', { class: 'committee-made-code', role: 'status' },
        el('span', {}, `Code for ${name || 'the society'}`),
        el('b', {}, showCode(made.code)),
        el('small', {}, 'Give it to one committee member. It works once, for one account. Make one for each person.')));
  }

  codeList(codes, byId, window) {
    if (!codes.length) return null;
    return el('ul', { class: 'committee-codes' }, codes.map((c) => el('li', {},
      el('code', {}, showCode(c.code)),
      el('span', {}, byId.get(c.society)?.name || c.society),
      el('small', {}, c.used ? 'Used' : 'Not used yet'),
      el('button', {
        type: 'button', class: 'link-btn', 'aria-label': `Delete code ${showCode(c.code)}`,
        onclick: async () => {
          const what = c.used ? 'The person who used it will stop looking after the society.' : 'It won\'t work any more.';
          if (!confirm(`Delete code ${showCode(c.code)}? ${what}`)) return;
          try {
            await store.removeCode(await this.account.database(), c);
            await window.reload();
          } catch {
            this.feature.toast('Couldn\'t delete it. Try again.');
          }
        },
      }, c.used ? 'Remove' : 'Delete'))));
  }
}
