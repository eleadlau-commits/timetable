// Everything the shop feature keeps in the online database, in one place. Each function gets
// the database (from the account service) and does one job. The database's rules
// (firebase/firestore.rules) check every step again, so a changed app can't do more.
//
//   admins/{uid}          made by hand in the Firebase console: who may approve changes
//   shopCodes/{code}      { place, usedBy (uid or null), made }: a code the team hands to a shop
//   shopOwners/{uid}      { place, code, at }: the place this account looks after
//   spotChanges/{place}   { place, by, line, deal, dealEnds, hours, link, menu, status, at }: an
//                         owner's change, 'waiting' until approved ('approved') or rejected
//   spotRequests/{uid}    { by, kind, name, address, contact, …the card, status, at }: a business
//                         asking to be listed
//   spotStats/{place}_{week}  { place, week, seen, taps }: how many phones saw the card, and
//                         tapped its Website or Menu, that week (nobody's name or number)

import { KEYS } from './rules.js';

const toMs = (value) => (value && typeof value.toMillis === 'function' ? value.toMillis() : Number.isFinite(value) ? value : null);
const toDate = (ms) => (Number.isFinite(ms) ? new Date(ms) : null);

// A change or request as stored → the same with dealEnds in ms and at in ms.
function read(snap) {
  if (!snap.exists) return null;
  const data = snap.data();
  return { id: snap.id, ...data, dealEnds: toMs(data.dealEnds), at: toMs(data.at) };
}

// The card's fields, ready to store (dealEnds as a date).
function cardFields(change) {
  const out = {};
  for (const key of KEYS) out[key] = key === 'dealEnds' ? toDate(change[key]) : (change[key] || '');
  return out;
}

export async function isAdmin(db, uid) {
  const snap = await db.doc(`admins/${uid}`).get();
  return snap.exists;
}

// The place this account looks after ({ place, code }), or null.
export async function ownerOf(db, uid) {
  const snap = await db.doc(`shopOwners/${uid}`).get();
  return snap.exists ? snap.data() : null;
}

// The place itself, as stored (even if it isn't published yet).
export async function placeDoc(db, place) {
  const snap = await db.doc(`spots/${place}`).get();
  return snap.exists ? { id: snap.id, ...snap.data(), dealEnds: toMs(snap.data().dealEnds) } : null;
}

// Uses a shop code: marks it used by this account and links the account to its place. Fails
// with Error('bad-code') for a code that doesn't exist or someone else has used.
export async function useCode(db, uid, code) {
  let snap;
  try {
    snap = await db.doc(`shopCodes/${code}`).get();
  } catch {
    throw new Error('bad-code');
  }
  if (!snap.exists) throw new Error('bad-code');
  const { place, usedBy } = snap.data();
  if (usedBy && usedBy !== uid) throw new Error('used-code');
  const batch = db.batch();
  if (!usedBy) batch.update(db.doc(`shopCodes/${code}`), { usedBy: uid });
  batch.set(db.doc(`shopOwners/${uid}`), { place, code, at: Date.now() });
  await batch.commit();
  return { place, code };
}

export async function changeOf(db, place) {
  return read(await db.doc(`spotChanges/${place}`).get());
}

export async function sendChange(db, fields, uid, place, change) {
  await db.doc(`spotChanges/${place}`).set({
    place, by: uid, ...cardFields(change), status: 'waiting', at: fields.serverTimestamp(),
  });
}

export async function withdrawChange(db, place) {
  await db.doc(`spotChanges/${place}`).delete();
}

export async function requestOf(db, uid) {
  return read(await db.doc(`spotRequests/${uid}`).get());
}

export async function sendRequest(db, fields, uid, request) {
  await db.doc(`spotRequests/${uid}`).set({
    by: uid, kind: request.kind, name: request.name, address: request.address, contact: request.contact,
    ...cardFields(request), status: 'waiting', at: fields.serverTimestamp(),
  });
}

export async function withdrawRequest(db, uid) {
  await db.doc(`spotRequests/${uid}`).delete();
}

// This week's and last week's counts for a place: { seen, taps } each.
export async function stats(db, place, weeks) {
  const out = [];
  for (const week of weeks) {
    const snap = await db.doc(`spotStats/${place}_${week}`).get().catch(() => null);
    const data = snap?.exists ? snap.data() : {};
    out.push({ week, seen: data.seen || 0, taps: data.taps || 0 });
  }
  return out;
}

// Adds one to a place's count for the week ('seen' or 'taps'). Works signed out too.
export async function count(db, fields, place, week, kind) {
  await db.doc(`spotStats/${place}_${week}`).set({ place, week, [kind]: fields.increment(1) }, { merge: true });
}

// Delete my account: the owner's waiting change and the code they used (their own areas,
// shopOwners and spotRequests, are in the account's own list).
export async function removeAll(db, uid) {
  const owner = await ownerOf(db, uid).catch(() => null);
  if (!owner) return;
  await db.doc(`spotChanges/${owner.place}`).delete().catch(() => {});
  if (owner.code) await db.doc(`shopCodes/${owner.code}`).delete().catch(() => {});
}

// ---- For the people who approve (admins) ----

export async function waiting(db) {
  const [changes, requests] = await Promise.all([
    db.collection('spotChanges').where('status', '==', 'waiting').limit(50).get(),
    db.collection('spotRequests').where('status', '==', 'waiting').limit(50).get(),
  ]);
  return { changes: changes.docs.map(read), requests: requests.docs.map(read) };
}

export async function approveChange(db, change) {
  const batch = db.batch();
  batch.update(db.doc(`spots/${change.place}`), cardFields(change));
  batch.update(db.doc(`spotChanges/${change.place}`), { status: 'approved' });
  await batch.commit();
}

export async function rejectChange(db, change) {
  await db.doc(`spotChanges/${change.place}`).update({ status: 'rejected' });
}

// A new place on Spots from a request, published, with the business as its owner.
export async function approveRequest(db, request) {
  const place = db.collection('spots').doc();
  const batch = db.batch();
  batch.set(place, {
    published: true, kind: request.kind, name: request.name, address: request.address || '', order: 50, ...cardFields(request),
  });
  batch.set(db.doc(`shopOwners/${request.by}`), { place: place.id, code: '', at: Date.now() });
  batch.update(db.doc(`spotRequests/${request.by}`), { status: 'approved' });
  await batch.commit();
}

export async function rejectRequest(db, request) {
  await db.doc(`spotRequests/${request.by}`).update({ status: 'rejected' });
}

// Every place, drafts too, for making codes: [{ id, name }].
export async function allPlaces(db) {
  const snap = await db.collection('spots').limit(200).get();
  return snap.docs.map((d) => ({ id: d.id, name: String(d.data().name || d.id), published: d.data().published === true }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function codes(db) {
  const snap = await db.collection('shopCodes').limit(200).get();
  return snap.docs.map((d) => ({ code: d.id, place: d.data().place, used: !!d.data().usedBy, made: toMs(d.data().made) }))
    .sort((a, b) => (b.made || 0) - (a.made || 0));
}

export async function addCode(db, fields, code, place) {
  await db.doc(`shopCodes/${code}`).set({ place, usedBy: null, made: fields.serverTimestamp() });
}

export async function removeCode(db, code) {
  await db.doc(`shopCodes/${code}`).delete();
}
