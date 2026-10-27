// Tests for the places on Spots in firestore.rules: everyone can read published places, nobody
// can read drafts, and nobody can change anything from the app. Run with `npm test`.

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

const CAFE = { published: true, kind: 'cafe', name: 'Flat White', deal: '10% off', order: 1 };
const DRAFT = { published: false, kind: 'cafe', name: 'Not ready yet' };

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mobile-durham',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  // The team's places, put in place without the rules, as the Firebase console does.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'spots', 'cafe1'), CAFE);
    await setDoc(doc(ctx.firestore(), 'spots', 'draft1'), DRAFT);
  });
});
after(() => env.cleanup());

const published = (db, most = 100) => query(collection(db, 'spots'), where('published', '==', true), limit(most));

test('everyone can read published places, signed in or not', async () => {
  for (const db of [nobody(), as('sam')]) {
    await assertSucceeds(getDoc(doc(db, 'spots', 'cafe1')));
    const snap = await assertSucceeds(getDocs(published(db)));
    if (snap.size !== 1) throw new Error(`expected 1 place, got ${snap.size}`);
  }
});

test('drafts can\'t be read', async () => {
  await assertFails(getDoc(doc(nobody(), 'spots', 'draft1')));
  await assertFails(getDoc(doc(as('sam'), 'spots', 'draft1')));
  // Asking for every place, drafts included, is refused.
  await assertFails(getDocs(query(collection(as('sam'), 'spots'), limit(100))));
});

test('asking for too many at once is refused', async () => {
  await assertFails(getDocs(published(as('sam'), 101)));
  await assertFails(getDocs(query(collection(as('sam'), 'spots'), where('published', '==', true))));
});

test('nobody can add, change or delete places from the app', async () => {
  for (const db of [nobody(), as('sam')]) {
    await assertFails(setDoc(doc(db, 'spots', 'new1'), { ...CAFE, name: 'My own café' }));
    await assertFails(updateDoc(doc(db, 'spots', 'cafe1'), { deal: '100% off' }));
    await assertFails(setDoc(doc(db, 'spots', 'cafe1'), { ...CAFE, deal: '100% off' }));
    await assertFails(updateDoc(doc(db, 'spots', 'draft1'), { published: true }));
    await assertFails(deleteDoc(doc(db, 'spots', 'cafe1')));
  }
});
