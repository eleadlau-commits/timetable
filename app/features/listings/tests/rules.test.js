import { test, assert } from 'folio/testing';
import {
  kindOf, webLink, toMillis, toPlace, liveDeal, placesOf, withDeals, dealUntil, isStale, FRESH_FOR,
} from '../rules.js';

const cafe = (extra = {}) => ({ published: true, kind: 'cafe', name: 'Flat White', line: 'Coffee on Elvet Bridge', ...extra });

test('kinds are understood however they are typed', () => {
  assert.equal(kindOf('cafe'), 'cafes');
  assert.equal(kindOf(' Café '), 'cafes');
  assert.equal(kindOf('CAFES'), 'cafes');
  assert.equal(kindOf('pub'), 'pubs');
  assert.equal(kindOf('clubs'), 'clubs');
  assert.equal(kindOf('restaurant'), null);
  assert.equal(kindOf(''), null);
  assert.equal(kindOf(undefined), null);
});

test('only https links are kept', () => {
  assert.equal(webLink('https://flatwhite.example/'), 'https://flatwhite.example/');
  assert.equal(webLink(' https://flatwhite.example '), 'https://flatwhite.example/');
  assert.equal(webLink('http://flatwhite.example/'), null);
  assert.equal(webLink('javascript:alert(1)'), null);
  assert.equal(webLink('flatwhite.example'), null);
  assert.equal(webLink(42), null);
});

test('dates from the database', () => {
  assert.equal(toMillis({ toMillis: () => 123 }), 123);
  assert.equal(toMillis(new Date(2026, 10, 30)), new Date(2026, 10, 30).getTime());
  assert.equal(toMillis('2026-11-30'), Date.parse('2026-11-30'));
  assert.equal(toMillis('soon'), null);
  assert.equal(toMillis(null), null);
  assert.equal(toMillis(''), null);
});

test('a published place is tidied for showing', () => {
  const place = toPlace('abc', cafe({ deal: '  10% off   with a student card ', link: 'https://flatwhite.example', order: 2 }));
  assert.deepEqual(place, {
    id: 'abc', kind: 'cafes', name: 'Flat White', line: 'Coffee on Elvet Bridge',
    deal: '10% off with a student card', dealEnds: null, address: '', link: 'https://flatwhite.example/',
    hours: '', menu: null, order: 2,
  });
  const more = toPlace('abc', cafe({ hours: ' Mon–Sat  8–5 ', menu: 'https://flatwhite.example/menu', link: 'http://plain.example' }));
  assert.equal(more.hours, 'Mon–Sat 8–5');
  assert.equal(more.menu, 'https://flatwhite.example/menu');
  assert.equal(more.link, null);
  assert.equal(toPlace('abc', cafe({ menu: 'javascript:alert(1)' })).menu, null);
  assert.equal(toPlace('abc', cafe()).deal, null);
  assert.equal(toPlace('abc', cafe()).order, 50);
});

test('places that cannot be shown are left out', () => {
  assert.equal(toPlace('a', cafe({ published: false })), null);
  assert.equal(toPlace('a', cafe({ published: 'yes' })), null);
  assert.equal(toPlace('a', { kind: 'cafe', name: 'Draft' }), null);
  assert.equal(toPlace('a', cafe({ kind: 'shop' })), null);
  assert.equal(toPlace('a', cafe({ name: '   ' })), null);
  assert.equal(toPlace('a', cafe({ name: 7 })), null);
  assert.equal(toPlace('a', null), null);
});

test('long text is cut short', () => {
  const place = toPlace('a', cafe({ name: 'x'.repeat(200), deal: 'y'.repeat(500) }));
  assert.equal(place.name.length, 60);
  assert.ok(place.name.endsWith('…'));
  assert.equal(place.deal.length, 120);
});

test('a deal lasts until the end of its last day', () => {
  const ends = new Date(2026, 10, 30, 0, 0).getTime();
  const place = toPlace('a', cafe({ deal: 'Free cookie', dealEnds: ends }));
  assert.equal(liveDeal(place, new Date(2026, 10, 30, 23, 59).getTime()), 'Free cookie');
  assert.equal(liveDeal(place, new Date(2026, 11, 1, 0, 0).getTime()), null);
  assert.equal(liveDeal(toPlace('a', cafe({ deal: 'Always' })), Date.now()), 'Always');
  assert.equal(liveDeal(toPlace('a', cafe()), Date.now()), null);
  assert.equal(dealUntil(place), 'Until 30 Nov');
  assert.equal(dealUntil(toPlace('a', cafe({ deal: 'Always' }))), '');
});

test('places are sorted by the team\'s order, then by name', () => {
  const places = [
    toPlace('1', cafe({ name: 'Zest', order: 1 })),
    toPlace('2', cafe({ name: 'Bean' })),
    toPlace('3', cafe({ name: 'Arch' })),
    toPlace('4', { published: true, kind: 'pub', name: 'The Swan', deal: '£1 off pints' }),
  ];
  assert.deepEqual(placesOf(places, 'cafes').map((p) => p.name), ['Zest', 'Arch', 'Bean']);
  assert.deepEqual(placesOf(places, 'clubs'), []);
  assert.deepEqual(placesOf(null, 'cafes'), []);
  assert.deepEqual(withDeals(places).map((p) => p.name), ['The Swan']);
});

test('the saved copy is used for a while, then fetched again', () => {
  const now = Date.now();
  assert.equal(isStale(null, now), true);
  assert.equal(isStale({ at: now - 60000, places: [] }, now), false);
  assert.equal(isStale({ at: now - FRESH_FOR, places: [] }, now), true);
  assert.equal(isStale({ at: now + 3600000, places: [] }, now), true);   // the phone's clock went back
  assert.equal(isStale({ places: [] }, now), true);
});
