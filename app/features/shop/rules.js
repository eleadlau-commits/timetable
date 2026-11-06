// Rules for businesses on Spots, without any screen code, so they can be tested: checking what an
// owner types, and what changed. The codes, the weekly counts and the rest that societies share
// are the card-owners feature's.

import { time, check } from 'folio';

// ---- What owners can change ----

// Opening times as stored: seven parts, Monday first, '0800-1700' or nothing (closed). The same
// rule the database checks.
export const OPEN = /^((\d{4}-\d{4})?\|){6}(\d{4}-\d{4})?$/;

// The parts of a card an owner can change, in the order the form shows them. 'open' is the
// opening times, day by day (the spots feature's hours.js); 'hours' is the same as a short line
// ("Mon–Fri 8am–5pm"), written from them, so older versions of the app still show something.
// Without Spots' opening-times helpers, the form asks for 'hours' as typed text instead.
export const FIELDS = [
  { key: 'line', label: 'Short line', hint: 'What you are, in a few words, e.g. "Brunch and coffee by the river"', most: 120, part: 'details' },
  { key: 'deal', label: 'Student deal', hint: 'e.g. "10% off with your campus card". Leave it empty for no deal.', most: 120, part: 'deal' },
  { key: 'dealEnds', label: 'Last day of the deal', hint: 'Leave it empty if it keeps going.', type: 'date', part: 'deal' },
  {
    key: 'open', label: 'Opening times', type: 'week', part: 'details',
    clean: (v) => (!v || OPEN.test(String(v)) ? String(v ?? '') : null),
    wrong: 'Opening times: give each open day a time it opens and a different time it closes.',
  },
  { key: 'hours', label: 'Opening hours', hint: 'e.g. "Mon–Fri 8–6, Sat 9–5"', most: 120, part: 'details' },
  { key: 'link', label: 'Website', hint: 'https://…', type: 'link', part: 'details' },
  { key: 'menu', label: 'Menu link', hint: 'A page or PDF with your menu', type: 'link', part: 'details' },
];
export const KEYS = FIELDS.map((f) => f.key);

// The kinds of place, as the database has them, and their names.
export const KINDS = [['cafe', 'Café'], ['pub', 'Pub'], ['club', 'Club']];

// ms → 'YYYY-MM-DD', for a date box.
export function millisToDay(ms) {
  return Number.isFinite(ms) ? time.dayKey(ms) : '';
}

// What an owner typed in the form → { change: { line, deal, dealEnds, hours, link, menu } }, or
// { error: 'what to fix' }. dealEnds is ms or null.
export function checkEdit(form, now = Date.now()) {
  const { values: change, error } = check.form(FIELDS, form);
  if (error) return { error };
  if (change.dealEnds != null && !change.deal) return { error: 'There\'s an end date but no deal. Type the deal, or clear the date.' };
  if (change.dealEnds != null && change.dealEnds < time.startOfDay(new Date(now)).getTime()) {
    return { error: 'The deal\'s last day has already gone. Choose a later day, or clear the date.' };
  }
  return { change };
}

// A business asking to be listed → { request: { kind, name, address, contact, …the card } } or
// { error }.
export function checkRequest(form, now = Date.now()) {
  const name = check.tidy(form?.name, 60);
  if (!name) return { error: 'Type the name of your place.' };
  if (!KINDS.some(([k]) => k === form?.kind)) return { error: 'Choose what kind of place it is.' };
  const contact = check.tidy(form?.contact, 120);
  if (!contact) return { error: 'Add a phone number or email, so we can get in touch.' };
  const card = checkEdit(form, now);
  if (card.error) return card;
  return { request: { kind: form.kind, name, address: check.tidy(form?.address, 120), contact, ...card.change } };
}

// ---- What changed ----

// How a value looks to the person approving it.
export function showValue(key, value) {
  if (key === 'dealEnds') return Number.isFinite(value) ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return value || '';
}

// The parts of a card that a change changes: [{ key, label, now, next }], shown as text.
export function differences(place, change) {
  // The opening times show as their short line ('hours'), which changes with them.
  return FIELDS
    .filter((f) => f.type !== 'week')
    .map((f) => ({ key: f.key, label: f.label, now: showValue(f.key, place?.[f.key] ?? null), next: showValue(f.key, change?.[f.key] ?? null) }))
    .filter((d) => d.now !== d.next);
}

// ---- The owner's own card ----

// A place as stored (or with a change on top) → what Spots shows for it: { id, name, line, deal,
// until, address, link, hours, open, photo, menu }. The deal only while it's on, as on Spots.
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
    link: check.link(place.link) || null,
    hours: place.hours || '',
    open: typeof place.open === 'string' && OPEN.test(place.open) ? place.open : '',
    photo: typeof place.photo === 'string' && /^https:\/\/\S+$/.test(place.photo) ? place.photo : null,
    menu: check.link(place.menu) || null,
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

// How it's going's sentence: what students saw and tapped (card-owners' trendSentence()).
export const TREND_WORDS = { seen: 'your shop on Spots', taps: 'your Menu or Website' };
