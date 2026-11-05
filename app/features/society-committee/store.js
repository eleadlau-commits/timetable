// Everything society committees keep in the online database, in one place. Each function gets
// the database (from the account service) and does one job. The database's rules
// (firebase/firestore.rules) check every step again, so a changed app can't do more.
// These mirror the shop feature's store.js, with their own collections:
//
//   societies/{id}             the society's card, typed in by the team (the societies feature)
//   societyCodes/{code}        { society, usedBy (uid or null), made }: a code the team hands to a
//                              committee member (one per person)
//   societyOwners/{uid}        { society, code, at }: the society this account helps run
//   societyChanges/{society}   { society, by, line, meets, fee, instagram, join, status, at }: a
//                              committee's change, 'waiting' until approved or rejected
//   societyStats/{society}_{week}  { society, week, seen, taps }: how many phones showed the
//                              society, and tapped Instagram or Join, that week (nobody's name)

import { KEYS } from './rules.js';

const toMs = (value) => (value && typeof value.toMillis === 'function' ? value.toMillis() : Number.isFinite(value) ? value : null);

function read(snap) {
  if (!snap.exists) return null;
  const data = snap.data();
  return { id: snap.id, ...data, at: toMs(data.at) };
}

// The card's fields, ready to store.
function cardFields(change) {
  return Object.fromEntries(KEYS.map((key) => [key, String(change?.[key] || '')]));
}

// The society this account helps run ({ society, code }), or null.
export async function ownerOf(db, uid) {
  const snap = await db.doc(`societyOwners/${uid}`).get();
  return snap.exists ? snap.data() : null;
}

// The society as stored (even if it isn't published yet), or null.
export async function societyDoc(db, id) {
  const snap = await db.doc(`societies/${id}`).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

// Uses a society code: marks it used by this account and links the account to its society.
// Fails with Error('bad-code') or Error('used-code').
export async function useCode(db, uid, code) {
  let snap;
  try {
    snap = await db.doc(`societyCodes/${code}`).get();
  } catch {
    throw new Error('bad-code');
  }
  if (!snap.exists) throw new Error('bad-code');
  const { society, usedBy } = snap.data();
  if (usedBy && usedBy !== uid) throw new Error('used-code');
  const batch = db.batch();
  if (!usedBy) batch.update(db.doc(`societyCodes/${code}`), { usedBy: uid });
  batch.set(db.doc(`societyOwners/${uid}`), { society, code, at: Date.now() });
  await batch.commit();
  return { society, code };
}

// Stops looking after the society: the link, and the code it used (so nobody else can use it).
export async function leave(db, uid, owner) {
  if (owner?.code) await db.doc(`societyCodes/${owner.code}`).delete().catch(() => {});
  await db.doc(`societyOwners/${uid}`).delete();
}

export async function changeOf(db, society) {
  return read(await db.doc(`societyChanges/${society}`).get());
}

export async function sendChange(db, fields, uid, society, change) {
  await db.doc(`societyChanges/${society}`).set({
    society, by: uid, ...cardFields(change), status: 'waiting', at: fields.serverTimestamp(),
  });
}

export async function withdrawChange(db, society) {
  await db.doc(`societyChanges/${society}`).delete();
}

// The counts for these weeks: [{ week, seen, taps }].
export async function stats(db, society, weeks) {
  const out = [];
  for (const week of weeks) {
    const snap = await db.doc(`societyStats/${society}_${week}`).get().catch(() => null);
    const data = snap?.exists ? snap.data() : {};
    out.push({ week, seen: data.seen || 0, taps: data.taps || 0 });
  }
  return out;
}

// Adds one to a society's count for the week ('seen' or 'taps'). Works signed out too.
export async function count(db, fields, society, week, kind) {
  await db.doc(`societyStats/${society}_${week}`).set({ society, week, [kind]: fields.increment(1) }, { merge: true });
}

// Delete my account: the change this person sent (if it's still theirs) and the code they used.
// Their link (societyOwners) is in the account's own list.
export async function removeAll(db, uid) {
  const owner = await ownerOf(db, uid).catch(() => null);
  if (!owner) return;
  const change = await changeOf(db, owner.society).catch(() => null);
  if (change?.by === uid) await db.doc(`societyChanges/${owner.society}`).delete().catch(() => {});
  if (owner.code) await db.doc(`societyCodes/${owner.code}`).delete().catch(() => {});
}

// ---- For the people who approve (admins) ----

export async function waiting(db) {
  const snap = await db.collection('societyChanges').where('status', '==', 'waiting').limit(50).get();
  return snap.docs.map(read);
}

export async function approveChange(db, change) {
  const batch = db.batch();
  batch.update(db.doc(`societies/${change.society}`), cardFields(change));
  batch.update(db.doc(`societyChanges/${change.society}`), { status: 'approved' });
  await batch.commit();
}

export async function rejectChange(db, change) {
  await db.doc(`societyChanges/${change.society}`).update({ status: 'rejected' });
}

// Every society, drafts too, for making codes and comparing changes: [{ id, name, published, …the card }].
export async function allSocieties(db) {
  const snap = await db.collection('societies').limit(300).get();
  return snap.docs.map((d) => ({ ...d.data(), id: d.id, name: String(d.data().name || d.id), published: d.data().published === true }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function codes(db) {
  const snap = await db.collection('societyCodes').limit(200).get();
  return snap.docs.map((d) => ({ code: d.id, society: d.data().society, used: !!d.data().usedBy, usedBy: d.data().usedBy || null, made: toMs(d.data().made) }))
    .sort((a, b) => (b.made || 0) - (a.made || 0));
}

export async function addCode(db, fields, code, society) {
  await db.doc(`societyCodes/${code}`).set({ society, usedBy: null, made: fields.serverTimestamp() });
}

// Deletes a code. For a used one, the person who used it stops looking after the society too
// (if it's still the society the code was for), e.g. when they leave the committee.
export async function removeCode(db, code) {
  const batch = db.batch();
  if (code.usedBy) {
    const owner = await ownerOf(db, code.usedBy).catch(() => null);
    if (owner?.society === code.society) batch.delete(db.doc(`societyOwners/${code.usedBy}`));
  }
  batch.delete(db.doc(`societyCodes/${code.code}`));
  await batch.commit();
}
