// Rules for businesses on Spots, without any screen code, so they can be tested: shop codes,
// checking what an owner types, what changed, and the weekly counts.

import { time } from 'folio';

// ---- Shop codes ----

// The letters a code is made of: no I, O, 0 or 1, which are easy to mix up when read out.
export const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;

// A new code, e.g. 'K7QM2XPA'. 32 letters, 8 long: about a million million codes, so they
// can't be guessed. `random(n)` gives n random bytes (the phone's own, by default).
export function makeCode(random = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  return Array.from(random(CODE_LENGTH), (b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
}

// A code as someone typed it ('k7qm 2xpa', 'K7QM-2XPA'), tidied, or null if it can't be one.
export function cleanCode(text) {
  const code = String(text || '').toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => CODE_LETTERS.includes(c)) ? code : null;
}

// A code to read out or write down: 'K7QM-2XPA'.
export function showCode(code) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// ---- What owners can change ----

// The parts of a card an owner can change, in the order the form shows them.
export const FIELDS = [
  { key: 'line', label: 'Short line', hint: 'What you are, in a few words, e.g. "Brunch and coffee by the river"', most: 120 },
  { key: 'deal', label: 'Student deal', hint: 'e.g. "10% off with your campus card". Leave it empty for no deal.', most: 120 },
  { key: 'dealEnds', label: 'Deal ends', hint: 'The last day of the deal. Leave it empty if it keeps going.', type: 'date' },
  { key: 'hours', label: 'Opening hours', hint: 'e.g. "Mon–Fri 8–6, Sat 9–5"', most: 120 },
  { key: 'link', label: 'Website', hint: 'https://…', type: 'link' },
  { key: 'menu', label: 'Menu link', hint: 'A page or PDF with your menu', type: 'link' },
];
export const KEYS = FIELDS.map((f) => f.key);

// The kinds of place, as the database has them, and their names.
export const KINDS = [['cafe', 'Café'], ['pub', 'Pub'], ['club', 'Club']];

function text(value, most) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, most);
}

// A web address as typed: 'flatwhite.co.uk' becomes 'https://flatwhite.co.uk/'. '' for nothing,
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

// 'YYYY-MM-DD' (from a date box) → that day at midday, in ms; null for nothing.
export function dayToMillis(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

// ms → 'YYYY-MM-DD', for a date box.
export function millisToDay(ms) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// What an owner typed in the form → { change: { line, deal, dealEnds, hours, link, menu } }, or
// { error: 'what to fix' }. dealEnds is ms or null.
export function checkEdit(form, now = Date.now()) {
  const change = {};
  for (const field of FIELDS) {
    const value = form?.[field.key];
    if (field.type === 'link') {
      const link = cleanLink(value);
      if (link === null) return { error: `${field.label}: that doesn't look like a web address. It should start with https://` };
      change[field.key] = link;
    } else if (field.type === 'date') {
      if (value && dayToMillis(value) === null) return { error: `${field.label}: choose a day.` };
      change[field.key] = dayToMillis(value);
    } else {
      change[field.key] = text(value, field.most);
    }
  }
  if (change.dealEnds != null && !change.deal) return { error: 'There\'s an end date but no deal. Type the deal, or clear the date.' };
  if (change.dealEnds != null && change.dealEnds < time.startOfDay(new Date(now)).getTime()) {
    return { error: 'The deal\'s last day has already gone. Choose a later day, or clear the date.' };
  }
  return { change };
}

// A business asking to be listed → { request: { kind, name, address, contact, …the card } } or
// { error }.
export function checkRequest(form, now = Date.now()) {
  const name = text(form?.name, 60);
  if (!name) return { error: 'Type the name of your place.' };
  if (!KINDS.some(([k]) => k === form?.kind)) return { error: 'Choose what kind of place it is.' };
  const contact = text(form?.contact, 120);
  if (!contact) return { error: 'Add a phone number or email, so we can get in touch.' };
  const card = checkEdit(form, now);
  if (card.error) return card;
  return { request: { kind: form.kind, name, address: text(form?.address, 120), contact, ...card.change } };
}

// ---- What changed ----

// How a value looks to the person approving it.
export function showValue(key, value) {
  if (key === 'dealEnds') return Number.isFinite(value) ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return value || '';
}

// The parts of a card that a change changes: [{ key, label, now, next }], shown as text.
export function differences(place, change) {
  return FIELDS
    .map((f) => ({ key: f.key, label: f.label, now: showValue(f.key, place?.[f.key] ?? null), next: showValue(f.key, change?.[f.key] ?? null) }))
    .filter((d) => d.now !== d.next);
}

// ---- Counting, for the owner's "This week" ----

// The Monday a week starts on, as 'YYYY-MM-DD'. Counts are kept per place and week.
export function weekOf(date = new Date()) {
  return millisToDay(time.startOfWeek(new Date(date)).getTime());
}

export function lastWeek(date = new Date()) {
  return weekOf(time.addDays(time.startOfWeek(new Date(date)), -7));
}

export function statId(place, week) {
  return `${place}_${week}`;
}

// Each phone counts a place at most once a day for being seen and once for a tap, so the
// numbers mean "people", roughly, not redraws. Given what's been counted today
// ({ day, seen: [ids], taps: [ids] }), returns the ids still to count and the record to save.
export function toCount(record, kind, ids, now = new Date()) {
  const day = millisToDay(now.getTime());
  const today = record?.day === day ? record : { day, seen: [], taps: [] };
  const done = new Set(Array.isArray(today[kind]) ? today[kind] : []);
  const fresh = [...new Set(ids)].filter((id) => typeof id === 'string' && id && !done.has(id));
  return { fresh, record: { ...today, [kind]: [...done, ...fresh] } };
}

// ---- The owner's own card ----

// A place as stored (or with a change on top) → what Spots shows for it: { id, name, line, deal,
// until, address, link, hours, menu }. The deal only while it's on, as on Spots.
export function cardPreview(place, now = Date.now()) {
  if (!place) return null;
  const ends = Number.isFinite(place.dealEnds) ? place.dealEnds : null;
  const over = ends != null && time.addDays(time.startOfDay(new Date(ends)), 1).getTime() <= now;
  const deal = !over && place.deal ? String(place.deal) : null;
  return {
    id: String(place.id || ''),
    name: String(place.name || ''),
    line: place.line || '',
    deal,
    until: deal && ends != null ? `Until ${new Date(ends).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : '',
    address: place.address || '',
    link: cleanLink(place.link) || null,
    hours: place.hours || '',
    menu: cleanLink(place.menu) || null,
  };
}

// The card with a waiting change on top, to show the owner how it will look.
export function withChange(place, change) {
  if (!place) return null;
  if (!change) return place;
  const out = { ...place };
  for (const key of KEYS) out[key] = change[key] ?? (key === 'dealEnds' ? null : '');
  return out;
}

// Where an owner is with setting up, from what's known:
//   'signed-out', 'unconfirmed' (email not confirmed yet), 'loading', 'linked',
//   'asked' (a request to be listed is waiting), 'refused' (it wasn't accepted), or 'new'.
export function setupStep({ user, loaded, owner, request }) {
  if (!user) return 'signed-out';
  if (!user.verified) return 'unconfirmed';
  if (!loaded) return 'loading';
  if (owner) return 'linked';
  if (request?.status === 'waiting') return 'asked';
  if (request?.status === 'rejected') return 'refused';
  return 'new';
}
