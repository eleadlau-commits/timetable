import { test, assert } from 'folio/testing';
import { cleanInstagram, showInstagram, checkEdit, differences, withChange, setupStep } from '../rules.js';
import { SOCIETIES, cardFields } from '../store.js';

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

test('where a committee member is with setting up', () => {
  assert.equal(setupStep({ user: null }), 'signed-out');
  assert.equal(setupStep({ user: { verified: false } }), 'unconfirmed');
  assert.equal(setupStep({ user: { verified: true }, loaded: false, mine: null }), 'loading');
  assert.equal(setupStep({ user: { verified: true }, loaded: false, mine: { society: 's1' } }), 'linked');
  assert.equal(setupStep({ user: { verified: true }, loaded: true, mine: null }), 'new');
});

test('a society\'s things keep the database names they always had', () => {
  assert.deepEqual([SOCIETIES.cards, SOCIETIES.codes, SOCIETIES.owners, SOCIETIES.changes, SOCIETIES.stats, SOCIETIES.link],
    ['societies', 'societyCodes', 'societyOwners', 'societyChanges', 'societyStats', 'society']);
  assert.equal(SOCIETIES.removeUsed, true); // removing a used code unlinks its committee member
  assert.deepEqual(cardFields({ line: 'Walks', fee: null }), { line: 'Walks', meets: '', fee: '', instagram: '', join: '' });
});
