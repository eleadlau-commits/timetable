// Tests for society committees in firestore.rules: society codes, who helps run which society,
// their changes waiting for approval, the weekly counts, and the team (admins) who approve.
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

const HIKING = { published: true, type: 'sport', name: 'Hiking Society', instagram: '@durhamhiking' };
const CHOIR = { published: true, type: 'arts', name: 'Choral Society' };
const DRAFT = { published: false, type: 'other', name: 'Not ready yet' };
const WEEK = '2026-11-02';

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
    await setDoc(doc(db, 'societies', 'hiking'), HIKING);
    await setDoc(doc(db, 'societies', 'choir'), CHOIR);
    await setDoc(doc(db, 'societies', 'draft'), DRAFT);
    await setDoc(doc(db, 'admins', 'eve'), {});
    await setDoc(doc(db, 'societyCodes', 'K7QM2XPA'), { society: 'hiking', usedBy: null, made: new Date() });
    await setDoc(doc(db, 'societyCodes', 'CHQRS234'), { society: 'choir', usedBy: null, made: new Date() });
    await setDoc(doc(db, 'societyCodes', 'DRAFT234'), { society: 'draft', usedBy: null, made: new Date() });
    // A shop code, for a café: it's no good for a society.
    await setDoc(doc(db, 'shopCodes', 'SHPPSHP2'), { place: 'cafe1', usedBy: null, made: new Date() });
    // Cleo already helps run the choir.
    await setDoc(doc(db, 'societyCodes', 'CLEMCLE2'), { society: 'choir', usedBy: 'cleo', made: new Date() });
    await setDoc(doc(db, 'societyOwners', 'cleo'), { society: 'choir', code: 'CLEMCLE2', at: 1 });
  });
});
after(() => env.cleanup());

// Using a code, as the app does: mark it used and link the account, in one step.
async function useCode(db, uid, code, society) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'societyCodes', code), { usedBy: uid });
  batch.set(doc(db, 'societyOwners', uid), { society, code, at: Date.now() });
  return batch.commit();
}

const change = (uid, society, extra = {}) => ({
  society, by: uid, line: 'Big choir, big concerts', meets: 'Wednesdays 7pm, Elvet Riverside', fee: 'Free',
  instagram: 'https://www.instagram.com/durhamchoir/', join: 'https://join.example/choir', status: 'waiting', at: serverTimestamp(), ...extra,
});

// ---- Society codes ----

test('a society code links your account to its society, once', async () => {
  const sam = as('sam');
  await assertSucceeds(getDoc(doc(sam, 'societyCodes', 'K7QM2XPA')));
  await assertSucceeds(useCode(sam, 'sam', 'K7QM2XPA', 'hiking'));
  await assertSucceeds(getDoc(doc(sam, 'societyOwners', 'sam')));
  await assertFails(useCode(as('tom'), 'tom', 'K7QM2XPA', 'hiking'));
});

test('a code only links to its own society, and shop codes don\'t work', async () => {
  await assertFails(useCode(as('sam'), 'sam', 'K7QM2XPA', 'choir'));
  await assertFails(setDoc(doc(as('sam'), 'societyOwners', 'sam'), { society: 'hiking', code: 'K7QM2XPA', at: 1 }));
  await assertFails(setDoc(doc(as('sam'), 'societyOwners', 'sam'), { society: 'cafe1', code: 'SHPPSHP2', at: 1 }));
  // Nobody can link someone else.
  await assertFails(useCode(as('sam'), 'tom', 'K7QM2XPA', 'hiking'));
});

test('codes can\'t be listed, and need a confirmed account', async () => {
  await assertFails(getDocs(query(collection(as('sam'), 'societyCodes'), limit(10))));
  await assertFails(getDoc(doc(nobody(), 'societyCodes', 'K7QM2XPA')));
  await assertFails(useCode(as('una', unconfirmed), 'una', 'K7QM2XPA', 'hiking'));
});

test('only admins make codes, and they can list them', async () => {
  const code = { society: 'hiking', usedBy: null, made: serverTimestamp() };
  await assertFails(setDoc(doc(as('sam'), 'societyCodes', 'ABCD2345'), code));
  await assertSucceeds(setDoc(doc(as('eve'), 'societyCodes', 'ABCD2345'), code));
  await assertFails(setDoc(doc(as('eve'), 'societyCodes', 'not-a-code'), code));
  await assertFails(setDoc(doc(as('eve'), 'societyCodes', 'WXYZ2345'), { ...code, usedBy: 'sam' }));
  await assertSucceeds(getDocs(query(collection(as('eve'), 'societyCodes'), limit(200))));
});

test('you can switch to another society with a new code, and stop', async () => {
  const sam = as('sam');
  await useCode(sam, 'sam', 'K7QM2XPA', 'hiking');
  await assertSucceeds(useCode(sam, 'sam', 'CHQRS234', 'choir'));
  // Stopping: the code you used, then the link.
  await assertFails(deleteDoc(doc(as('tom'), 'societyCodes', 'CHQRS234')));
  await assertSucceeds(deleteDoc(doc(sam, 'societyCodes', 'CHQRS234')));
  await assertSucceeds(deleteDoc(doc(sam, 'societyOwners', 'sam')));
});

test('the team can remove a committee member', async () => {
  const eve = as('eve');
  await assertSucceeds(getDoc(doc(eve, 'societyOwners', 'cleo')));
  const batch = writeBatch(eve);
  batch.delete(doc(eve, 'societyOwners', 'cleo'));
  batch.delete(doc(eve, 'societyCodes', 'CLEMCLE2'));
  await assertSucceeds(batch.commit());
  // Others can't.
  await assertFails(deleteDoc(doc(as('sam'), 'societyOwners', 'cleo')));
});

// ---- Committees and their societies ----

test('links are private, and a committee reads its own society, even a draft, but can\'t change it', async () => {
  await assertSucceeds(getDoc(doc(as('cleo'), 'societyOwners', 'cleo')));
  await assertFails(getDoc(doc(as('sam'), 'societyOwners', 'cleo')));
  await assertFails(updateDoc(doc(as('cleo'), 'societyOwners', 'cleo'), { society: 'hiking' }));
  const sam = as('sam');
  await useCode(sam, 'sam', 'DRAFT234', 'draft');
  await assertSucceeds(getDoc(doc(sam, 'societies', 'draft')));
  await assertFails(updateDoc(doc(sam, 'societies', 'draft'), { line: 'Changed' }));
  await assertFails(updateDoc(doc(sam, 'societies', 'draft'), { published: true }));
  await assertFails(getDoc(doc(as('tom'), 'societies', 'draft')));
});

// ---- Changes waiting for approval ----

test('a committee can send a change for its own society only', async () => {
  const cleo = as('cleo');
  await assertSucceeds(setDoc(doc(cleo, 'societyChanges', 'choir'), change('cleo', 'choir')));
  await assertSucceeds(getDoc(doc(cleo, 'societyChanges', 'choir')));
  await assertFails(setDoc(doc(cleo, 'societyChanges', 'hiking'), change('cleo', 'hiking')));
  await assertFails(setDoc(doc(as('sam'), 'societyChanges', 'choir'), change('sam', 'choir')));
  await assertFails(getDoc(doc(as('sam'), 'societyChanges', 'choir')));
  // Another committee member can see and replace it.
  const sam = as('sam');
  await useCode(sam, 'sam', 'CHQRS234', 'choir');
  await assertSucceeds(getDoc(doc(sam, 'societyChanges', 'choir')));
  await assertSucceeds(setDoc(doc(sam, 'societyChanges', 'choir'), change('sam', 'choir', { fee: '£2' })));
});

test('a change can\'t approve itself or carry anything else', async () => {
  const cleo = as('cleo');
  await assertFails(setDoc(doc(cleo, 'societyChanges', 'choir'), change('cleo', 'choir', { status: 'approved' })));
  await assertFails(setDoc(doc(cleo, 'societyChanges', 'choir'), change('cleo', 'choir', { published: true })));
  await assertFails(setDoc(doc(cleo, 'societyChanges', 'choir'), change('cleo', 'choir', { name: 'Better name' })));
  await assertFails(setDoc(doc(cleo, 'societyChanges', 'choir'), change('cleo', 'choir', { photo: 'https://x.example/a.jpg' })));
  await assertFails(setDoc(doc(cleo, 'societyChanges', 'choir'), change('cleo', 'choir', { join: 'javascript:alert(1)' })));
  await assertFails(setDoc(doc(cleo, 'societyChanges', 'choir'), change('cleo', 'choir', { instagram: '@durhamchoir' })));
  await assertFails(setDoc(doc(cleo, 'societyChanges', 'choir'), change('cleo', 'choir', { line: 'x'.repeat(141) })));
  await assertFails(setDoc(doc(cleo, 'societyChanges', 'choir'), change('cleo', 'choir', { by: 'sam' })));
  await setDoc(doc(cleo, 'societyChanges', 'choir'), change('cleo', 'choir'));
  await assertFails(updateDoc(doc(cleo, 'societyChanges', 'choir'), { status: 'approved' }));
});

test('admins see waiting changes and approve them onto the card', async () => {
  await setDoc(doc(as('cleo'), 'societyChanges', 'choir'), change('cleo', 'choir'));
  const eve = as('eve');
  const waiting = await assertSucceeds(getDocs(query(collection(eve, 'societyChanges'), where('status', '==', 'waiting'), limit(50))));
  if (waiting.size !== 1) throw new Error(`expected 1 change, got ${waiting.size}`);
  // Admins can list every society, drafts too, to make codes.
  const all = await assertSucceeds(getDocs(query(collection(eve, 'societies'), limit(300))));
  if (all.size !== 3) throw new Error(`expected 3 societies, got ${all.size}`);
  const batch = writeBatch(eve);
  batch.update(doc(eve, 'societies', 'choir'), {
    line: 'Big choir, big concerts', meets: 'Wednesdays 7pm', fee: 'Free', instagram: 'https://www.instagram.com/durhamchoir/', join: '',
  });
  batch.update(doc(eve, 'societyChanges', 'choir'), { status: 'approved' });
  await assertSucceeds(batch.commit());
  // Instagram as typed in the console is replaced by its address when a change is approved.
  await assertSucceeds(updateDoc(doc(eve, 'societies', 'hiking'), { line: 'Walks', meets: '', fee: '', instagram: 'https://www.instagram.com/durhamhiking/', join: '' }));
  await assertFails(updateDoc(doc(eve, 'societies', 'hiking'), { join: 'http://not-safe.example' }));
  // Students can't list changes, and an admin only changes the status.
  await assertFails(getDocs(query(collection(as('sam'), 'societyChanges'), where('status', '==', 'waiting'), limit(50))));
  await assertFails(updateDoc(doc(eve, 'societyChanges', 'choir'), { fee: 'Changed' }));
});

test('the committee can withdraw its change', async () => {
  await setDoc(doc(as('cleo'), 'societyChanges', 'choir'), change('cleo', 'choir'));
  await assertFails(deleteDoc(doc(as('sam'), 'societyChanges', 'choir')));
  await assertSucceeds(deleteDoc(doc(as('cleo'), 'societyChanges', 'choir')));
});

// ---- The weekly counts ----

test('anyone can add one to a society\'s count, signed in or not', async () => {
  for (const db of [nobody(), as('sam')]) {
    await assertSucceeds(setDoc(doc(db, 'societyStats', `hiking_${WEEK}`), { society: 'hiking', week: WEEK, seen: increment(1) }, { merge: true }));
    await assertSucceeds(setDoc(doc(db, 'societyStats', `hiking_${WEEK}`), { society: 'hiking', week: WEEK, taps: increment(1) }, { merge: true }));
  }
  let snap;
  await env.withSecurityRulesDisabled(async (ctx) => { snap = await getDoc(doc(ctx.firestore(), 'societyStats', `hiking_${WEEK}`)); });
  if (snap.data().seen !== 2 || snap.data().taps !== 2) throw new Error(`unexpected counts ${JSON.stringify(snap.data())}`);
});

test('counts only go up by one, only for real societies, and carry nothing else', async () => {
  const db = nobody();
  await assertFails(setDoc(doc(db, 'societyStats', `hiking_${WEEK}`), { society: 'hiking', week: WEEK, seen: 500 }));
  await assertFails(setDoc(doc(db, 'societyStats', `nowhere_${WEEK}`), { society: 'nowhere', week: WEEK, seen: increment(1) }, { merge: true }));
  await assertFails(setDoc(doc(db, 'societyStats', `choir_${WEEK}`), { society: 'hiking', week: WEEK, seen: increment(1) }, { merge: true }));
  await assertFails(setDoc(doc(db, 'societyStats', `hiking_${WEEK}`), { society: 'hiking', week: WEEK, seen: increment(1), who: 'sam' }, { merge: true }));
  await setDoc(doc(db, 'societyStats', `hiking_${WEEK}`), { society: 'hiking', week: WEEK, seen: increment(1) }, { merge: true });
  await assertFails(setDoc(doc(db, 'societyStats', `hiking_${WEEK}`), { society: 'hiking', week: WEEK, seen: increment(10) }, { merge: true }));
  await assertFails(deleteDoc(doc(db, 'societyStats', `hiking_${WEEK}`)));
});

test('only the society\'s committee and admins can read its counts', async () => {
  await setDoc(doc(nobody(), 'societyStats', `choir_${WEEK}`), { society: 'choir', week: WEEK, seen: increment(1) }, { merge: true });
  await assertSucceeds(getDoc(doc(as('cleo'), 'societyStats', `choir_${WEEK}`)));
  await assertSucceeds(getDoc(doc(as('cleo'), 'societyStats', 'choir_2026-11-09')));
  await assertSucceeds(getDoc(doc(as('eve'), 'societyStats', `choir_${WEEK}`)));
  await assertFails(getDoc(doc(as('sam'), 'societyStats', `choir_${WEEK}`)));
  await assertFails(getDoc(doc(nobody(), 'societyStats', `choir_${WEEK}`)));
});
