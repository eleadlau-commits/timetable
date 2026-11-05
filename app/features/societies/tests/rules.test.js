import { test, assert } from 'folio/testing';
import { toSociety, typeOf, typeName, instagramLink, photoOf, pick, typesIn, isStale, FRESH_FOR } from '../rules.js';

const soc = (extra = {}) => ({ published: true, type: 'sport', name: 'Hiking Society', line: 'Walks in the Dales', ...extra });

test('a published society is tidied for showing', () => {
  assert.deepEqual(toSociety('h1', soc({ meets: ' Saturdays  9am, Market Place ', fee: '£5 a year', instagram: '@durhamhiking', join: 'https://join.example/hiking', order: 2 })), {
    id: 'h1', type: 'sport', name: 'Hiking Society', line: 'Walks in the Dales', meets: 'Saturdays 9am, Market Place',
    fee: '£5 a year', instagram: 'https://www.instagram.com/durhamhiking/', join: 'https://join.example/hiking', photo: null, order: 2,
  });
  assert.equal(toSociety('h1', soc()).order, 50);
  assert.equal(toSociety('h1', soc({ join: 'http://plain.example' })).join, null);
  assert.equal(toSociety('h1', soc({ join: 'javascript:alert(1)' })).join, null);
});

test('drafts and societies without a name are left out', () => {
  assert.equal(toSociety('a', soc({ published: false })), null);
  assert.equal(toSociety('a', soc({ published: 'yes' })), null);
  assert.equal(toSociety('a', soc({ name: '  ' })), null);
  assert.equal(toSociety('a', null), null);
});

test('types are understood however they are typed', () => {
  assert.equal(typeOf('Sports'), 'sport');
  assert.equal(typeOf(' ACADEMIC '), 'academic');
  assert.equal(typeOf('knitting'), 'other');
  assert.equal(typeOf(undefined), 'other');
  assert.equal(typeName('arts'), 'Arts and music');
  assert.equal(typeName('nonsense'), 'Other');
});

test('Instagram accounts become links', () => {
  assert.equal(instagramLink('durham.hiking'), 'https://www.instagram.com/durham.hiking/');
  assert.equal(instagramLink('https://www.instagram.com/durhamhiking/'), 'https://www.instagram.com/durhamhiking/');
  assert.equal(instagramLink('not a handle'), null);
  assert.equal(instagramLink('https://evil.example/instagram.com/'), null);
  assert.equal(instagramLink(''), null);
});

test('photos: an https address, or a picture that comes with the app', () => {
  assert.equal(photoOf('hiking.jpg', 'https://app.example/features/societies/Societies.js'), 'https://app.example/features/societies/photos/hiking.jpg');
  assert.equal(photoOf('https://photos.example/a.png'), 'https://photos.example/a.png');
  assert.equal(photoOf('../x.jpg', 'https://app.example/features/societies/Societies.js'), null);
});

test('picking societies by type and search', () => {
  const list = [
    toSociety('a', soc({ name: 'Hiking Society', order: 5 })),
    toSociety('b', soc({ name: 'Rowing Club', line: 'On the Wear at dawn' })),
    toSociety('c', soc({ type: 'arts', name: 'Choral Society', line: 'Singing in the Cathedral' })),
  ];
  assert.deepEqual(pick(list).map((s) => s.id), ['a', 'c', 'b']);
  assert.deepEqual(pick(list, 'arts').map((s) => s.id), ['c']);
  assert.deepEqual(pick(list, 'all', 'wear').map((s) => s.id), ['b']);
  assert.deepEqual(pick(list, 'all', 'CATHÉDRAL singing').map((s) => s.id), ['c']);
  assert.deepEqual(pick(list, 'sport', 'choral'), []);
  assert.deepEqual(typesIn(list), [{ id: 'sport', name: 'Sport', count: 2 }, { id: 'arts', name: 'Arts and music', count: 1 }]);
});

test('the saved copy is used for 12 hours', () => {
  const now = 1_800_000_000_000;
  assert.equal(isStale(null, now), true);
  assert.equal(isStale({ at: now - 1000 }, now), false);
  assert.equal(isStale({ at: now - FRESH_FOR }, now), true);
  assert.equal(isStale({ at: now + 60000 }, now), true);
});
