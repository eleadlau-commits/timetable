// Approve changes: the window for the people who look after Spots (accounts in the database's
// 'admins' collection), from the menu. Three parts:
//   - Changes: each owner's change, with what's on the card now and what it would become.
//     Approve puts it on the card (students see it within 6 hours); Reject leaves the card.
//   - Asking to be listed: businesses without a code. Approve adds their place to Spots,
//     published, with them as its owner.
//   - Shop codes: make a code for a place, to hand to its owner when they say yes.
// Changes and codes are drawn by the card-owners feature (its Approvals, the same as for
// societies); asking to be listed is the shop's own. Then the parts other features add (slot
// 'approve.parts', e.g. societies from the society-committee feature), each loaded and drawn
// below these.

import { ui } from 'folio';
import { differences, KINDS, showValue, FIELDS } from './rules.js';
import * as store from './store.js';

const { el } = ui;
const KIND_NAMES = Object.fromEntries(KINDS);

export class Approver {
  constructor(shop) {
    this.shop = shop;
    this.places = new shop.owners.Approvals(shop, shop.store, {
      differences,
      words: {
        changes: 'Changes',
        none: 'No changes waiting.',
        unnamed: 'A place',
        approved: 'Approved. Students see it within 6 hours.',
        codes: 'Shop codes',
        noCards: 'Add a place in the Firebase console first (see the listings README), then make its code here.',
        pickId: 'shop-code-place',
        thing: 'the place',
        madeNote: 'Write it down for the owner. It works once, for one account.',
      },
    });
    this.requests = [];
  }

  // What the window's parts are given: load everything again, and check the menu row's count.
  get frame() {
    return { reload: () => this.load(), done: () => this.shop.load() };
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
      const [changes, requests] = await Promise.all([this.places.load(db), store.waitingRequests(db)]);
      this.requests = requests;
      // Other features' parts: each loads what it shows, and says how many are waiting.
      let others = 0;
      for (const part of this.shop.slot('approve.parts').items) {
        others += await Promise.resolve(this.shop.slot('approve.parts').run(part, (p) => p.load(db), 0)).catch(() => 0) || 0;
      }
      this.shop.waitingCount = changes + requests.length + others;
      this.shop.refresh();
      this.draw();
    } catch (err) {
      this.window.setContent(ui.missing(err?.code === 'permission-denied' ? 'Permission to approve changes' : 'A connection to the database'));
    }
  }

  draw() {
    const frame = this.frame;
    this.window.setContent(
      this.places.changesSection(frame),
      el('section', { class: 'owners-approve-part' },
        el('h3', { class: 'sub-head' }, `Asking to be listed (${this.requests.length})`),
        this.requests.length ? this.requests.map((r) => this.requestCard(r)) : ui.hint('No requests waiting.')),
      this.places.codesSection(frame),
      ...this.shop.slot('approve.parts').map((part) => part.render(frame)).flat().filter(Boolean));
  }

  requestCard(request) {
    const line = (label, value) => value && [el('dt', {}, label), el('dd', {}, value)];
    const error = ui.errorBox();
    return el('article', { class: 'owners-approve-card' },
      el('b', {}, request.name),
      el('dl', { class: 'owners-diff' },
        ...[
          line('Kind', KIND_NAMES[request.kind] || request.kind),
          line('Address', request.address),
          line('Contact', request.contact),
          ...FIELDS.filter((f) => f.type !== 'week').map((f) => line(f.label, showValue(f.key, request[f.key]))),
        ].filter(Boolean).flat()),
      this.shop.owners.approveButtons(
        { step: (db) => store.approveRequest(db, request), done: 'Approved. Students see it within 6 hours.' },
        (db) => store.rejectRequest(db, request),
        this.places.run(this.frame, error)),
      error);
  }
}
