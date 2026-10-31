// Tests for businesses on Spots in firestore.rules: shop codes, owners, their changes waiting for
// approval, requests to be listed, the weekly counts, and the team (admins) who approve.
// Run with `npm test`.

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, increment, limit, query, serverTimestamp, setDoc,
  updateDoc, where, writeBatch,
} from 'firebase/firestore';

let env;
const google = { firebase: { sign_in_provider: 'google.com' } };
const unconfirmed = { email: 'x@example.com', email_verified: false, firebase: { sign_in_provider: 'password' } };
const as = (uid, token = google) => env.authenticatedContext(uid, token).firestore();
const nobody = () => env.unauthenticatedContext().firestore();

const CAFE = { published: true, kind: 'cafe', name: 'Flat White', deal: '10% off', order: 1 };
const PUB = { published: true, kind: 'pub', name: 'The Swan' };
const DRAFT = { published: false, kind: 'cafe', name: 'Not ready yet' };
const WEEK = '2026-10-26';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mobile-durham',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  // What the team sets up in the Firebase console, without the rules.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'spots', 'cafe1'), CAFE);
    await setDoc(doc(db, 'spots', 'pub1'), PUB);
    await setDoc(doc(db, 'spots', 'draft1'), DRAFT);
    await setDoc(doc(db, 'admins', 'eve'), {});
    await setDoc(doc(db, 'shopCodes', 'K7QM2XPA'), { place: 'cafe1', usedBy: null, made: new Date() });
    await setDoc(doc(db, 'shopCodes', 'DRAFT234'), { place: 'draft1', usedBy: null, made: new Date() });
    // Olly already looks after the pub.
    await setDoc(doc(db, 'shopOwners', 'olly'), { place: 'pub1', code: 'PUBPUB23', at: 1 });
  });
});
after(() => env.cleanup());

// Using a code, as the app does: mark it used and link the account, in one step.
async function useCode(db, uid, code, place) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'shopCodes', code), { usedBy: uid });
  batch.set(doc(db, 'shopOwners', uid), { place, code, at: Date.now() });
  return batch.commit();
}

const change = (uid, place, extra = {}) => ({
  place, by: uid, line: 'Coffee', deal: '20% off', dealEnds: null, hours: 'Mon–Fri 8–6',
  link: 'https://flatwhite.example/', menu: '', status: 'waiting', at: serverTimestamp(), ...extra,
});

// ---- Admins ----

test('only you can check whether you are an admin, and nobody can make themselves one', async () => {
  await assertSucceeds(getDoc(doc(as('eve'), 'admins', 'eve')));
  await assertSucceeds(getDoc(doc(as('sam'), 'admins', 'sam')));
  await assertFails(getDoc(doc(as('sam'), 'admins', 'eve')));
  await assertFails(getDocs(collection(as('eve'), 'admins')));
  await assertFails(setDoc(doc(as('sam'), 'admins', 'sam'), {}));
});

// ---- Shop codes ----

test('a shop code links your account to its place, once', async () => {
  const sam = as('sam');
  await assertSucceeds(getDoc(doc(sam, 'shopCodes', 'K7QM2XPA')));
  await assertSucceeds(useCode(sam, 'sam', 'K7QM2XPA', 'cafe1'));
  await assertSucceeds(getDoc(doc(sam, 'shopOwners', 'sam')));
  // Someone else can't use it again.
  await assertFails(useCode(as('tom'), 'tom', 'K7QM2XPA', 'cafe1'));
});

test('a code only links to its own place', async () => {
  await assertFails(useCode(as('sam'), 'sam', 'K7QM2XPA', 'pub1'));
  // And you can't link yourself to a place without using a code.
  await assertFails(setDoc(doc(as('sam'), 'shopOwners', 'sam'), { place: 'cafe1', code: 'K7QM2XPA', at: 1 }));
  await assertFails(setDoc(doc(as('sam'), 'shopOwners', 'sam'), { place: 'cafe1', code: '', at: 1 }));
});

test('codes can\'t be listed, and need a confirmed account', async () => {
  await assertFails(getDocs(query(collection(as('sam'), 'shopCodes'), limit(10))));
  await assertFails(getDoc(doc(nobody(), 'shopCodes', 'K7QM2XPA')));
  await assertFails(useCode(as('una', unconfirmed), 'una', 'K7QM2XPA', 'cafe1'));
});

test('only admins make codes, and they can list them', async () => {
  const code = { place: 'cafe1', usedBy: null, made: serverTimestamp() };
  await assertFails(setDoc(doc(as('sam'), 'shopCodes', 'ABCD2345'), code));
  await assertSucceeds(setDoc(doc(as('eve'), 'shopCodes', 'ABCD2345'), code));
  await assertFails(setDoc(doc(as('eve'), 'shopCodes', 'not-a-code'), code));
  await assertSucceeds(getDocs(query(collection(as('eve'), 'shopCodes'), limit(200))));
  await assertSucceeds(deleteDoc(doc(as('eve'), 'shopCodes', 'ABCD2345')));
});

test('the person who used a code can delete it, others can\'t', async () => {
  await useCode(as('sam'), 'sam', 'K7QM2XPA', 'cafe1');
  await assertFails(deleteDoc(doc(as('tom'), 'shopCodes', 'K7QM2XPA')));
  await assertSucceeds(deleteDoc(doc(as('sam'), 'shopCodes', 'K7QM2XPA')));
});

// ---- Owners and their places ----

test('an owner can read their own place, even a draft, but not change it directly', async () => {
  const sam = as('sam');
  await useCode(sam, 'sam', 'DRAFT234', 'draft1');
  await assertSucceeds(getDoc(doc(sam, 'spots', 'draft1')));
  await assertFails(updateDoc(doc(sam, 'spots', 'draft1'), { deal: 'Free coffee' }));
  await assertFails(updateDoc(doc(sam, 'spots', 'draft1'), { published: true }));
  // Someone else still can't read the draft.
  await assertFails(getDoc(doc(as('tom'), 'spots', 'draft1')));
});

test('owner links are private to the owner and admins', async () => {
  await assertSucceeds(getDoc(doc(as('olly'), 'shopOwners', 'olly')));
  await assertSucceeds(getDoc(doc(as('eve'), 'shopOwners', 'olly')));
  await assertFails(getDoc(doc(as('sam'), 'shopOwners', 'olly')));
  await assertFails(updateDoc(doc(as('olly'), 'shopOwners', 'olly'), { place: 'cafe1' }));
  await assertSucceeds(deleteDoc(doc(as('olly'), 'shopOwners', 'olly')));
});

// ---- Changes waiting for approval ----

test('an owner can send a change for their own place only', async () => {
  const olly = as('olly');
  await assertSucceeds(setDoc(doc(olly, 'spotChanges', 'pub1'), change('olly', 'pub1')));
  await assertSucceeds(getDoc(doc(olly, 'spotChanges', 'pub1')));
  // Not for another place, and not by someone who isn't an owner.
  await assertFails(setDoc(doc(olly, 'spotChanges', 'cafe1'), change('olly', 'cafe1')));
  await assertFails(setDoc(doc(as('sam'), 'spotChanges', 'cafe1'), change('sam', 'cafe1')));
  await assertFails(getDoc(doc(as('sam'), 'spotChanges', 'pub1')));
});

test('a change can\'t approve itself or carry anything else', async () => {
  const olly = as('olly');
  await assertFails(setDoc(doc(olly, 'spotChanges', 'pub1'), change('olly', 'pub1', { status: 'approved' })));
  await assertFails(setDoc(doc(olly, 'spotChanges', 'pub1'), change('olly', 'pub1', { published: true })));
  await assertFails(setDoc(doc(olly, 'spotChanges', 'pub1'), change('olly', 'pub1', { name: 'Better name' })));
  await assertFails(setDoc(doc(olly, 'spotChanges', 'pub1'), change('olly', 'pub1', { link: 'javascript:alert(1)' })));
  await assertFails(setDoc(doc(olly, 'spotChanges', 'pub1'), change('olly', 'pub1', { deal: 'x'.repeat(121) })));
  await assertFails(setDoc(doc(olly, 'spotChanges', 'pub1'), change('olly', 'pub1', { by: 'sam' })));
  await setDoc(doc(olly, 'spotChanges', 'pub1'), change('olly', 'pub1'));
  await assertFails(updateDoc(doc(olly, 'spotChanges', 'pub1'), { status: 'approved' }));
});

test('admins see waiting changes and approve them onto the card', async () => {
  await setDoc(doc(as('olly'), 'spotChanges', 'pub1'), change('olly', 'pub1'));
  const eve = as('eve');
  const waiting = await assertSucceeds(getDocs(query(collection(eve, 'spotChanges'), where('status', '==', 'waiting'), limit(50))));
  if (waiting.size !== 1) throw new Error(`expected 1 change, got ${waiting.size}`);
  const batch = writeBatch(eve);
  batch.update(doc(eve, 'spots', 'pub1'), { line: 'Coffee', deal: '20% off', dealEnds: null, hours: 'Mon–Fri 8–6', link: 'https://flatwhite.example/', menu: '' });
  batch.update(doc(eve, 'spotChanges', 'pub1'), { status: 'approved' });
  await assertSucceeds(batch.commit());
  // Students can't list changes.
  await assertFails(getDocs(query(collection(as('sam'), 'spotChanges'), where('status', '==', 'waiting'), limit(50))));
  // An admin only changes the status, nothing else.
  await assertFails(updateDoc(doc(eve, 'spotChanges', 'pub1'), { deal: 'Changed' }));
});

test('the owner can withdraw their change', async () => {
  await setDoc(doc(as('olly'), 'spotChanges', 'pub1'), change('olly', 'pub1'));
  await assertFails(deleteDoc(doc(as('sam'), 'spotChanges', 'pub1')));
  await assertSucceeds(deleteDoc(doc(as('olly'), 'spotChanges', 'pub1')));
});

// ---- Asking to be listed ----

const request = (uid, extra = {}) => ({
  by: uid, kind: 'cafe', name: 'Bean There', address: '1 Saddler St', contact: '07700 900000',
  line: 'Coffee', deal: '', dealEnds: null, hours: '', link: '', menu: '', status: 'waiting', at: serverTimestamp(), ...extra,
});

test('a business can ask to be listed, and only they and admins see it', async () => {
  await assertSucceeds(setDoc(doc(as('sam'), 'spotRequests', 'sam'), request('sam')));
  await assertSucceeds(getDoc(doc(as('sam'), 'spotRequests', 'sam')));
  await assertSucceeds(getDoc(doc(as('eve'), 'spotRequests', 'sam')));
  await assertFails(getDoc(doc(as('tom'), 'spotRequests', 'sam')));
  await assertFails(setDoc(doc(as('tom'), 'spotRequests', 'sam'), request('sam')));
  await assertFails(setDoc(doc(as('sam'), 'spotRequests', 'sam'), request('sam', { status: 'approved' })));
  await assertFails(setDoc(doc(as('sam'), 'spotRequests', 'sam'), request('sam', { kind: 'casino' })));
  await assertFails(setDoc(doc(as('sam'), 'spotRequests', 'sam'), request('sam', { contact: '' })));
  await assertFails(setDoc(doc(nobody(), 'spotRequests', 'sam'), request('sam')));
  await assertSucceeds(deleteDoc(doc(as('sam'), 'spotRequests', 'sam')));
});

test('an admin approves a request: a new place, owned by the business', async () => {
  await setDoc(doc(as('sam'), 'spotRequests', 'sam'), request('sam'));
  const eve = as('eve');
  const batch = writeBatch(eve);
  batch.set(doc(eve, 'spots', 'new1'), { published: true, kind: 'cafe', name: 'Bean There', address: '1 Saddler St', order: 50, line: 'Coffee', deal: '', dealEnds: null, hours: '', link: '', menu: '' });
  batch.set(doc(eve, 'shopOwners', 'sam'), { place: 'new1', code: '', at: Date.now() });
  batch.update(doc(eve, 'spotRequests', 'sam'), { status: 'approved' });
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(as('sam'), 'shopOwners', 'sam')));
  // Not for anyone else.
  await assertFails(setDoc(doc(as('sam'), 'spots', 'new2'), { published: true, kind: 'cafe', name: 'Mine' }));
});

// ---- The weekly counts ----

test('anyone can add one to a place\'s count, signed in or not', async () => {
  for (const db of [nobody(), as('sam')]) {
    await assertSucceeds(setDoc(doc(db, 'spotStats', `cafe1_${WEEK}`), { place: 'cafe1', week: WEEK, seen: increment(1) }, { merge: true }));
    await assertSucceeds(setDoc(doc(db, 'spotStats', `cafe1_${WEEK}`), { place: 'cafe1', week: WEEK, taps: increment(1) }, { merge: true }));
  }
  let snap;
  await env.withSecurityRulesDisabled(async (ctx) => { snap = await getDoc(doc(ctx.firestore(), 'spotStats', `cafe1_${WEEK}`)); });
  if (snap.data().seen !== 2 || snap.data().taps !== 2) throw new Error(`unexpected counts ${JSON.stringify(snap.data())}`);
});

test('counts only go up by one, only for real places, and carry nothing else', async () => {
  const db = nobody();
  await assertFails(setDoc(doc(db, 'spotStats', `cafe1_${WEEK}`), { place: 'cafe1', week: WEEK, seen: 500 }));
  await assertFails(setDoc(doc(db, 'spotStats', `nowhere_${WEEK}`), { place: 'nowhere', week: WEEK, seen: increment(1) }, { merge: true }));
  await assertFails(setDoc(doc(db, 'spotStats', `pub1_${WEEK}`), { place: 'cafe1', week: WEEK, seen: increment(1) }, { merge: true }));
  await assertFails(setDoc(doc(db, 'spotStats', `cafe1_${WEEK}`), { place: 'cafe1', week: WEEK, seen: increment(1), who: 'sam' }, { merge: true }));
  await setDoc(doc(db, 'spotStats', `cafe1_${WEEK}`), { place: 'cafe1', week: WEEK, seen: increment(1) }, { merge: true });
  await assertFails(setDoc(doc(db, 'spotStats', `cafe1_${WEEK}`), { place: 'cafe1', week: WEEK, seen: increment(10) }, { merge: true }));
  await assertFails(setDoc(doc(db, 'spotStats', `cafe1_${WEEK}`), { place: 'cafe1', week: WEEK, seen: 0 }, { merge: true }));
  await assertFails(deleteDoc(doc(db, 'spotStats', `cafe1_${WEEK}`)));
});

test('only the place\'s owner and admins can read its counts', async () => {
  await setDoc(doc(nobody(), 'spotStats', `pub1_${WEEK}`), { place: 'pub1', week: WEEK, seen: increment(1) }, { merge: true });
  await assertSucceeds(getDoc(doc(as('olly'), 'spotStats', `pub1_${WEEK}`)));
  // Even a week with no counts yet.
  await assertSucceeds(getDoc(doc(as('olly'), 'spotStats', `pub1_2026-11-02`)));
  await assertSucceeds(getDoc(doc(as('eve'), 'spotStats', `pub1_${WEEK}`)));
  await assertFails(getDoc(doc(as('sam'), 'spotStats', `pub1_${WEEK}`)));
  await assertFails(getDoc(doc(nobody(), 'spotStats', `pub1_${WEEK}`)));
});
