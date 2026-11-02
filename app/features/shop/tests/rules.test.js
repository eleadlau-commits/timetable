import { test, assert } from 'folio/testing';
import {
  makeCode, cleanCode, showCode, CODE_LETTERS, cleanLink, dayToMillis, millisToDay, checkEdit,
  checkRequest, differences, weekOf, lastWeek, weeksBack, trend, trendSentence, statId, toCount, cardPreview, withChange, setupStep,
} from '../rules.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

test('shop codes are 8 easy-to-read letters', () => {
  const code = makeCode();
  assert.equal(code.length, 8);
  assert.ok([...code].every((c) => CODE_LETTERS.includes(c)));
  assert.ok(!/[IO01]/.test(CODE_LETTERS));
  assert.equal(makeCode(() => [0, 1, 2, 3, 31, 32, 33, 255]), 'ABCD9AB9');
});

test('codes are understood however they are typed', () => {
  assert.equal(cleanCode('k7qm 2xpa'), 'K7QM2XPA');
  assert.equal(cleanCode(' K7QM-2XPA '), 'K7QM2XPA');
  assert.equal(cleanCode('K7QM2XP'), null);
  assert.equal(cleanCode('K7QM2XPO'), null); // O isn't used
  assert.equal(cleanCode(''), null);
  assert.equal(showCode('K7QM2XPA'), 'K7QM-2XPA');
});

test('web addresses get https, and only https is kept', () => {
  assert.equal(cleanLink('flatwhite.co.uk'), 'https://flatwhite.co.uk/');
  assert.equal(cleanLink(' https://flatwhite.co.uk/menu '), 'https://flatwhite.co.uk/menu');
  assert.equal(cleanLink(''), '');
  assert.equal(cleanLink('http://flatwhite.co.uk'), null);
  assert.equal(cleanLink('javascript:alert(1)'), null);
  assert.equal(cleanLink('not a link'), null);
});

test('days from a date box', () => {
  assert.equal(dayToMillis('2026-11-30'), at(2026, 11, 30));
  assert.equal(dayToMillis(''), null);
  assert.equal(dayToMillis('soon'), null);
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

test('weeks start on Monday', () => {
  assert.equal(weekOf(new Date(2026, 10, 1)), '2026-10-26'); // a Sunday
  assert.equal(weekOf(new Date(2026, 9, 26)), '2026-10-26'); // the Monday
  assert.equal(lastWeek(new Date(2026, 10, 1)), '2026-10-19');
  assert.equal(statId('cafe1', '2026-10-26'), 'cafe1_2026-10-26');
});

test('four weeks of counts for How it\'s going', () => {
  const weeks = weeksBack(4, new Date(2026, 10, 4));
  assert.deepEqual(weeks, ['2026-11-02', '2026-10-26', '2026-10-19', '2026-10-12']);
  const points = trend([{ week: '2026-11-02', seen: 48, taps: 9 }, { week: '2026-10-26', seen: 18, taps: 0 }], weeks);
  assert.deepEqual(points.map((p) => p.seen), [0, 0, 18, 48]);
  assert.equal(points[0].label, '12 Oct');
  assert.equal(trendSentence(points), '48 students saw your shop on Spots this week, up from 18 last week. 9 students tapped your Menu or Website.');
  assert.equal(trendSentence(trend([{ week: '2026-11-02', seen: 1 }, { week: '2026-10-26', seen: 3 }], weeks)), '1 student saw your shop on Spots this week, down from 3 last week.');
  assert.equal(trendSentence(trend([], weeks)), '0 students saw your shop on Spots this week.');
  // Counts saved by the last version (this week and last week only) still read right.
  assert.deepEqual(trend([{ week: '2026-11-02', seen: 5, taps: 1 }, { week: '2026-10-26', seen: 2, taps: 0 }], weeks).map((p) => p.seen), [0, 0, 2, 5]);
});

test('each phone counts a place once a day', () => {
  const day = new Date(2026, 10, 1, 10);
  const first = toCount(null, 'seen', ['a', 'b', 'a'], day);
  assert.deepEqual(first.fresh, ['a', 'b']);
  const again = toCount(first.record, 'seen', ['a', 'c'], day);
  assert.deepEqual(again.fresh, ['c']);
  // Taps are counted apart from being seen.
  assert.deepEqual(toCount(again.record, 'taps', ['a'], day).fresh, ['a']);
  // A new day starts again.
  assert.deepEqual(toCount(again.record, 'seen', ['a'], new Date(2026, 10, 2, 9)).fresh, ['a']);
  assert.deepEqual(toCount(null, 'seen', [null, ''], day).fresh, []);
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
