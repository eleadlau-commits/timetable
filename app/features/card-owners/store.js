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
//     list: 'spots',           lists/{list}: every published card in one document, which
//                              students' phones read instead of each card (see saveList)
//     groupBy: 'town',         the card's field saying which town or university it's for: one
//                              list per town or university (see listName); optional
//     removeUsed: false,       whether the team can delete a used code (which also unlinks the
//                              person who used it)
//   })
//
// Each step gets the database (from the account service) and does one job. The database's rules
// (firebase/firestore.rules) check every step again, so a changed app can't do more. The names
// stay exactly as they were before this was shared, so nothing stored has to move.

const toMs = (value) => (value && typeof value.toMillis === 'function' ? value.toMillis() : Number.isFinite(value) ? value : null);

export { toMs };

// The most the list of published cards may hold, in characters (a database document holds about
// 1 MB), and how often the team's phones make it again.
export const LIST_MOST = 900000;
export const LIST_EVERY = 3 * 60 * 60 * 1000;

// Which list a card goes in, by the town or university it's for (its `groupBy` field). Cards
// without one are Durham's, from before there were other universities, and Durham keeps the
// list's original name: lists/spots for Durham, lists/spots-newcastle for Newcastle. Phones read
// the same names (the listings and societies features), and the database's rules allow them.
export const FIRST_GROUP = 'durham';
export function groupOf(data, field) {
  const group = field && typeof data?.[field] === 'string' ? data[field].trim().toLowerCase() : '';
  return /^[a-z0-9-]{1,40}$/.test(group) ? group : FIRST_GROUP;
}
export function listName(base, group) {
  return !group || group === FIRST_GROUP ? base : `${base}-${group}`;
}

// Whether this account approves changes: made by hand in the Firebase console (admins/{uid}).
export async function isAdmin(db, uid) {
  const snap = await db.doc(`admins/${uid}`).get();
  return snap.exists;
}

export function makeStore(config) {
  const { cards, codes, owners, changes, stats, link, toStore } = config;
  const fromStore = config.fromStore || ((data) => data);
  const most = config.most || 200;
  // The published cards as stored, from the last allCards(), for saveList: { id: data }, or null
  // if there were more than allCards asks for (then the list can't be complete).
  let published = null;
  let savedLists = {}; // what saveList last wrote to each list, so the same list isn't written twice

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
      published = snap.docs.length >= most ? null
        : Object.fromEntries(snap.docs.filter((d) => d.data().published === true).map((d) => [d.id, d.data()]));
      return snap.docs.map((d) => ({ ...fromStore(d.data()), id: d.id, name: String(d.data().name || d.id), published: d.data().published === true }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    // The codes made so far, newest first: [{ code, card, used, usedBy, made }].
    async codes(db) {
      const snap = await db.collection(codes).limit(200).get();
      return snap.docs.map((d) => ({ code: d.id, card: d.data()[link], used: !!d.data().usedBy, usedBy: d.data().usedBy || null, made: toMs(d.data().made) }))
        .sort((a, b) => (b.made || 0) - (a.made || 0));
    },

    // The list students' phones read (lists/{list}): every published card, as stored, in one
    // document, so a phone reads 1 document instead of one per card. Made from what the last
    // allCards() found, so it costs no extra reads. If the cards don't all fit (more than allCards
    // asks for, or too big for one document), the list is deleted and phones read the cards one
    // by one as before. Returns true if it wrote or deleted something.
    // With `groupBy`, there's one list per town or university (listName), each made the same way.
    async saveList(db, fields) {
      if (!config.list) return false;
      if (!published) {
        // Not all the cards were found, so no list can be complete: phones read them one by one.
        // The lists this phone knows of go; Durham's always, as it always used to.
        const names = new Set([config.list, ...Object.keys(savedLists)]);
        let wrote = false;
        for (const name of names) {
          if (savedLists[name] === 'none') continue;
          await db.doc(`lists/${name}`).delete();
          savedLists[name] = 'none';
          wrote = true;
        }
        return wrote;
      }
      // Durham's list, and any this phone made before, are written even when empty, so a town
      // whose cards were all taken down doesn't keep showing them.
      const groups = { [config.list]: {} };
      for (const name of Object.keys(savedLists)) groups[name] = {};
      for (const [id, data] of Object.entries(published)) {
        const name = listName(config.list, groupOf(data, config.groupBy));
        (groups[name] ||= {})[id] = data;
      }
      let wrote = false;
      for (const [name, items] of Object.entries(groups)) {
        const ref = db.doc(`lists/${name}`);
        const print = JSON.stringify(items);
        if (print.length > LIST_MOST) {
          if (savedLists[name] === 'none') continue;
          await ref.delete();
          savedLists[name] = 'none';
          wrote = true;
          continue;
        }
        if (print === savedLists[name]) continue;
        await ref.set({ items, at: fields.serverTimestamp() });
        savedLists[name] = print;
        wrote = true;
      }
      return wrote;
    },

    // For the team's phones: makes the list again if it hasn't been made for `every` ms on this
    // phone (when it's last made is kept in `storage` under 'listed'), so changes typed in the
    // Firebase console reach students too. Costs one look at every card.
    async freshenList(db, fields, storage, every = LIST_EVERY) {
      if (!config.list || !storage) return false;
      const listed = storage.get('listed', {}) || {};
      if (Date.now() - (listed[config.list] || 0) < every) return false;
      await store.allCards(db);
      await store.saveList(db, fields);
      storage.set('listed', { ...listed, [config.list]: Date.now() });
      return true;
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
