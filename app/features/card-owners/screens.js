// The screen pieces that shops and societies share: the four weeks of bars, the box for typing
// a code, and the parts of Approve changes (changes waiting, and making codes).

import { ui } from 'folio';
import { cleanCode, makeCode, showCode, explain } from './rules.js';

const { el } = ui;
const WEEK_NAMES = ['This week', 'Last week', '2 weeks ago', '3 weeks ago'];

// Four weeks as bars, this week dark. `points` come from trend().
export function bars(points) {
  const most = Math.max(1, ...points.map((p) => p.seen));
  return el('div', { class: 'owners-bars', role: 'img', 'aria-label': points.map((p) => `Week of ${p.label}: ${p.seen}`).join(', ') },
    points.map((p, i) => el('div', { class: `owners-bar${i === points.length - 1 ? ' is-now' : ''}` },
      el('span', { class: 'owners-bar-fill', style: `height: ${Math.max(4, Math.round((p.seen / most) * 100))}%` }),
      el('b', {}, String(p.seen)),
      el('small', {}, WEEK_NAMES[points.length - 1 - i] || p.label))));
}

// The box for typing a code, with its Link button and error line:
//   codeField({ id, label: 'Shop code', noun: 'shop', use: (code) => Promise })
// `use` gets the tidied code; if it throws, the error is explained under the box.
export function codeField({ id, label, noun, use }) {
  const input = el('input', {
    id, class: 'owners-code', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
    placeholder: 'e.g. K7QM-2XPA', maxlength: '12',
  });
  const error = ui.errorBox();
  let busy = false;
  const go = async () => {
    const code = cleanCode(input.value);
    if (!code) return error.show(`A ${noun} code has 8 letters and numbers, like K7QM-2XPA.`);
    if (busy) return;
    busy = true;
    error.show('');
    try {
      await use(code);
    } catch (err) {
      error.show(explain(err));
    } finally {
      busy = false;
    }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  return [
    el('label', { class: 'label', for: id }, label),
    el('div', { class: 'field' }, input, el('button', { type: 'button', class: 'btn primary', onclick: go }, 'Link')),
    error,
  ];
}

// What a change changes, as a list: was (crossed out) and new.
export function diffList(rows) {
  return el('dl', { class: 'owners-diff' }, rows.map((r) => [
    el('dt', {}, r.label),
    el('dd', {}, el('span', { class: 'owners-was' }, r.now || '(empty)'), el('span', { class: 'owners-new' }, r.next || '(empty)')),
  ]).flat());
}

// Approve and Reject buttons. `run(step, done)` makes the button's action from a step (given the
// database) and the message shown when it worked.
export function approveButtons(approve, reject, run) {
  return el('div', { class: 'owners-approve-buttons' },
    el('button', { type: 'button', class: 'btn primary small', onclick: run(approve.step, approve.done) }, 'Approve'),
    el('button', { type: 'button', class: 'btn small', onclick: run(reject, 'Rejected.') }, 'Reject'));
}

// One kind of card's parts of Approve changes: the changes waiting, and making codes.
//
//   new Approvals(feature, store, {
//     differences(card, change) → [{ label, now, next }],
//     words: { changes: 'Changes', none: 'No changes waiting.', unnamed: 'A place',
//              approved: 'Approved. Students see it within 6 hours.', codes: 'Shop codes',
//              noCards: 'Add a place … first', pickId: 'shop-code-place', thing: 'the place',
//              madeNote: 'Write it down for the owner. …', removedNote: '…' (used codes) },
//   })
//
// `window` is what the Approve changes window passes: { reload(), done() }.
export class Approvals {
  constructor(feature, store, options) {
    this.feature = feature;
    this.store = store;
    this.options = options;
    this.words = options.words;
    this.data = { changes: [], cards: [], codes: [] };
    this.made = null;
  }

  get account() {
    return this.feature.use('account');
  }

  // How many changes are waiting.
  async waiting(db) {
    return (await this.store.waiting(db)).length;
  }

  // Fetches what it shows. Returns how many changes are waiting.
  async load(db) {
    const [changes, cards, codes] = await Promise.all([this.store.waiting(db), this.store.allCards(db), this.store.codes(db)]);
    this.data = { changes, cards, codes };
    return changes.length;
  }

  render(window) {
    return [this.changesSection(window), this.codesSection(window)];
  }

  // Runs an approve or reject step, then loads everything again.
  run(window, error) {
    return (step, done) => async () => {
      try {
        await step(await this.account.database());
        this.feature.toast(done);
        await window.reload();
        window.done?.();
        this.feature.load?.(); // in case it was this account's own card
      } catch {
        error.show('That didn\'t work. Check you\'re online and try again.');
      }
    };
  }

  changesSection(window) {
    const { changes, cards } = this.data;
    const byId = new Map(cards.map((c) => [c.id, c]));
    const link = this.store.config.link;
    return el('section', { class: 'owners-approve-part' },
      el('h3', { class: 'sub-head' }, `${this.words.changes} (${changes.length})`),
      changes.length ? changes.map((c) => this.changeCard(c, byId.get(c[link]), window)) : ui.hint(this.words.none));
  }

  changeCard(change, card, window) {
    const rows = this.options.differences(card || {}, change);
    const error = ui.errorBox();
    return el('article', { class: 'owners-approve-card' },
      el('b', {}, card?.name || this.words.unnamed),
      rows.length ? diffList(rows) : ui.hint('Nothing different from the card now.', { small: true }),
      approveButtons(
        { step: (db) => this.store.approveChange(db, change), done: this.words.approved },
        (db) => this.store.rejectChange(db, change),
        this.run(window, error)),
      error);
  }

  codesSection(window) {
    const { cards, codes } = this.data;
    const byId = new Map(cards.map((c) => [c.id, c]));
    return el('section', { class: 'owners-approve-part' },
      el('h3', { class: 'sub-head' }, this.words.codes),
      this.codeMaker(cards, window),
      this.codeList(codes, byId, window));
  }

  codeMaker(cards, window) {
    if (!cards.length) return ui.hint(this.words.noCards);
    const pick = ui.select(cards.map((c) => [c.id, c.published ? c.name : `${c.name} (draft)`]), { id: this.words.pickId });
    const error = ui.errorBox();
    const make = async () => {
      try {
        const db = await this.account.database();
        const code = makeCode();
        await this.store.addCode(db, this.account.fields, code, pick.value);
        this.made = { code, card: pick.value };
        await window.reload();
      } catch {
        error.show('Couldn\'t make a code. Check you\'re online and try again.');
      }
    };
    const made = this.made;
    const name = made && cards.find((c) => c.id === made.card)?.name;
    return el('div', { class: 'owners-code-maker' },
      el('label', { class: 'label', for: this.words.pickId }, 'Make a code for'),
      el('div', { class: 'field' }, pick, el('button', { type: 'button', class: 'btn primary', onclick: make }, 'Make code')),
      error,
      made && el('div', { class: 'owners-made-code', role: 'status' },
        el('span', {}, `Code for ${name || this.words.thing}`),
        el('b', {}, showCode(made.code)),
        el('small', {}, this.words.madeNote)));
  }

  codeList(codes, byId, window) {
    if (!codes.length) return null;
    const removeUsed = !!this.store.config.removeUsed;
    return el('ul', { class: 'owners-codes' }, codes.map((c) => el('li', {},
      el('code', {}, showCode(c.code)),
      el('span', {}, byId.get(c.card)?.name || c.card),
      el('small', {}, c.used ? 'Used' : 'Not used yet'),
      (!c.used || removeUsed) && el('button', {
        type: 'button', class: 'link-btn', 'aria-label': `Delete code ${showCode(c.code)}`,
        onclick: async () => {
          const what = c.used ? this.words.removedNote : 'It won\'t work any more.';
          if (!confirm(`Delete code ${showCode(c.code)}? ${what}`)) return;
          try {
            await this.store.removeCode(await this.account.database(), c);
            await window.reload();
          } catch {
            this.feature.toast('Couldn\'t delete it. Try again.');
          }
        },
      }, c.used ? 'Remove' : 'Delete'))));
  }
}
