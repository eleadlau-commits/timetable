// Rules for society committees, without any screen code, so they can be tested: society codes,
// checking what a committee types, what changed, and the weekly counts.
//
// Step 3 of the plan pulls out what shops and societies share. These repeat the shop feature's
// rules.js almost word for word: the codes (makeCode, cleanCode, showCode), cleanLink, the weeks
// and counts (weekOf, weeksBack, trend, toCount) and setupStep. Only the fields, their checks and
// the words are the society's own.

import { time } from 'folio';

// ---- Society codes (the same letters and length as shop codes) ----

// No I, O, 0 or 1, which are easy to mix up when read out.
export const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;

export function makeCode(random = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  return Array.from(random(CODE_LENGTH), (b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
}

// A code as someone typed it ('k7qm 2xpa', 'K7QM-2XPA'), tidied, or null if it can't be one.
export function cleanCode(text) {
  const code = String(text || '').toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => CODE_LETTERS.includes(c)) ? code : null;
}

export function showCode(code) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// ---- What a committee can change ----

// In the order the form shows them. The limits are the ones the societies feature shows, and
// the ones the database checks.
export const FIELDS = [
  { key: 'line', label: 'Short line', hint: 'What your society does, e.g. "Day walks in the Dales, all levels welcome"', most: 140 },
  { key: 'meets', label: 'When and where you meet', hint: 'e.g. "Wednesdays 7pm, Elvet Riverside"', most: 120 },
  { key: 'fee', label: 'Joining fee', hint: 'e.g. "£5 a year" or "Free"', most: 60 },
  { key: 'instagram', label: 'Instagram', hint: 'Your account, e.g. @durhamhiking', type: 'instagram' },
  { key: 'join', label: 'Join link', hint: 'Your sign-up page, e.g. on the Students\' Union website', type: 'link' },
];
export const KEYS = FIELDS.map((f) => f.key);

function text(value, most) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, most);
}

// A web address as typed: 'durhamsu.com/x' becomes 'https://durhamsu.com/x'. '' for nothing,
// null if it isn't a proper https address.
export function cleanLink(value) {
  let typed = String(value ?? '').trim();
  if (!typed) return '';
  if (!/^[a-z]+:/i.test(typed)) typed = `https://${typed}`;
  try {
    const url = new URL(typed);
    if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.href.length > 500) return null;
    return url.href;
  } catch {
    return null;
  }
}

// An Instagram account as typed ('@durhamhiking', 'durhamhiking', 'instagram.com/durhamhiking')
// → 'https://www.instagram.com/durhamhiking/'. '' for nothing, null if it can't be one.
export function cleanInstagram(value) {
  const typed = String(value ?? '').trim();
  if (!typed) return '';
  const fromLink = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i.exec(typed);
  const handle = fromLink ? fromLink[1] : typed.replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : null;
}

// An Instagram address → '@handle', to show in the form and to the team.
export function showInstagram(value) {
  const m = /instagram\.com\/([A-Za-z0-9._]{1,30})/i.exec(String(value || ''));
  return m ? `@${m[1]}` : String(value || '');
}

// What a committee typed → { change: { line, meets, fee, instagram, join } } or { error }.
export function checkEdit(form) {
  const change = {};
  for (const field of FIELDS) {
    const value = form?.[field.key];
    if (field.type === 'link') {
      const link = cleanLink(value);
      if (link === null) return { error: `${field.label}: that doesn't look like a web address. It should start with https://` };
      change[field.key] = link;
    } else if (field.type === 'instagram') {
      const insta = cleanInstagram(value);
      if (insta === null) return { error: 'Instagram: type your account name, like @durhamhiking.' };
      change[field.key] = insta;
    } else {
      change[field.key] = text(value, field.most);
    }
  }
  return { change };
}

// ---- What changed ----

export function showValue(key, value) {
  return key === 'instagram' ? showInstagram(value) : String(value || '');
}

// The parts a change changes: [{ key, label, now, next }], as text.
export function differences(society, change) {
  return FIELDS
    .map((f) => ({ key: f.key, label: f.label, now: showValue(f.key, society?.[f.key]), next: showValue(f.key, change?.[f.key]) }))
    .filter((d) => d.now !== d.next);
}

// The society with a waiting change on top, to show the committee how it will look.
export function withChange(society, change) {
  if (!society) return null;
  if (!change) return society;
  const out = { ...society };
  for (const key of KEYS) out[key] = change[key] ?? '';
  return out;
}

// ---- Counting, for How it's going ----

function day(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The Monday a week starts on, as 'YYYY-MM-DD'. Counts are kept per society and week.
export function weekOf(date = new Date()) {
  return day(time.startOfWeek(new Date(date)).getTime());
}

// This week and the weeks before it, newest first.
export function weeksBack(n, date = new Date()) {
  const monday = time.startOfWeek(new Date(date));
  return Array.from({ length: n }, (_, i) => weekOf(time.addDays(monday, -7 * i)));
}

// The counts for the bars, oldest first: [{ week, seen, taps, label }]. Missing weeks are 0.
export function trend(stats, weeks) {
  return [...weeks].reverse().map((week) => {
    const found = (stats || []).find((s) => s?.week === week);
    const [y, m, d] = week.split('-').map(Number);
    return {
      week,
      seen: found?.seen || 0,
      taps: found?.taps || 0,
      label: new Date(y, m - 1, d, 12).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    };
  });
}

// One plain sentence about this week.
export function trendSentence(points) {
  const now = points?.[points.length - 1];
  const before = points?.[points.length - 2];
  if (!now) return '';
  const people = (n) => `${n} ${n === 1 ? 'student' : 'students'}`;
  let line = `${people(now.seen)} saw your society this week`;
  if (before && before.seen !== now.seen) line += `, ${now.seen > before.seen ? 'up' : 'down'} from ${before.seen} last week`;
  line += '.';
  if (now.taps) line += ` ${people(now.taps)} tapped Instagram or Join.`;
  return line;
}

export function statId(society, week) {
  return `${society}_${week}`;
}

// Each phone counts a society at most once a day for being seen and once for a tap. Given
// what's been counted today ({ day, seen: [ids], taps: [ids] }), returns the ids still to
// count and the record to save.
export function toCount(record, kind, ids, now = new Date()) {
  const today = day(now.getTime());
  const kept = record?.day === today ? record : { day: today, seen: [], taps: [] };
  const done = new Set(Array.isArray(kept[kind]) ? kept[kind] : []);
  const fresh = [...new Set(ids)].filter((id) => typeof id === 'string' && id && !done.has(id));
  return { fresh, record: { ...kept, [kind]: [...done, ...fresh] } };
}

// ---- Where a committee member is ----

// 'signed-out', 'unconfirmed' (email not confirmed yet), 'loading', 'linked' or 'new'.
export function setupStep({ user, loaded, mine }) {
  if (!user) return 'signed-out';
  if (!user.verified) return 'unconfirmed';
  if (mine) return 'linked';
  if (!loaded) return 'loading';
  return 'new';
}
