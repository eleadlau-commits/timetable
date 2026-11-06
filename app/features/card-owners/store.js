// The online database steps that shops and societies share, written once. Each kind of card
// says where its things are kept, and gets back the same set of steps:
//
//   makeStore({
//     cards: 'spots',          the cards themselves (typed in by the team)
//     codes: 'shopCodes',      {code}: { <link>, usedBy (uid or null), made }
//     owners: 'shopOwners',    {uid}: { <link>, code, at }: the card this account looks after
//     changes: 'spotChanges',  {card}: { <link>, by, …the card's fields, status, at }: a change
//                              waiting for approval ('waiting', then 'approved' or 'rejected')
//     stats: 'spotStats',      {card}_{week}: { <link>, week, seen, taps } (nobody's name)
//     link: 'place',           the name each of those uses for the card's id
//     toStore(change),         the card's fields, ready to store
//     fromStore(data),         a card or change as stored → as the app uses it (optional)
//     most: 200,               how many cards Approve changes asks for at once
//     removeUsed: false,       whether the team can delete a used code (which also unlinks the
//                              person who used it)
//   })
//
// Each step gets the database (from the account service) and does one job. The database's rules
// (firebase/firestore.rules) check every step again, so a changed app can't do more. The names
// stay exactly as they were before this was shared, so nothing stored has to move.

const toMs = (value) => (value && typeof value.toMillis === 'function' ? value.toMillis() : Number.isFinite(value) ? value : null);

export { toMs };

// Whether this account approves changes: made by hand in the Firebase console (admins/{uid}).
export async function isAdmin(db, uid) {
  const snap = await db.doc(`admins/${uid}`).get();
  return snap.exists;
}

export function makeStore(config) {
  const { cards, codes, owners, changes, stats, link, toStore } = config;
  const fromStore = config.fromStore || ((data) => data);
  const most = config.most || 200;

  // A change as stored → the same with `at` in ms.
  const read = (snap) => {
    if (!snap.exists) return null;
    const data = snap.data();
    return { id: snap.id, ...fromStore(data), at: toMs(data.at) };
  };

  const store = {
    config,

    // The card this account looks after ({ <link>, code, at }), or null.
    async ownerOf(db, uid) {
      const snap = await db.doc(`${owners}/${uid}`).get();
      return snap.exists ? snap.data() : null;
    },

    // The card as stored (even if it isn't published yet), or null.
    async cardDoc(db, id) {
      const snap = await db.doc(`${cards}/${id}`).get();
      return snap.exists ? { id: snap.id, ...fromStore(snap.data()) } : null;
    },

    // Uses a code: marks it used by this account and links the account to its card. Fails with
    // Error('bad-code') for a code that doesn't exist, or Error('used-code') if someone else has
    // used it.
    async useCode(db, uid, code) {
      let snap;
      try {
        snap = await db.doc(`${codes}/${code}`).get();
      } catch {
        throw new Error('bad-code');
      }
      if (!snap.exists) throw new Error('bad-code');
      const data = snap.data();
      const id = data[link];
      if (data.usedBy && data.usedBy !== uid) throw new Error('used-code');
      const batch = db.batch();
      if (!data.usedBy) batch.update(db.doc(`${codes}/${code}`), { usedBy: uid });
      batch.set(db.doc(`${owners}/${uid}`), { [link]: id, code, at: Date.now() });
      await batch.commit();
      return { [link]: id, code };
    },

    // Stops looking after the card: the link, and the code it used (so nobody else can use it).
    async leave(db, uid, owner) {
      if (owner?.code) await db.doc(`${codes}/${owner.code}`).delete().catch(() => {});
      await db.doc(`${owners}/${uid}`).delete();
    },

    async changeOf(db, id) {
      return read(await db.doc(`${changes}/${id}`).get());
    },

    async sendChange(db, fields, uid, id, change) {
      await db.doc(`${changes}/${id}`).set({
        [link]: id, by: uid, ...toStore(change), status: 'waiting', at: fields.serverTimestamp(),
      });
    },

    async withdrawChange(db, id) {
      await db.doc(`${changes}/${id}`).delete();
    },

    // The counts for these weeks: [{ week, seen, taps }].
    async stats(db, id, weeks) {
      const out = [];
      for (const week of weeks) {
        const snap = await db.doc(`${stats}/${id}_${week}`).get().catch(() => null);
        const data = snap?.exists ? snap.data() : {};
        out.push({ week, seen: data.seen || 0, taps: data.taps || 0 });
      }
      return out;
    },

    // Adds one to a card's count for the week ('seen' or 'taps'). Works signed out too.
    async count(db, fields, id, week, kind) {
      await db.doc(`${stats}/${id}_${week}`).set({ [link]: id, week, [kind]: fields.increment(1) }, { merge: true });
    },

    // Delete my account: the change this person sent (if it's still theirs) and the code they
    // used. Their link (owners) is in the account's own list.
    async removeAll(db, uid) {
      const owner = await store.ownerOf(db, uid).catch(() => null);
      if (!owner) return;
      const change = await store.changeOf(db, owner[link]).catch(() => null);
      if (change?.by === uid) await db.doc(`${changes}/${owner[link]}`).delete().catch(() => {});
      if (owner.code) await db.doc(`${codes}/${owner.code}`).delete().catch(() => {});
    },

    // ---- For the people who approve (admins) ----

    async waiting(db) {
      const snap = await db.collection(changes).where('status', '==', 'waiting').limit(50).get();
      return snap.docs.map(read);
    },

    async approveChange(db, change) {
      const batch = db.batch();
      batch.update(db.doc(`${cards}/${change[link]}`), toStore(change));
      batch.update(db.doc(`${changes}/${change[link]}`), { status: 'approved' });
      await batch.commit();
    },

    async rejectChange(db, change) {
      await db.doc(`${changes}/${change[link]}`).update({ status: 'rejected' });
    },

    // Every card, drafts too, for making codes and comparing changes: [{ id, name, published,
    // …the card }], by name.
    async allCards(db) {
      const snap = await db.collection(cards).limit(most).get();
      return snap.docs.map((d) => ({ ...fromStore(d.data()), id: d.id, name: String(d.data().name || d.id), published: d.data().published === true }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    // The codes made so far, newest first: [{ code, card, used, usedBy, made }].
    async codes(db) {
      const snap = await db.collection(codes).limit(200).get();
      return snap.docs.map((d) => ({ code: d.id, card: d.data()[link], used: !!d.data().usedBy, usedBy: d.data().usedBy || null, made: toMs(d.data().made) }))
        .sort((a, b) => (b.made || 0) - (a.made || 0));
    },

    async addCode(db, fields, code, id) {
      await db.doc(`${codes}/${code}`).set({ [link]: id, usedBy: null, made: fields.serverTimestamp() });
    },

    // Deletes a code ({ code, card, usedBy }). Where used codes can be removed, the person who
    // used it stops looking after the card too (if it's still the card the code was for), e.g.
    // when they leave a society's committee.
    async removeCode(db, code) {
      const batch = db.batch();
      if (config.removeUsed && code.usedBy) {
        const owner = await store.ownerOf(db, code.usedBy).catch(() => null);
        if (owner?.[link] === code.card) batch.delete(db.doc(`${owners}/${code.usedBy}`));
      }
      batch.delete(db.doc(`${codes}/${code.code}`));
      await batch.commit();
    },
  };
  return store;
}
