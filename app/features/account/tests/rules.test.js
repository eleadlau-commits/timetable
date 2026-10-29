import { test, assert } from 'folio/testing';
import { toUser, explain, onlineData, checkNewAccount, checkPassword } from '../rules.js';

test('keeps only the name, email and picture of the signed-in person', () => {
  const user = toUser({ uid: 'abc', displayName: 'Sam Smith', email: 'sam@example.com', photoURL: 'https://lh3.example/p.jpg', phoneNumber: '123' });
  assert.deepEqual(user, { uid: 'abc', name: 'Sam Smith', email: 'sam@example.com', photo: 'https://lh3.example/p.jpg', via: 'google', verified: true });
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

test('Google\'s Android sign-in: cancelling says nothing, other problems are explained', () => {
  assert.equal(explain(new Error('activity is cancelled by the user.')), null);
  assert.match(explain(new Error('No credentials available')), /no Google account/);
  assert.match(explain(new Error('10: DEVELOPER_ERROR')), /isn't set up/);
  assert.match(explain(new Error('no-token')), /isn't set up/);
});

test('deleting your account deletes your private area and shared timetable', () => {
  assert.deepEqual(onlineData('abc'), ['users/abc/private/main', 'users/abc/private/profile', 'shared/abc']);
});

test('an email sign-in is confirmed only once Firebase says the email is', () => {
  const user = (emailVerified) => toUser({ uid: 'abc', email: 'sam@example.com', emailVerified, providerData: [{ providerId: 'password' }] });
  assert.equal(user(false).via, 'email');
  assert.equal(user(false).verified, false);
  assert.equal(user(true).verified, true);
  assert.equal(toUser({ uid: 'abc', providerData: [{ providerId: 'google.com' }] }).via, 'google');
});

test('creating an account needs a name, an email address and a long enough password', () => {
  const ok = { name: 'Sam', email: 'sam@example.com', password: 'long enough' };
  assert.equal(checkNewAccount(ok), null);
  assert.match(checkNewAccount({ ...ok, name: '  ' }), /first name/);
  assert.match(checkNewAccount({ ...ok, name: 'x'.repeat(31) }), /30/);
  assert.match(checkNewAccount({ ...ok, email: 'sam@' }), /email address/);
  assert.match(checkNewAccount({ ...ok, password: 'short' }), /at least 8/);
  assert.match(checkPassword(' spaced out '), /space/);
});

test('a wrong email or password doesn\'t say which was wrong', () => {
  assert.match(explain({ code: 'auth/invalid-credential' }), /don't match/);
  assert.equal(explain({ code: 'auth/user-not-found' }), explain({ code: 'auth/wrong-password' }));
  assert.match(explain({ code: 'auth/email-already-in-use' }), /already an account/);
});
