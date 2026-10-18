// Tests for the friends part of firestore.rules: codes, requests, accepting, and who can see
// whose timetable. Run with `npm test` in firebase/ (it starts Google's emulator; needs Java).

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayUnion, deleteDoc, doc, getDoc, getDocs, collection, query, where, serverTimestamp, setDoc,
  updateDoc, writeBatch,
} from 'firebase/firestore';

let env;
const google = { firebase: { sign_in_provider: 'google.com' } };
const as = (uid) => env.authenticatedContext(uid, google).firestore();
const pair = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
const CODES = { alex: 'MD-ALEX-2345', sam: 'MD-SAMM-2345', zoe: 'MD-ZOEE-2345' };
const CLASSES = [{ t: 'MATH1001 Lecture', s: 1, e: 2, l: 'CLC013' }];

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mobile-durham',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  // Sam, Alex and Zoe have profiles, codes and shared timetables, set up without the rules.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, code] of Object.entries(CODES)) {
      await setDoc(doc(db, 'users', uid, 'private', 'profile'), { name: uid, code, people: [], updatedAt: new Date() });
      await setDoc(doc(db, 'codes', code), { uid, name: uid });
      await setDoc(doc(db, 'shared', uid), { classes: CLASSES, updatedAt: new Date() });
    }
  });
});
after(() => env.cleanup());

// Sam asks Alex, as the app does it: Alex goes on Sam's list, and the request is made.
function ask(from, to, overrides = {}, { addToList = true } = {}) {
  const db = as(from);
  const batch = writeBatch(db);
  if (addToList) batch.update(doc(db, 'users', from, 'private', 'profile'), { people: arrayUnion(to), updatedAt: serverTimestamp() });
  batch.set(doc(db, 'friendships', pair(from, to)), {
    users: [from, to].sort(), from, to, status: 'pending', code: CODES[to],
    names: { [from]: from, [to]: to }, createdAt: serverTimestamp(), ...overrides,
  });
  return batch.commit();
}

// Alex accepts Sam's request, as the app does it.
function accept(by, other, { addToList = true } = {}) {
  const db = as(by);
  const batch = writeBatch(db);
  if (addToList) batch.update(doc(db, 'users', by, 'private', 'profile'), { people: arrayUnion(other), updatedAt: serverTimestamp() });
  batch.update(doc(db, 'friendships', pair(by, other)), { status: 'accepted', acceptedAt: serverTimestamp() });
  return batch.commit();
}

const sees = (viewer, owner) => getDoc(doc(as(viewer), 'shared', owner));

// ---- Profiles and codes ----

test('your profile is yours alone, and must have the right shape', async () => {
  const mine = (db) => doc(db, 'users', 'sam', 'private', 'profile');
  await assertSucceeds(getDoc(mine(as('sam'))));
  await assertFails(getDoc(mine(as('alex'))));
  const save = (data) => setDoc(mine(as('sam')), { name: 'Sam', code: CODES.sam, people: [], updatedAt: serverTimestamp(), ...data });
  await assertSucceeds(save({}));
  await assertFails(save({ name: '' }));
  await assertFails(save({ name: 'x'.repeat(31) }));
  await assertFails(save({ code: 'MD-0000-1111' }));                      // 0 and 1 aren't used in codes
  await assertFails(save({ people: Array.from({ length: 51 }, (_, i) => `p${i}`) }));
  await assertFails(save({ people: ['sam'] }));                           // not yourself
  await assertFails(save({ email: 'sam@example.com' }));
});

test('a code can be looked up one at a time, never listed', async () => {
  await assertSucceeds(getDoc(doc(as('zoe'), 'codes', CODES.sam)));
  await assertFails(getDocs(collection(as('zoe'), 'codes')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'codes', CODES.sam)));
});

test('you can only make a code for yourself, and only the one in your profile', async () => {
  const db = as('sam');
  const fresh = 'MD-NEWW-2345';
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', 'sam', 'private', 'profile'), { name: 'Sam', code: fresh, people: [], updatedAt: serverTimestamp() });
  batch.set(doc(db, 'codes', fresh), { uid: 'sam', name: 'Sam' });
  await assertSucceeds(batch.commit());
  await assertFails(setDoc(doc(db, 'codes', 'MD-OTHR-2345'), { uid: 'sam', name: 'Sam' }));     // not in the profile
  await assertFails(setDoc(doc(as('zoe'), 'codes', 'MD-ZOE2-2345'), { uid: 'sam', name: 'Sam' })); // not yours
  await assertFails(updateDoc(doc(as('zoe'), 'codes', CODES.sam), { name: 'Ha' }));
  await assertSucceeds(updateDoc(doc(as('sam'), 'codes', CODES.sam), { name: 'Sammy' }));
  await assertFails(updateDoc(doc(as('sam'), 'codes', CODES.sam), { uid: 'zoe' }));
});

// ---- Requests ----

test('you can ask someone with their code', async () => {
  await assertSucceeds(ask('sam', 'alex'));
  await assertSucceeds(getDoc(doc(as('sam'), 'friendships', pair('sam', 'alex'))));
  await assertSucceeds(getDoc(doc(as('alex'), 'friendships', pair('sam', 'alex'))));
  await assertFails(getDoc(doc(as('zoe'), 'friendships', pair('sam', 'alex'))));
  await assertSucceeds(getDocs(query(collection(as('alex'), 'friendships'), where('users', 'array-contains', 'alex'))));
  await assertFails(getDocs(query(collection(as('zoe'), 'friendships'), where('users', 'array-contains', 'alex'))));
});

test('a request must be honest', async () => {
  await assertFails(ask('sam', 'alex', { code: CODES.zoe }));               // Zoe's code, not Alex's
  await assertFails(ask('sam', 'alex', { code: 'MD-NONE-2345' }));          // no such code
  await assertFails(ask('sam', 'alex', { status: 'accepted' }));            // can't skip asking
  await assertFails(ask('sam', 'alex', { from: 'alex', to: 'sam' }));       // can't ask on someone's behalf
  await assertFails(ask('sam', 'alex', { users: ['alex', 'zoe'] }));
  await assertFails(ask('sam', 'alex', { createdAt: new Date(2000, 0, 1) }));
  await assertFails(ask('sam', 'alex', {}, { addToList: false }));          // must count against your 50
  await assertFails(ask('sam', 'sam'));
});

test('you can\'t ask twice, or ask someone who already asked you', async () => {
  await assertSucceeds(ask('sam', 'alex'));
  await assertFails(ask('sam', 'alex'));
  await assertFails(ask('alex', 'sam'));
});

test('you can\'t have more than 50 people', async () => {
  await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'users', 'sam', 'private', 'profile'), {
    people: Array.from({ length: 50 }, (_, i) => `p${i}`),
  }));
  await assertFails(ask('sam', 'alex'));
});

// ---- Accepting ----

test('only the person asked can accept', async () => {
  await ask('sam', 'alex');
  await assertFails(accept('sam', 'alex'));                                 // the asker
  await assertFails(accept('zoe', 'alex'));                                 // a stranger
  await assertFails(accept('alex', 'sam', { addToList: false }));           // must count against Alex's 50
  await assertSucceeds(accept('alex', 'sam'));
});

test('accepting can\'t change anything else', async () => {
  await ask('sam', 'alex');
  const db = as('alex');
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', 'alex', 'private', 'profile'), { people: arrayUnion('sam'), updatedAt: serverTimestamp() });
  batch.update(doc(db, 'friendships', pair('sam', 'alex')), { status: 'accepted', acceptedAt: serverTimestamp(), from: 'alex' });
  await assertFails(batch.commit());
});

// ---- Who can see whose timetable ----

test('asking someone lets them see yours straight away, but not you theirs', async () => {
  await assertFails(sees('alex', 'sam'));
  await ask('sam', 'alex');
  await assertSucceeds(sees('alex', 'sam'));
  await assertFails(sees('sam', 'alex'));
  await assertFails(sees('zoe', 'sam'));
});

test('once accepted, you see each other\'s', async () => {
  await ask('sam', 'alex');
  await accept('alex', 'sam');
  await assertSucceeds(sees('alex', 'sam'));
  await assertSucceeds(sees('sam', 'alex'));
  await assertFails(sees('zoe', 'sam'));
  await assertFails(sees('zoe', 'alex'));
});

test('cancelling, declining or removing stops it, either way', async () => {
  await ask('sam', 'alex');
  await assertFails(deleteDoc(doc(as('zoe'), 'friendships', pair('sam', 'alex'))));
  await assertSucceeds(deleteDoc(doc(as('alex'), 'friendships', pair('sam', 'alex'))));   // declined
  await assertFails(sees('alex', 'sam'));
  await ask('sam', 'alex');
  await accept('alex', 'sam');
  await assertSucceeds(deleteDoc(doc(as('sam'), 'friendships', pair('sam', 'alex'))));    // removed
  await assertFails(sees('alex', 'sam'));
  await assertFails(sees('sam', 'alex'));
});

test('you can rename yourself in a friendship, but not your friend', async () => {
  await ask('sam', 'alex');
  const f = (uid) => doc(as(uid), 'friendships', pair('sam', 'alex'));
  await assertSucceeds(updateDoc(f('sam'), { 'names.sam': 'Sammy' }));
  await assertFails(updateDoc(f('sam'), { 'names.alex': 'Not Alex' }));
  await assertFails(updateDoc(f('sam'), { 'names.sam': '' }));
  await assertFails(updateDoc(f('sam'), { status: 'accepted' }));
  await assertFails(updateDoc(f('zoe'), { 'names.zoe': 'Zoe' }));
});

// ---- Your shared timetable ----

test('only you can change your shared timetable, and only in the right shape', async () => {
  const mine = (uid) => doc(as(uid), 'shared', 'sam');
  await assertSucceeds(setDoc(mine('sam'), { classes: CLASSES, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(mine('alex'), { classes: CLASSES, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(mine('sam'), { classes: CLASSES, updatedAt: serverTimestamp(), link: 'https://x' }));
  await assertFails(setDoc(mine('sam'), { classes: Array(401).fill(CLASSES[0]), updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(mine('alex')));
  await assertSucceeds(deleteDoc(mine('sam')));
});
