// Rules that shops and societies share for looking after their own card, without any screen
// code, so they can be tested: the codes the team hands out, the weekly counts, and plain words
// for what went wrong. Each kind of card keeps its own fields and their checks (with Folio's
// check.form()).

import { time } from 'folio';

// ---- Codes ----

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

// ---- Counting, for How it's going ----

// The Monday a week starts on, as 'YYYY-MM-DD'. Counts are kept per card and week.
export function weekOf(date = new Date()) {
  return time.dayKey(time.startOfWeek(new Date(date)));
}

export function lastWeek(date = new Date()) {
  return weekOf(time.addDays(time.startOfWeek(new Date(date)), -7));
}

// This week and the weeks before it, newest first: ['2026-11-02', '2026-10-26', …].
export function weeksBack(n, date = new Date()) {
  const monday = time.startOfWeek(new Date(date));
  return Array.from({ length: n }, (_, i) => weekOf(time.addDays(monday, -7 * i)));
}

// The counts for the bars, oldest first, from what the database gave (newest first, as
// weeksBack asks): [{ week, seen, taps, label }] with labels like '12 Oct'. Missing weeks are 0.
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

// One plain sentence about this week, e.g. '48 students saw your shop on Spots this week, up
// from 18 last week. 5 students tapped your Menu or Website.' `words` says what was seen
// ('your shop on Spots') and what was tapped ('your Menu or Website').
export function trendSentence(points, words) {
  const now = points?.[points.length - 1];
  const before = points?.[points.length - 2];
  if (!now) return '';
  const people = (n) => `${n} ${n === 1 ? 'student' : 'students'}`;
  let line = `${people(now.seen)} saw ${words.seen} this week`;
  if (before && before.seen !== now.seen) line += `, ${now.seen > before.seen ? 'up' : 'down'} from ${before.seen} last week`;
  line += '.';
  if (now.taps) line += ` ${people(now.taps)} tapped ${words.taps}.`;
  return line;
}

export function statId(card, week) {
  return `${card}_${week}`;
}

// Each phone counts a card at most once a day for being seen and once for a tap, so the
// numbers mean "people", roughly, not redraws. Given what's been counted today
// ({ day, seen: [ids], taps: [ids] }), returns the ids still to count and the record to save.
export function toCount(record, kind, ids, now = new Date()) {
  const day = time.dayKey(now);
  const today = record?.day === day ? record : { day, seen: [], taps: [] };
  const done = new Set(Array.isArray(today[kind]) ? today[kind] : []);
  const fresh = [...new Set(ids)].filter((id) => typeof id === 'string' && id && !done.has(id));
  return { fresh, record: { ...today, [kind]: [...done, ...fresh] } };
}

// ---- What went wrong, in plain words ----

export function explain(err) {
  switch (err?.message) {
    case 'bad-code': return 'We couldn\'t find that code. Check it, or ask us for a new one.';
    case 'used-code': return 'That code has already been used by another account. Ask us for a new one.';
    case 'signed-out': return 'Sign in first.';
    case 'unverified': return 'Confirm your email address first: tap the link in the email we sent you.';
    case 'load': return 'Couldn\'t connect. Check you\'re online and try again.';
    default:
      if (err?.code === 'permission-denied') return 'That isn\'t allowed. If you think it should be, email mobiledurham.help@gmail.com.';
      if (err?.code === 'unavailable') return 'Couldn\'t connect. Check you\'re online and try again.';
      return 'Something went wrong. Please try again.';
  }
}
