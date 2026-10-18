import { test, assert } from 'folio/testing';
import { toUser, explain } from '../rules.js';

test('keeps only the name, email and picture of the signed-in person', () => {
  const user = toUser({ uid: 'abc', displayName: 'Sam Smith', email: 'sam@example.com', photoURL: 'https://lh3.example/p.jpg', phoneNumber: '123' });
  assert.deepEqual(user, { uid: 'abc', name: 'Sam Smith', email: 'sam@example.com', photo: 'https://lh3.example/p.jpg' });
});

test('a person without a name is called by their email', () => {
  assert.equal(toUser({ uid: 'abc', email: 'sam@example.com' }).name, 'sam');
  assert.equal(toUser({ uid: 'abc' }).name, 'You');
});

test('only https pictures are used', () => {
  assert.equal(toUser({ uid: 'abc', photoURL: 'javascript:alert(1)' }).photo, null);
  assert.equal(toUser({ uid: 'abc' }).photo, null);
});

test('no user means signed out', () => {
  assert.equal(toUser(null), null);
  assert.equal(toUser({}), null);
});

test('closing the Google window yourself says nothing', () => {
  assert.equal(explain({ code: 'auth/popup-closed-by-user' }), null);
  assert.equal(explain({ code: 'auth/cancelled-popup-request' }), null);
});

test('problems are explained in plain words', () => {
  assert.match(explain({ code: 'auth/popup-blocked' }), /blocked/);
  assert.match(explain({ code: 'auth/network-request-failed' }), /online/);
  assert.match(explain(new Error('load')), /Couldn't load/);
  assert.match(explain(new Error('anything')), /try again/);
});
