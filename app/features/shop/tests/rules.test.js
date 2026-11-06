import { test, assert } from 'folio/testing';
import { millisToDay, checkEdit, checkRequest, differences, cardPreview, withChange, setupStep } from '../rules.js';
import { PLACES, cardFields, fromStore } from '../store.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

test('days for a date box', () => {
  assert.equal(millisToDay(at(2026, 11, 3)), '2026-11-03');
  assert.equal(millisToDay(null), '');
});

test('an owner\'s change is tidied and checked', () => {
  const now = at(2026, 11, 1);
  const { change } = checkEdit({ line: '  Coffee   by the river ', deal: '10% off', dealEnds: '2026-11-30', hours: 'Mon–Fri 8–6', link: 'flatwhite.co.uk', menu: '' }, now);
  assert.deepEqual(change, {
    line: 'Coffee by the river', deal: '10% off', dealEnds: at(2026, 11, 30), open: '', hours: 'Mon–Fri 8–6', link: 'https://flatwhite.co.uk/', menu: '',
  });
  // Opening times day by day, only in the stored shape.
  const week = '0800-1700|0800-1700|0800-1700|0800-1700|0800-1700|0900-1700|';
  assert.equal(checkEdit({ open: week }, now).change.open, week);
  assert.match(checkEdit({ open: 'bad' }, now).error, /Opening times/);
  assert.equal(checkEdit({ deal: 'x'.repeat(200) }, now).change.deal.length, 120);
  assert.match(checkEdit({ link: 'http://plain.example' }, now).error, /Website/);
  assert.match(checkEdit({ menu: 'javascript:x' }, now).error, /Menu link/);
  assert.match(checkEdit({ dealEnds: '2026-11-30' }, now).error, /no deal/);
  assert.match(checkEdit({ deal: 'Free cake', dealEnds: '2026-10-01' }, now).error, /already gone/);
  // Today is still fine.
  assert.ok(checkEdit({ deal: 'Free cake', dealEnds: '2026-11-01' }, now).change);
});

test('asking to be listed needs a name, a kind and a way to get in touch', () => {
  const now = at(2026, 11, 1);
  const form = { name: 'Bean There', kind: 'cafe', contact: '07700 900000', address: '1 Saddler St' };
  const { request } = checkRequest(form, now);
  assert.equal(request.name, 'Bean There');
  assert.equal(request.kind, 'cafe');
  assert.equal(request.deal, '');
  assert.match(checkRequest({ ...form, name: ' ' }, now).error, /name/);
  assert.match(checkRequest({ ...form, kind: 'casino' }, now).error, /kind/);
  assert.match(checkRequest({ ...form, contact: '' }, now).error, /touch/);
  assert.match(checkRequest({ ...form, link: 'ftp://x.example' }, now).error, /Website/);
});

test('what a change changes', () => {
  const place = { line: 'Coffee', deal: '10% off', dealEnds: null, hours: '', link: 'https://a.example/', menu: '' };
  const rows = differences(place, { ...place, deal: '20% off', hours: '8–6', open: '0800-1800||||||' });
  assert.deepEqual(rows.map((r) => r.key), ['deal', 'hours']);
  assert.equal(rows[0].now, '10% off');
  assert.equal(rows[0].next, '20% off');
  assert.deepEqual(differences(place, place), []);
  assert.equal(differences({}, { dealEnds: at(2026, 11, 30), deal: 'x' }).find((r) => r.key === 'dealEnds').next, '30 Nov 2026');
});

test('the owner\'s card, as students see it', () => {
  const now = at(2026, 11, 10);
  const place = { id: 'p1', name: 'Flat White', line: 'Coffee', deal: '10% off', dealEnds: at(2026, 11, 30), link: 'https://a.example', hours: '8–6' };
  const card = cardPreview(place, now);
  assert.equal(card.deal, '10% off');
  assert.equal(card.until, 'Until 30 Nov');
  assert.equal(card.link, 'https://a.example/');
  assert.equal(cardPreview({ ...place, dealEnds: at(2026, 11, 1) }, now).deal, null);
  assert.equal(cardPreview(null), null);
  const changed = withChange(place, { line: 'Tea', deal: '', dealEnds: null, hours: '', link: '', menu: '' });
  assert.equal(changed.line, 'Tea');
  assert.equal(changed.name, 'Flat White');
  assert.equal(cardPreview(changed, now).deal, null);
  assert.equal(withChange(place, null), place);
});

test('where an owner is with setting up', () => {
  const user = { uid: 'u', verified: true };
  assert.equal(setupStep({ user: null }), 'signed-out');
  assert.equal(setupStep({ user: { uid: 'u', verified: false } }), 'unconfirmed');
  assert.equal(setupStep({ user, loaded: false }), 'loading');
  assert.equal(setupStep({ user, loaded: true, owner: { place: 'p1' } }), 'linked');
  assert.equal(setupStep({ user, loaded: true, request: { status: 'waiting' } }), 'asked');
  assert.equal(setupStep({ user, loaded: true, request: { status: 'rejected' } }), 'refused');
  assert.equal(setupStep({ user, loaded: true }), 'new');
});

test('a shop\'s things keep the database names they always had', () => {
  assert.deepEqual([PLACES.cards, PLACES.codes, PLACES.owners, PLACES.changes, PLACES.stats, PLACES.link],
    ['spots', 'shopCodes', 'shopOwners', 'spotChanges', 'spotStats', 'place']);
  assert.equal(PLACES.removeUsed, false); // used shop codes stay
  const stored = cardFields({ line: 'Coffee', deal: '10% off', dealEnds: at(2026, 11, 30), open: '', hours: '', link: 'https://a.example/' });
  assert.deepEqual(Object.keys(stored), ['line', 'deal', 'dealEnds', 'open', 'hours', 'link', 'menu']);
  assert.ok(stored.dealEnds instanceof Date);
  assert.equal(stored.menu, '');
  assert.equal(cardFields({}).dealEnds, null);
  assert.equal(fromStore({ dealEnds: { toMillis: () => 5 } }).dealEnds, 5);
});
