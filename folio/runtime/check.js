// Tidying what people type into forms, so every feature checks it the same way:
//
//   import { check } from 'folio';
//   check.tidy('  Brunch   by the river ', 120)   → 'Brunch by the river'
//   check.link('flatwhite.co.uk')                  → 'https://flatwhite.co.uk/'
//   check.form(fields, typed)                      → { values } or { error: 'what to fix' }

import { fromDayKey } from './time.js';

// Text on one line: spaces squashed, trimmed, at most `most` characters.
export function tidy(value, most = Infinity) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, most);
}

// A web address as typed: 'flatwhite.co.uk' becomes 'https://flatwhite.co.uk/'. '' for nothing,
// null if it isn't a proper https address (so 'javascript:…' and plain 'http://' are refused).
export function link(value) {
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

// What someone typed into a form → { values } or { error: 'what to fix' }, from a list of fields:
//   { key, label, most?, type? ('link', 'date' or anything else), clean?(value) → value or null,
//     wrong? (the message when clean gives null) }
// Text is tidied to `most` characters; 'link' must be an https address (see link()); 'date' (a
// date box's 'YYYY-MM-DD') becomes that day at midday in ms, or null if empty. A field with its
// own `clean` is checked by that instead.
export function form(fields, typed) {
  const values = {};
  for (const field of fields) {
    const value = typed?.[field.key];
    if (field.clean) {
      const clean = field.clean(value);
      if (clean === null) return { error: field.wrong || `${field.label}: check what you typed.` };
      values[field.key] = clean;
    } else if (field.type === 'link') {
      const clean = link(value);
      if (clean === null) return { error: `${field.label}: that doesn't look like a web address. It should start with https://` };
      values[field.key] = clean;
    } else if (field.type === 'date') {
      if (value && fromDayKey(value) === null) return { error: `${field.label}: choose a day.` };
      values[field.key] = fromDayKey(value);
    } else {
      values[field.key] = tidy(value, field.most);
    }
  }
  return { values };
}
