import { test, assert } from 'folio/testing';
import {
  makeCode, cleanCode, showCode, CODE_LETTERS, cleanLink, cleanInstagram, showInstagram, checkEdit, differences,
  withChange, weekOf, weeksBack, trend, trendSentence, statId, toCount, setupStep,
} from '../rules.js';

test('society codes are 8 easy-to-read letters, typed any way', () => {
  const code = makeCode();
  assert.equal(code.length, 8);
  assert.ok([...code].every((c) => CODE_LETTERS.includes(c)));
  assert.equal(makeCode(() => [0, 1, 2, 3, 31, 32, 33, 255]), 'ABCD9AB9');
  assert.equal(cleanCode('k7qm 2xpa'), 'K7QM2XPA');
  assert.equal(cleanCode('K7QM-2XPA'), 'K7QM2XPA');
  assert.equal(cleanCode('K7QM2XPO'), null);
  assert.equal(cleanCode(''), null);
  assert.equal(showCode('K7QM2XPA'), 'K7QM-2XPA');
});

test('links get https, and only https is kept', () => {
  assert.equal(cleanLink('durhamsu.com/join'), 'https://durhamsu.com/join');
  assert.equal(cleanLink(''), '');
  assert.equal(cleanLink('http://durhamsu.com'), null);
  assert.equal(cleanLink('javascript:alert(1)'), null);
});

test('Instagram accounts are understood however they are typed', () => {
  const full = 'https://www.instagram.com/durhamhiking/';
  assert.equal(cleanInstagram('@durhamhiking'), full);
  assert.equal(cleanInstagram('durhamhiking'), full);
  assert.equal(cleanInstagram(' instagram.com/durhamhiking '), full);
  assert.equal(cleanInstagram('https://www.instagram.com/durhamhiking/?hl=en'), full);
  assert.equal(cleanInstagram(''), '');
  assert.equal(cleanInstagram('not an account!'), null);
  assert.equal(cleanInstagram('https://evil.example/durhamhiking'), null);
  assert.equal(showInstagram(full), '@durhamhiking');
  assert.equal(showInstagram(''), '');
});

test('a committee\'s change is tidied and checked', () => {
  const { change } = checkEdit({ line: '  Walks   in the Dales ', meets: 'Saturdays', fee: '£5', instagram: '@durhamhiking', join: 'durhamsu.com/hiking' });
  assert.deepEqual(change, {
    line: 'Walks in the Dales', meets: 'Saturdays', fee: '£5',
    instagram: 'https://www.instagram.com/durhamhiking/', join: 'https://durhamsu.com/hiking',
  });
  assert.equal(checkEdit({ line: 'x'.repeat(200) }).change.line.length, 140);
  assert.match(checkEdit({ join: 'http://x.com' }).error, /Join link/);
  assert.match(checkEdit({ instagram: 'two words' }).error, /Instagram/);
  assert.deepEqual(checkEdit({}).change, { line: '', meets: '', fee: '', instagram: '', join: '' });
});

test('the team sees what a change changes', () => {
  const society = { name: 'Hiking', line: 'Walks', meets: 'Saturdays', fee: '', instagram: 'https://www.instagram.com/old/', join: '' };
  const rows = differences(society, { line: 'Walks', meets: 'Sundays', fee: '£5', instagram: 'https://www.instagram.com/new/', join: '' });
  assert.deepEqual(rows.map((r) => [r.key, r.now, r.next]), [
    ['meets', 'Saturdays', 'Sundays'], ['fee', '', '£5'], ['instagram', '@old', '@new'],
  ]);
});

test('a waiting change shows on top of the card', () => {
  const society = { id: 's1', name: 'Hiking', line: 'Walks', fee: '£5', published: true };
  assert.equal(withChange(null, {}), null);
  assert.equal(withChange(society, null), society);
  const shown = withChange(society, { line: 'Longer walks', meets: '', fee: '', instagram: '', join: '' });
  assert.equal(shown.line, 'Longer walks');
  assert.equal(shown.fee, '');
  assert.equal(shown.name, 'Hiking');
});

test('counts are kept per Monday, and the trend fills missing weeks', () => {
  const thursday = new Date(2026, 10, 5, 15);
  assert.equal(weekOf(thursday), '2026-11-02');
  assert.deepEqual(weeksBack(3, thursday), ['2026-11-02', '2026-10-26', '2026-10-19']);
  const points = trend([{ week: '2026-11-02', seen: 12, taps: 3 }, { week: '2026-10-26', seen: 5 }], weeksBack(3, thursday));
  assert.deepEqual(points.map((p) => p.seen), [0, 5, 12]);
  assert.equal(trendSentence(points), '12 students saw your society this week, up from 5 last week. 3 students tapped Instagram or Join.');
  assert.equal(trendSentence([{ seen: 1, taps: 0 }]), '1 student saw your society this week.');
  assert.equal(statId('s1', '2026-11-02'), 's1_2026-11-02');
});

test('each phone counts a society once a day', () => {
  const day = new Date(2026, 10, 5, 10);
  const first = toCount(null, 'seen', ['a', 'b', 'a'], day);
  assert.deepEqual(first.fresh, ['a', 'b']);
  const again = toCount(first.record, 'seen', ['a', 'c'], day);
  assert.deepEqual(again.fresh, ['c']);
  assert.deepEqual(toCount(again.record, 'taps', ['a'], day).fresh, ['a']);
  assert.deepEqual(toCount(again.record, 'seen', ['a'], new Date(2026, 10, 6, 10)).fresh, ['a']);
});

test('where a committee member is with setting up', () => {
  assert.equal(setupStep({ user: null }), 'signed-out');
  assert.equal(setupStep({ user: { verified: false } }), 'unconfirmed');
  assert.equal(setupStep({ user: { verified: true }, loaded: false, mine: null }), 'loading');
  assert.equal(setupStep({ user: { verified: true }, loaded: false, mine: { society: 's1' } }), 'linked');
  assert.equal(setupStep({ user: { verified: true }, loaded: true, mine: null }), 'new');
});
