// Small rules for the Home screen that don't need the screen, so they can be tested on their own.

// The clock's time without "AM"/"PM", and that part on its own ('' on a 24-hour phone).
// clockParts(15:13) → { time: '15:13', period: '' } in the UK, { time: '3:13', period: 'PM' } in the US.
export function clockParts(date, locale = undefined) {
  const parts = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).formatToParts(date);
  const period = parts.find((p) => p.type === 'dayPeriod')?.value || '';
  const time = parts.filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim();
  return { time, period };
}

// What a Home slot shows, from what its items gave back (in order): the elements to show, or,
// if there are none, why not. An item gives an element; or what's missing, as a short text or as
// { missing: text, action?() } (tapping the placeholder then runs action); or null to leave the
// place to the others.
export function slotContent(results) {
  const isMissing = (r) => typeof r === 'string' || (r && typeof r === 'object' && 'missing' in r && !(r instanceof Node));
  const shown = results.filter((r) => r != null && r !== false && !isMissing(r));
  if (shown.length) return { shown, missing: null, action: null };
  const first = results.find((r) => isMissing(r) && (typeof r === 'string' ? r : r.missing));
  if (!first) return { shown: [], missing: '', action: null };
  return typeof first === 'string'
    ? { shown: [], missing: first, action: null }
    : { shown: [], missing: first.missing, action: first.action || null };
}

// "Missing content: add your timetable", or just "Missing content".
export const missingText = (reason) => (reason ? `Missing content: ${reason}` : 'Missing content');
