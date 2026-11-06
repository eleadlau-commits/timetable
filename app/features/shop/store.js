// What the shop feature keeps in the online database. The steps shops and societies share
// (codes, owners, changes waiting for approval, the weekly counts) are the card-owners feature's,
// given the names below, which are the ones the database has always used. Asking to be listed
// is the shop's own, so it's here. The database's rules (firebase/firestore.rules) check every
// step again, so a changed app can't do more.
//
//   admins/{uid}          made by hand in the Firebase console: who may approve changes
//   spots/{place}         the places on Spots (the listings feature)
//   shopCodes/{code}      { place, usedBy (uid or null), made }: a code the team hands to a shop
//   shopOwners/{uid}      { place, code, at }: the place this account looks after
//   spotChanges/{place}   { place, by, line, deal, dealEnds, hours, open, link, menu, status, at }:
//                         an owner's change, 'waiting' until approved ('approved') or rejected
//   spotRequests/{uid}    { by, kind, name, address, contact, …the card, status, at }: a business
//                         asking to be listed
//   spotStats/{place}_{week}  { place, week, seen, taps }: how many phones saw the card, and
//                         tapped its Website or Menu, that week (nobody's name or number)

import { KEYS } from './rules.js';

const toMs = (value) => (value && typeof value.toMillis === 'function' ? value.toMillis() : Number.isFinite(value) ? value : null);
const toDate = (ms) => (Number.isFinite(ms) ? new Date(ms) : null);

// The card's fields, ready to store (dealEnds as a date).
export function cardFields(change) {
  const out = {};
  for (const key of KEYS) out[key] = key === 'dealEnds' ? toDate(change[key]) : (change[key] || '');
  return out;
}

// A place or change as stored → with dealEnds in ms.
export function fromStore(data) {
  return { ...data, dealEnds: toMs(data.dealEnds) };
}

// Where the card-owners feature keeps a shop's things (its store(config)).
export const PLACES = {
  cards: 'spots',
  codes: 'shopCodes',
  owners: 'shopOwners',
  changes: 'spotChanges',
  stats: 'spotStats',
  link: 'place',
  toStore: cardFields,
  fromStore,
  most: 200,
  removeUsed: false,
};

// ---- Asking to be listed ----

function read(snap) {
  if (!snap.exists) return null;
  const data = snap.data();
  return { id: snap.id, ...fromStore(data), at: toMs(data.at) };
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

// ---- For the people who approve (admins) ----

export async function waitingRequests(db) {
  const snap = await db.collection('spotRequests').where('status', '==', 'waiting').limit(50).get();
  return snap.docs.map(read);
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
