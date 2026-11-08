// Tests for the lists in firestore.rules (lists/spots and lists/societies): every published card in
// one document, so phones read 1 document instead of one per card. Everyone can read them; only
// the team (admins) can write them. Run with `npm test`.

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc, doc, getDoc, serverTimestamp, setDoc,
} from 'firebase/firestore';

let env;
const google = { firebase: { sign_in_provider: 'google.com' } };
const as = (uid) => env.authenticatedContext(uid, google).firestore();
const nobody = () => env.unauthenticatedContext().firestore();

const LIST = () => ({ items: { cafe1: { published: true, kind: 'cafe', name: 'Flat White' } }, at: serverTimestamp() });

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mobile-durham',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', 'eve'), {});
    await setDoc(doc(db, 'lists', 'spots'), { items: {}, at: 1 });
    await setDoc(doc(db, 'lists', 'secret'), { items: {}, at: 1 });
  });
});
after(() => env.cleanup());

test('everyone can read the lists, signed in or not, but no other names', async () => {
  for (const db of [nobody(), as('sam')]) {
    await assertSucceeds(getDoc(doc(db, 'lists', 'spots')));
    await assertSucceeds(getDoc(doc(db, 'lists', 'societies')));
    await assertFails(getDoc(doc(db, 'lists', 'secret')));
  }
});

test('the team can make, replace and delete a list', async () => {
  const db = as('eve');
  await assertSucceeds(setDoc(doc(db, 'lists', 'spots'), LIST()));
  await assertSucceeds(setDoc(doc(db, 'lists', 'societies'), LIST()));
  await assertSucceeds(deleteDoc(doc(db, 'lists', 'spots')));
});

test('a list holds only its items and when it was made', async () => {
  const db = as('eve');
  await assertFails(setDoc(doc(db, 'lists', 'spots'), { ...LIST(), extra: 1 }));
  await assertFails(setDoc(doc(db, 'lists', 'spots'), { items: 'not a map', at: serverTimestamp() }));
  await assertFails(setDoc(doc(db, 'lists', 'spots'), { items: {}, at: 5 }));
  await assertFails(setDoc(doc(db, 'lists', 'other'), LIST()));
});

test('nobody else can write or delete a list', async () => {
  for (const db of [nobody(), as('sam')]) {
    await assertFails(setDoc(doc(db, 'lists', 'spots'), LIST()));
    await assertFails(deleteDoc(doc(db, 'lists', 'spots')));
  }
});
