// The shared database steps, against a small stand-in for the database that records every
// write, so we can see each kind of card keeps exactly the names it always had.
import { test, assert } from 'folio/testing';
import { makeStore, isAdmin } from '../store.js';

function fakeDb(start = {}) {
  const docs = new Map(Object.entries(start));
  const writes = [];
  const snap = (path) => ({ id: path.split('/').pop(), exists: docs.has(path), data: () => ({ ...docs.get(path) }) });
  const ref = (path) => ({
    path,
    get: async () => snap(path),
    set: async (data, opts) => { writes.push(['set', path, data]); docs.set(path, opts?.merge ? { ...docs.get(path), ...data } : data); },
    update: async (data) => { writes.push(['update', path, data]); docs.set(path, { ...docs.get(path), ...data }); },
    delete: async () => { writes.push(['delete', path]); docs.delete(path); },
  });
  const query = (name, filters = []) => ({
    where: (key, _op, value) => query(name, [...filters, [key, value]]),
    limit: () => ({
      get: async () => ({
        docs: [...docs.keys()]
          .filter((p) => p.startsWith(`${name}/`) && filters.every(([k, v]) => docs.get(p)[k] === v))
          .map(snap),
      }),
    }),
  });
  return {
    docs,
    writes,
    doc: ref,
    collection: (name) => query(name),
    batch() {
      const steps = [];
      return {
        set: (r, data) => steps.push(() => r.set(data)),
        update: (r, data) => steps.push(() => r.update(data)),
        delete: (r) => steps.push(() => r.delete()),
        commit: async () => { for (const step of steps) await step(); },
      };
    },
  };
}

const fields = { serverTimestamp: () => 'NOW', increment: (n) => `+${n}` };

const shops = () => makeStore({
  cards: 'spots', codes: 'shopCodes', owners: 'shopOwners', changes: 'spotChanges', stats: 'spotStats', link: 'place',
  toStore: (c) => ({ line: c.line || '' }),
});
const societies = () => makeStore({
  cards: 'societies', codes: 'societyCodes', owners: 'societyOwners', changes: 'societyChanges', stats: 'societyStats', link: 'society',
  toStore: (c) => ({ line: c.line || '' }), removeUsed: true,
});

test('a code links an account to its card, once', async () => {
  const db = fakeDb({ 'shopCodes/K7QM2XPA': { place: 'cafe1', usedBy: null } });
  const store = shops();
  const linked = await store.useCode(db, 'u1', 'K7QM2XPA');
  assert.deepEqual(linked, { place: 'cafe1', code: 'K7QM2XPA' });
  assert.equal(db.docs.get('shopCodes/K7QM2XPA').usedBy, 'u1');
  assert.equal(db.docs.get('shopOwners/u1').place, 'cafe1');
  // The same account again is fine; anyone else is told it's used.
  await store.useCode(db, 'u1', 'K7QM2XPA');
  let error = null;
  try { await store.useCode(db, 'u2', 'K7QM2XPA'); } catch (err) { error = err.message; }
  assert.equal(error, 'used-code');
  try { await store.useCode(db, 'u2', 'NOPENOPE'); } catch (err) { error = err.message; }
  assert.equal(error, 'bad-code');
  assert.deepEqual(await store.ownerOf(db, 'u1'), db.docs.get('shopOwners/u1'));
});

test('a society code is written under the society\'s own names', async () => {
  const db = fakeDb({ 'societyCodes/ABCDEFGH': { society: 'hiking', usedBy: null } });
  await societies().useCode(db, 'u1', 'ABCDEFGH');
  assert.equal(db.docs.get('societyOwners/u1').society, 'hiking');
  assert.equal(db.docs.get('societyOwners/u1').code, 'ABCDEFGH');
});

test('a change waits, then the team approves or rejects it', async () => {
  const db = fakeDb({ 'spots/cafe1': { name: 'Flat White', line: 'Coffee', published: true } });
  const store = shops();
  await store.sendChange(db, fields, 'u1', 'cafe1', { line: 'Tea' });
  assert.deepEqual(db.docs.get('spotChanges/cafe1'), { place: 'cafe1', by: 'u1', line: 'Tea', status: 'waiting', at: 'NOW' });
  const waiting = await store.waiting(db);
  assert.equal(waiting.length, 1);
  assert.equal(waiting[0].place, 'cafe1');
  await store.approveChange(db, waiting[0]);
  assert.equal(db.docs.get('spots/cafe1').line, 'Tea');
  assert.equal(db.docs.get('spots/cafe1').name, 'Flat White');
  assert.equal(db.docs.get('spotChanges/cafe1').status, 'approved');
  assert.equal((await store.waiting(db)).length, 0);
  await store.sendChange(db, fields, 'u1', 'cafe1', { line: 'Cake' });
  await store.rejectChange(db, await store.changeOf(db, 'cafe1'));
  assert.equal(db.docs.get('spots/cafe1').line, 'Tea');
  await store.withdrawChange(db, 'cafe1');
  assert.equal(await store.changeOf(db, 'cafe1'), null);
});

test('counts are added per card and week, under the card\'s own name', async () => {
  const db = fakeDb();
  await shops().count(db, fields, 'cafe1', '2026-11-02', 'seen');
  assert.deepEqual(db.writes[0], ['set', 'spotStats/cafe1_2026-11-02', { place: 'cafe1', week: '2026-11-02', seen: '+1' }]);
  await societies().count(db, fields, 'hiking', '2026-11-02', 'taps');
  assert.deepEqual(db.writes[1], ['set', 'societyStats/hiking_2026-11-02', { society: 'hiking', week: '2026-11-02', taps: '+1' }]);
  const db2 = fakeDb({ 'spotStats/cafe1_2026-11-02': { seen: 4, taps: 1 } });
  assert.deepEqual(await shops().stats(db2, 'cafe1', ['2026-11-02', '2026-10-26']),
    [{ week: '2026-11-02', seen: 4, taps: 1 }, { week: '2026-10-26', seen: 0, taps: 0 }]);
});

test('Delete my account removes this person\'s own change and code, not someone else\'s', async () => {
  const db = fakeDb({
    'shopOwners/u1': { place: 'cafe1', code: 'AAAAAAAA' },
    'shopCodes/AAAAAAAA': { place: 'cafe1', usedBy: 'u1' },
    'spotChanges/cafe1': { place: 'cafe1', by: 'u2', status: 'waiting' },
  });
  await shops().removeAll(db, 'u1');
  assert.ok(db.docs.has('spotChanges/cafe1')); // u2's change stays
  assert.ok(!db.docs.has('shopCodes/AAAAAAAA'));
  db.docs.set('spotChanges/cafe1', { place: 'cafe1', by: 'u1', status: 'waiting' });
  db.docs.set('shopCodes/AAAAAAAA', { place: 'cafe1', usedBy: 'u1' });
  await shops().removeAll(db, 'u1');
  assert.ok(!db.docs.has('spotChanges/cafe1'));
  await shops().removeAll(db, 'nobody'); // nothing to do
});

test('codes for the team: made, listed newest first, removed', async () => {
  const db = fakeDb({
    'societies/hiking': { name: 'Hiking', published: true },
    'societies/chess': { name: 'Chess' },
    'societyCodes/OLDOLDOL': { society: 'chess', usedBy: 'u9', made: 1 },
    'societyOwners/u9': { society: 'chess', code: 'OLDOLDOL' },
  });
  const store = societies();
  await store.addCode(db, fields, 'NEWNEWNE', 'hiking');
  assert.deepEqual(db.docs.get('societyCodes/NEWNEWNE'), { society: 'hiking', usedBy: null, made: 'NOW' });
  const cards = await store.allCards(db);
  assert.deepEqual(cards.map((c) => [c.id, c.name, c.published]), [['chess', 'Chess', false], ['hiking', 'Hiking', true]]);
  const codes = await store.codes(db);
  const old = codes.find((c) => c.code === 'OLDOLDOL');
  assert.deepEqual(old, { code: 'OLDOLDOL', card: 'chess', used: true, usedBy: 'u9', made: 1 });
  // Societies: removing a used code also unlinks the person who used it.
  await store.removeCode(db, old);
  assert.ok(!db.docs.has('societyCodes/OLDOLDOL'));
  assert.ok(!db.docs.has('societyOwners/u9'));
  // Shops: the code goes, the owner stays linked.
  const shopDb = fakeDb({ 'shopCodes/X2X2X2X2': { place: 'cafe1', usedBy: 'u3' }, 'shopOwners/u3': { place: 'cafe1' } });
  await shops().removeCode(shopDb, { code: 'X2X2X2X2', card: 'cafe1', usedBy: 'u3' });
  assert.ok(!shopDb.docs.has('shopCodes/X2X2X2X2'));
  assert.ok(shopDb.docs.has('shopOwners/u3'));
});

test('leaving a card removes the link and its code', async () => {
  const db = fakeDb({ 'societyOwners/u1': { society: 'hiking', code: 'CCCCCCCC' }, 'societyCodes/CCCCCCCC': { society: 'hiking', usedBy: 'u1' } });
  await societies().leave(db, 'u1', { code: 'CCCCCCCC' });
  assert.ok(!db.docs.has('societyOwners/u1'));
  assert.ok(!db.docs.has('societyCodes/CCCCCCCC'));
});

test('who approves changes is in admins', async () => {
  const db = fakeDb({ 'admins/boss': {} });
  assert.equal(await isAdmin(db, 'boss'), true);
  assert.equal(await isAdmin(db, 'u1'), false);
});

test('the list students read: every published card in one document, written only when it changes', async () => {
  const db = fakeDb({
    'spots/cafe1': { name: 'Flat White', published: true, kind: 'cafe' },
    'spots/draft': { name: 'Not yet', published: false },
  });
  const store = makeStore({ cards: 'spots', codes: 'shopCodes', owners: 'shopOwners', changes: 'spotChanges', stats: 'spotStats', link: 'place', toStore: (c) => c, list: 'spots' });
  await store.allCards(db);
  assert.ok(await store.saveList(db, fields));
  assert.deepEqual(db.docs.get('lists/spots'), { items: { cafe1: { name: 'Flat White', published: true, kind: 'cafe' } }, at: 'NOW' });
  // The same again: nothing written.
  const before = db.writes.length;
  await store.allCards(db);
  assert.equal(await store.saveList(db, fields), false);
  assert.equal(db.writes.length, before);
  // Published: it joins the list.
  db.docs.set('spots/draft', { name: 'Now open', published: true });
  await store.allCards(db);
  await store.saveList(db, fields);
  assert.deepEqual(Object.keys(db.docs.get('lists/spots').items).sort(), ['cafe1', 'draft']);
});

test('the list is deleted when the cards don\'t all fit, and kinds without a list never write one', async () => {
  const db = fakeDb({ 'societies/a': { name: 'A', published: true }, 'societies/b': { name: 'B', published: true }, 'lists/societies': { items: {} } });
  const store = makeStore({ cards: 'societies', codes: 'c', owners: 'o', changes: 'ch', stats: 's', link: 'society', toStore: (c) => c, list: 'societies', most: 2 });
  await store.allCards(db); // 2 found, as many as it asks for: maybe there are more
  assert.ok(await store.saveList(db, fields));
  assert.ok(!db.docs.has('lists/societies'));
  const plain = societies();
  await plain.allCards(db);
  assert.equal(await plain.saveList(db, fields), false);
  assert.ok(!db.docs.has('lists/societies'));
});

test('the team\'s phones make the list again only now and then', async () => {
  const db = fakeDb({ 'spots/cafe1': { name: 'Flat White', published: true } });
  const store = makeStore({ cards: 'spots', codes: 'c', owners: 'o', changes: 'ch', stats: 's', link: 'place', toStore: (c) => c, list: 'spots' });
  const saved = new Map();
  const storage = { get: (k, d) => (saved.has(k) ? saved.get(k) : d), set: (k, v) => saved.set(k, v) };
  assert.ok(await store.freshenList(db, fields, storage));
  assert.ok(db.docs.has('lists/spots'));
  assert.equal(await store.freshenList(db, fields, storage), false); // just made
  saved.set('listed', { spots: Date.now() - 4 * 60 * 60 * 1000 });
  assert.ok(await store.freshenList(db, fields, storage));
});
