// Friends in the database. Every write here matches what firebase/firestore.rules allows:
//   users/<me>/private/profile   { name, code, people, paused?, updatedAt }  only me
//   codes/<code>                 { uid, name }                       anyone signed in can look one up
//   friendships/<a>_<b>          { users, from, to, status, names, code, createdAt, acceptedAt?,
//                                  busyOnly? }  busyOnly lists who shares only free or busy with the other
//   shared/<me>                  { classes, paused?, updatedAt }     me, and people I've asked or accepted,
//                                                                    unless I share only free or busy with them
//   busy/<me>                    { times, paused?, updatedAt }       me, and people I've asked or accepted

import { makeCode, pairId, busyTimes, MAX_PEOPLE } from './rules.js';

export class FriendStore {
  constructor(account) {
    this.account = account;
  }

  get uid() {
    return this.account.user?.uid;
  }

  async db() {
    return this.account.database();
  }

  profileRef(db) {
    return db.doc(`users/${this.uid}/private/profile`);
  }

  // Your profile, made (with a new code) the first time you open Friends.
  async profile(defaultName) {
    const db = await this.db();
    const snap = await this.profileRef(db).get();
    if (snap.exists) return snap.data();
    for (let tries = 0; tries < 5; tries++) {
      const code = makeCode();
      if ((await db.doc(`codes/${code}`).get()).exists) continue; // taken: try another
      const batch = db.batch();
      batch.set(this.profileRef(db), { name: defaultName, code, people: [], updatedAt: this.account.serverTime() });
      batch.set(db.doc(`codes/${code}`), { uid: this.uid, name: defaultName });
      await batch.commit();
      return { name: defaultName, code, people: [] };
    }
    throw new Error('no-code');
  }

  // Who a code belongs to: { uid, name }, or null.
  async lookup(code) {
    const db = await this.db();
    const snap = await db.doc(`codes/${code}`).get();
    return snap.exists ? snap.data() : null;
  }

  // Every friendship you're part of: [{ id, users, from, to, status, names, ... }].
  async friendships() {
    const db = await this.db();
    const snap = await db.collection('friendships').where('users', 'array-contains', this.uid).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async friendship(other) {
    const db = await this.db();
    const snap = await db.doc(`friendships/${pairId(this.uid, other)}`).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  // Asks someone, with the code they gave you. Your timetable must be shared first.
  // busyOnly: they'll see only when you're free or busy, not what or where.
  async ask(profile, { uid, name }, code, busyOnly = false) {
    if (profile.people.length >= MAX_PEOPLE) throw new Error('full');
    const db = await this.db();
    const { fields } = this.account;
    const batch = db.batch();
    batch.update(this.profileRef(db), { people: fields.arrayUnion(uid), updatedAt: this.account.serverTime() });
    batch.set(db.doc(`friendships/${pairId(this.uid, uid)}`), {
      users: [this.uid, uid].sort(), from: this.uid, to: uid, status: 'pending', code,
      names: { [this.uid]: profile.name, [uid]: name }, createdAt: this.account.serverTime(),
      ...(busyOnly ? { busyOnly: [this.uid] } : {}),
    });
    await batch.commit();
  }

  async accept(profile, friendship) {
    if (profile.people.length >= MAX_PEOPLE) throw new Error('full');
    const db = await this.db();
    const { fields } = this.account;
    const batch = db.batch();
    batch.update(this.profileRef(db), { people: fields.arrayUnion(friendship.from), updatedAt: this.account.serverTime() });
    batch.update(db.doc(`friendships/${friendship.id}`), {
      status: 'accepted', acceptedAt: this.account.serverTime(), [`names.${this.uid}`]: profile.name,
    });
    await batch.commit();
  }

  // Cancel, decline or remove: the friendship goes, and they come off your list.
  async end(friendship) {
    const db = await this.db();
    const other = friendship.users.find((u) => u !== this.uid);
    const batch = db.batch();
    batch.delete(db.doc(`friendships/${friendship.id}`));
    batch.update(this.profileRef(db), { people: this.account.fields.arrayRemove(other), updatedAt: this.account.serverTime() });
    await batch.commit();
  }

  // Takes people off your list whose friendship has gone (they removed you).
  async forget(stale) {
    if (!stale.length) return;
    const db = await this.db();
    await this.profileRef(db).update({ people: this.account.fields.arrayRemove(...stale), updatedAt: this.account.serverTime() });
  }

  // Your name for friends: in your profile, your code, and every friendship.
  async rename(profile, name, friendships) {
    const db = await this.db();
    const batch = db.batch();
    batch.update(this.profileRef(db), { name, updatedAt: this.account.serverTime() });
    batch.update(db.doc(`codes/${profile.code}`), { name });
    for (const f of friendships) batch.update(db.doc(`friendships/${f.id}`), { [`names.${this.uid}`]: name });
    await batch.commit();
  }

  // What you share with one person: everything, or only when you're free or busy.
  async setBusyOnly(friendship, on) {
    const db = await this.db();
    const { fields } = this.account;
    await db.doc(`friendships/${friendship.id}`).update({ busyOnly: on ? fields.arrayUnion(this.uid) : fields.arrayRemove(this.uid) });
  }

  // Pausing: friends see "Sharing paused" until you switch it back on.
  async setPaused(paused) {
    const db = await this.db();
    await this.profileRef(db).update({ paused, updatedAt: this.account.serverTime() });
  }

  // Your classes (shared), and only the times you're busy (busy), for friends who see just that.
  async share(classes, { paused = false } = {}) {
    const db = await this.db();
    const at = this.account.serverTime();
    const list = paused ? [] : classes;
    const extra = paused ? { paused: true } : {};
    const batch = db.batch();
    batch.set(db.doc(`shared/${this.uid}`), { classes: list, updatedAt: at, ...extra });
    batch.set(db.doc(`busy/${this.uid}`), { times: busyTimes(list), updatedAt: at, ...extra });
    await batch.commit();
  }

  async unshare() {
    const db = await this.db();
    const batch = db.batch();
    batch.delete(db.doc(`shared/${this.uid}`));
    batch.delete(db.doc(`busy/${this.uid}`));
    await batch.commit();
  }

  // A friend's shared timetable: { classes, updatedAt (ms), paused, busyOnly }, or null. With
  // busyOnly (they share only free or busy with you), the classes are just times: { s, e }.
  async timetable(uid, busyOnly = false) {
    const db = await this.db();
    const snap = await db.doc(`${busyOnly ? 'busy' : 'shared'}/${uid}`).get();
    if (!snap.exists) return null;
    const data = snap.data();
    const list = busyOnly ? data.times : data.classes;
    return {
      classes: Array.isArray(list) ? list : [], updatedAt: data.updatedAt?.toMillis?.() || null,
      paused: data.paused === true, busyOnly,
    };
  }

  // For Delete my account: every friendship, and your code. (Your profile and shared timetable
  // are removed by the account feature.)
  static async removeAll(db, uid) {
    const snap = await db.collection('friendships').where('users', 'array-contains', uid).get();
    for (const d of snap.docs) await d.ref.delete();
    const profile = await db.doc(`users/${uid}/private/profile`).get();
    if (profile.exists) await db.doc(`codes/${profile.data().code}`).delete();
  }
}
