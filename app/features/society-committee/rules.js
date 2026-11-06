// Rules for society committees, without any screen code, so they can be tested: checking what a
// committee types, and what changed. The codes, the weekly counts and the rest that shops share
// are the card-owners feature's.

import { check } from 'folio';

// ---- What a committee can change ----

// In the order the form shows them. The limits are the ones the societies feature shows, and
// the ones the database checks.
export const FIELDS = [
  { key: 'line', label: 'Short line', hint: 'What your society does, e.g. "Day walks in the Dales, all levels welcome"', most: 140 },
  { key: 'meets', label: 'When and where you meet', hint: 'e.g. "Wednesdays 7pm, Elvet Riverside"', most: 120 },
  { key: 'fee', label: 'Joining fee', hint: 'e.g. "£5 a year" or "Free"', most: 60 },
  {
    key: 'instagram', label: 'Instagram', hint: 'Your account, e.g. @durhamhiking', type: 'instagram',
    clean: (v) => cleanInstagram(v), wrong: 'Instagram: type your account name, like @durhamhiking.',
  },
  { key: 'join', label: 'Join link', hint: 'Your sign-up page, e.g. on the Students\' Union website', type: 'link' },
];
export const KEYS = FIELDS.map((f) => f.key);

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
  const { values, error } = check.form(FIELDS, form);
  return error ? { error } : { change: values };
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

// How it's going's sentence: what students saw and tapped (card-owners' trendSentence()).
export const TREND_WORDS = { seen: 'your society', taps: 'Instagram or Join' };

// ---- Where a committee member is ----

// 'signed-out', 'unconfirmed' (email not confirmed yet), 'loading', 'linked' or 'new'.
export function setupStep({ user, loaded, mine }) {
  if (!user) return 'signed-out';
  if (!user.verified) return 'unconfirmed';
  if (mine) return 'linked';
  if (!loaded) return 'loading';
  return 'new';
}
