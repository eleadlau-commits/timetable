// Tests for firestore.rules. Run with `npm test` in this folder (it starts Google's Firestore
// emulator, so it needs Java). GitHub runs them before every release.

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';

let env;
const LINK = 'webcal://timetable.example.ac.uk/ical/abc123.ics';
const google = { firebase: { sign_in_provider: 'google.com' } };

// The database as seen by someone signed in with Google as `uid`, or by nobody.
const as = (uid) => env.authenticatedContext(uid, google).firestore();
const nobody = () => env.unauthenticatedContext().firestore();
const mine = (uid, db = as(uid)) => doc(db, 'users', uid, 'private', 'main');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mobile-durham',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
beforeEach(() => env.clearFirestore());
after(() => env.cleanup());

// Puts Sam's link in place without going through the rules.
const seedSam = () => env.withSecurityRulesDisabled((ctx) =>
  setDoc(doc(ctx.firestore(), 'users', 'sam', 'private', 'main'), { link: LINK, updatedAt: new Date() }));

test('you can save, read, change and delete your own link', async () => {
  await assertSucceeds(setDoc(mine('sam'), { link: LINK, updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(mine('sam')));
  await assertSucceeds(updateDoc(mine('sam'), { link: 'https://example.ac.uk/new.ics', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(mine('sam'), { updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(mine('sam')));
});

test('nobody else can read, change or delete your link', async () => {
  await seedSam();
  const theirs = doc(as('alex'), 'users', 'sam', 'private', 'main');
  await assertFails(getDoc(theirs));
  await assertFails(setDoc(theirs, { link: LINK, updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(theirs));
});

test('people who are not signed in can do nothing', async () => {
  await seedSam();
  const theirs = doc(nobody(), 'users', 'sam', 'private', 'main');
  await assertFails(getDoc(theirs));
  await assertFails(setDoc(theirs, { link: LINK, updatedAt: serverTimestamp() }));
});

test('only Google sign-ins are accepted', async () => {
  const anonymous = env.authenticatedContext('sam', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  await assertFails(setDoc(mine('sam', anonymous), { link: LINK, updatedAt: serverTimestamp() }));
  await assertFails(getDoc(mine('sam', anonymous)));
});

test('only the one private document is allowed', async () => {
  const other = doc(as('sam'), 'users', 'sam', 'private', 'other');
  await assertFails(setDoc(other, { link: LINK, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('sam'), 'users', 'sam'), { name: 'Sam' }));
  await assertFails(setDoc(doc(as('sam'), 'anything', 'else'), { a: 1 }));
  await assertFails(getDoc(doc(as('sam'), 'anything', 'else')));
});

test('saved data must have the right shape', async () => {
  const save = (data) => setDoc(mine('sam'), data);
  await assertFails(save({ link: LINK, updatedAt: serverTimestamp(), extra: 'no' }));
  await assertFails(save({ link: LINK }));                                        // no time
  await assertFails(save({ link: LINK, updatedAt: new Date(2000, 0, 1) }));       // time not set by the server
  await assertFails(save({ link: 'javascript:alert(1)', updatedAt: serverTimestamp() }));
  await assertFails(save({ link: 'https://has a space', updatedAt: serverTimestamp() }));
  await assertFails(save({ link: `https://example.ac.uk/${'x'.repeat(2048)}`, updatedAt: serverTimestamp() }));
  await assertFails(save({ link: 42, updatedAt: serverTimestamp() }));
  await assertSucceeds(save({ updatedAt: serverTimestamp() }));                   // no link is fine
});
