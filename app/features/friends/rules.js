// Rules for friends, without any screen code, so they can be tested.

// Friend codes look like MD-7K3Q-9P2X: 8 letters and digits that can't be confused (no 0, O, 1, I).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_PATTERN = /^MD-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
export const SHARE_DAYS = 28; // friends see your classes for the next 4 weeks
export const MAX_PEOPLE = 50; // friends and requests, together (the database rules enforce it too)
export const MAX_CLASSES = 400;
export const MAX_SHOWN = 4; // friends shown in the Planner at once
export const MAX_GROUPS = 20;
// Colours for friends in the Planner who don't have a tint of their own, in turn.
export const PLANNER_HUES = [200, 30, 140, 320, 260, 0];
// Where the web version lives: invite links and QR codes point here, so they work on any phone
// (inside the phone apps the page's own address is "localhost", which means nothing elsewhere).
export const WEB_ADDRESS = 'https://eleadlau-commits.github.io/timetable/';

// A new random code. `random(n)` gives a whole number from 0 to n-1 (crypto by default).
export function makeCode(random = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n) {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[random(ALPHABET.length)]).join('');
  return `MD-${part()}-${part()}`;
}

// What someone typed, as a code if it can be one: any case, with or without "MD", spaces and dashes.
export function readCode(text) {
  const plain = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^MD/, '');
  if (plain.length !== 8) return null;
  const code = `MD-${plain.slice(0, 4)}-${plain.slice(4)}`;
  return CODE_PATTERN.test(code) ? code : null;
}

// The invite link for a code: opens Add a friend with the code filled in.
export function inviteLink(code) {
  return `${WEB_ADDRESS}#friend=${code}`;
}

// A code from anything someone pasted or scanned: an invite link, a message with a code in it,
// or just the code. Null if there isn't one.
export function codeFrom(text) {
  const value = String(text || '');
  const link = value.match(/[#&?]friend=([A-Za-z0-9-]+)/);
  if (link) return readCode(link[1]);
  const inside = value.match(/\bMD[\s-]*([A-Za-z0-9]{4})[\s-]*([A-Za-z0-9]{4})\b/i);
  if (inside) return readCode(inside[1] + inside[2]);
  return readCode(value);
}

// The id of the friendship document for two people: both account numbers, smaller first.
export function pairId(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

// "Elead Lau" → "Elead": the name friends see to start with, until it's changed.
export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0].slice(0, 30) || 'Friend';
}

export function cleanName(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 30);
}

// "Elead Lau" → "EL", "sam" → "S".
export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0]?.[0] || '?')).toUpperCase();
}

// Your classes to share: the next 4 weeks from the start of today, not cancelled, not hidden,
// with the university's own name and room. { t: title, s: start ms, e: end ms, l: room }
export function sharedClasses(sessions, isShown, now = new Date()) {
  const from = new Date(now); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setDate(to.getDate() + SHARE_DAYS);
  return sessions
    .filter((s) => !s.cancelled && !s.allDay && s.end > from && s.start < to && isShown(s))
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_CLASSES)
    .map((s) => ({ t: String(s.title || '').slice(0, 120), s: +s.start, e: +s.end, l: String(s.location || '').slice(0, 120) }));
}

// Only when you're busy, for friends who see free or busy but not what or where:
// overlapping classes joined into one. [{ s, e }]
export function busyTimes(classes) {
  const times = [];
  for (const c of [...classes].sort((a, b) => a.s - b.s)) {
    const last = times[times.length - 1];
    if (last && c.s <= last.e) last.e = Math.max(last.e, c.e);
    else times.push({ s: c.s, e: c.e });
  }
  return times;
}

// Whether `owner` shares only free or busy with the other person in a friendship.
export function onlyBusy(friendship, owner) {
  return Array.isArray(friendship?.busyOnly) && friendship.busyOnly.includes(owner);
}

// A short fingerprint of what's shared, to tell whether it changed since it was last sent.
export function fingerprint(classes) {
  let h = 0;
  for (const ch of JSON.stringify(classes)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return String(h);
}

// Busy or free right now, from a friend's classes. { busy, until: ms or null, title? }
export function nowStatus(classes, now = Date.now()) {
  const current = classes.find((c) => c.s <= now && now < c.e);
  if (current) return { busy: true, until: current.e, title: current.t };
  const next = classes.find((c) => c.s > now && sameDay(c.s, now));
  return { busy: false, until: next ? next.s : null };
}

function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// Friends for the Home widget, free ones first, then those busy, then those who haven't shared
// (or paused). people: [{ uid, name, hue, classes, paused }]. Returns the same with `now`
// (nowStatus, or null) and how many are free.
export function whoIsFree(people, now = Date.now()) {
  const rank = (p) => (!p.now ? 2 : p.now.busy ? 1 : 0);
  const list = people
    .map((p) => ({ ...p, now: p.classes && !p.paused ? nowStatus(p.classes, now) : null }))
    .sort((a, b) => rank(a) - rank(b) || (a.now?.busy ? a.now.until - b.now.until : 0) || a.name.localeCompare(b.name));
  return { list, free: list.filter((p) => p.now && !p.now.busy).length };
}

// Classes grouped by day, from today: [{ day: Date (midnight), classes: [...] }].
export function byDay(classes, now = Date.now()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const days = new Map();
  for (const c of classes) {
    if (c.e < +today) continue;
    const day = new Date(c.s); day.setHours(0, 0, 0, 0);
    if (!days.has(+day)) days.set(+day, { day, classes: [] });
    days.get(+day).classes.push(c);
  }
  return [...days.values()];
}

// Times on one day when neither of you has a class, between `open` and `close` hours (9–18),
// at least `least` minutes long. Both lists are [{ s, e }] in ms. Returns [{ s, e }].
export function freeTogether(mine, theirs, day, { open = 9, close = 18, least = 30 } = {}) {
  const start = new Date(day); start.setHours(open, 0, 0, 0);
  const end = new Date(day); end.setHours(close, 0, 0, 0);
  const busy = [...mine, ...theirs]
    .filter((c) => c.e > +start && c.s < +end)
    .sort((a, b) => a.s - b.s);
  const free = [];
  let cursor = +start;
  for (const c of busy) {
    if (c.s > cursor) free.push({ s: cursor, e: c.s });
    cursor = Math.max(cursor, c.e);
  }
  if (cursor < +end) free.push({ s: cursor, e: +end });
  return free.filter((f) => f.e - f.s >= least * 60000);
}

// The people on your profile's list who no longer have a friendship with you (the other person
// removed it), so they can be taken off and don't count against your 50.
export function stalePeople(people, friendships, me) {
  const current = new Set(friendships.map((f) => f.users.find((u) => u !== me)));
  return people.filter((uid) => !current.has(uid));
}

// What went wrong, in plain words, with the database's own code at the end so it can be looked up.
export function explainProblem(err, online = true) {
  if (!online) return 'You\'re offline. Friends needs the internet.';
  const code = String(err?.code || err?.message || 'unknown');
  if (code === 'full') return 'You\'ve reached 50 friends and requests. Remove someone first.';
  if (code === 'signed-out') return 'You\'ve been signed out. Sign in again on the account page.';
  if (code === 'unverified') return 'Confirm your email first: tap the link we sent you, then tap I\'ve confirmed it on the account page.';
  if (code === 'load') return 'Couldn\'t load the online part of the app. Check you\'re online and try again.';
  if (code === 'permission-denied') {
    return 'The online database refused this. If Friends has just been added, its database rules may not be published yet (Firebase console → Firestore Database → Rules). (permission-denied)';
  }
  if (code === 'not-found' || code === 'failed-precondition') {
    return `The online database isn't set up yet, or can't be found. (${code})`;
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') return `Couldn't reach the online database. Check you're online and try again. (${code})`;
  return `Something went wrong. Try again in a moment. (${code})`;
}

// ---- Groups and the Planner ----

// Times when you and everyone in a group are free (09:00–18:00, at least 30 minutes), for
// `days` days from `from`. busy: [{ s, e }] for everyone together (yours and theirs). Days in the
// past are left out, and today only from now. Returns [{ day: Date, free: [{ s, e }] }].
export function groupFree(busy, from = new Date(), { days = 7, now = Date.now() } = {}) {
  const out = [];
  const first = new Date(from); first.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const day = new Date(first); day.setDate(first.getDate() + i);
    const free = freeTogether(busy, [], day)
      .map((f) => ({ s: Math.max(f.s, now), e: f.e }))
      .filter((f) => f.e - f.s >= 30 * 60000);
    out.push({ day, free });
  }
  return out;
}

// Turns someone on or off in the Planner. Returns { shown, full } (full: they couldn't be added).
export function toggleShown(shown, uid, max = MAX_SHOWN) {
  if (shown.includes(uid)) return { shown: shown.filter((u) => u !== uid), full: false };
  if (shown.length >= max) return { shown, full: true };
  return { shown: [...shown, uid], full: false };
}

// The friends in the Planner's list: pinned first, then by name; with `query`, only names that
// contain it. people: [{ uid, name }].
export function plannerList(people, pinned = [], query = '') {
  const q = String(query || '').trim().toLowerCase();
  return people
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => (pinned.includes(b.uid) - pinned.includes(a.uid)) || a.name.localeCompare(b.name));
}

// A friend's colour in the Planner: the tint you chose, or the next of PLANNER_HUES.
export function plannerHue(tint, index) {
  return tint ?? PLANNER_HUES[index % PLANNER_HUES.length];
}

// A friend's shared classes as sessions for the Planner (faint, next to yours).
export function friendSessions({ uid, name, classes }, hue) {
  return (classes || []).map((c) => ({
    key: `friend:${uid}@${c.s}`,
    title: `${name} · ${c.t || 'Busy'}`,
    short: name,
    location: c.l || '',
    description: '',
    start: new Date(c.s),
    end: new Date(c.e),
    allDay: false,
    cancelled: false,
    module: `friend:${uid}`,
    hue,
    outline: true,
    others: true,
    who: name,
  }));
}

// A group as saved: a name (up to 30 letters) and its members, friends only. Null if it has no
// name or nobody in it.
export function cleanGroup({ id, name, members }, friends) {
  const tidy = cleanName(name);
  const kept = [...new Set(members || [])].filter((uid) => friends.includes(uid));
  if (!tidy || !kept.length) return null;
  return { id, name: tidy, members: kept };
}
