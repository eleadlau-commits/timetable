// Tests for societies in firestore.rules: everyone can read published societies, nobody can
// read drafts, and nobody can change anything from the app. Run with `npm test`.

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, where,
} from 'firebase/firestore';

let env;
const google = { firebase: { sign_in_provider: 'google.com' } };
const as = (uid) => env.authenticatedContext(uid, google).firestore();
const nobody = () => env.unauthenticatedContext().firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mobile-durham',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  // The team's societies, put in place without the rules, as the Firebase console does.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'societies', 'hiking'), { published: true, type: 'sport', name: 'Hiking Society' });
    await setDoc(doc(ctx.firestore(), 'societies', 'draft'), { published: false, type: 'arts', name: 'Not ready yet' });
  });
});
after(() => env.cleanup());

const published = (db, most = 300) => query(collection(db, 'societies'), where('published', '==', true), limit(most));

test('everyone can read published societies, signed in or not', async () => {
  for (const db of [nobody(), as('sam')]) {
    await assertSucceeds(getDoc(doc(db, 'societies', 'hiking')));
    const snap = await assertSucceeds(getDocs(published(db)));
    if (snap.size !== 1) throw new Error(`expected 1 society, got ${snap.size}`);
  }
});

test('drafts can\'t be read, and asking for too many is refused', async () => {
  await assertFails(getDoc(doc(nobody(), 'societies', 'draft')));
  await assertFails(getDocs(query(collection(as('sam'), 'societies'), limit(100))));
  await assertFails(getDocs(published(as('sam'), 301)));
});

test('nobody can add, change or delete societies from the app', async () => {
  for (const db of [nobody(), as('sam')]) {
    await assertFails(setDoc(doc(db, 'societies', 'new'), { published: true, type: 'sport', name: 'Mine' }));
    await assertFails(updateDoc(doc(db, 'societies', 'hiking'), { name: 'Changed' }));
    await assertFails(deleteDoc(doc(db, 'societies', 'hiking')));
  }
});
