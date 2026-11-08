// Small rules about sessions that don't need the screen, so they can be tested on their own.

// Sessions are grouped into modules by their code (e.g. "ECON1011"), or by title if there's no code.
const CODE_RE = /\b[A-Z]{2,5}\s?\d{3,5}[A-Z]?\b/;

export function moduleKey(title) {
  const m = title.match(CODE_RE);
  return m ? m[0].replace(/\s/g, '') : title.trim();
}

// A colour (hue, 0–360) worked out from the module, so each module keeps the same colour.
export function hueFor(key) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}

const KINDS = ['Lecture', 'Seminar', 'Tutorial', 'Practical', 'Workshop', 'Lab', 'Exam', 'Drop-in', 'Fieldwork']
  .map((k) => [k, new RegExp(`\\b${k}`, 'i')]);

// "Lecture", "Seminar", … from the title, or else the start of the description. '' if unknown.
export function kindOf(session) {
  for (const [kind, re] of KINDS) if (re.test(session.title)) return kind;
  const description = (session.description || '').slice(0, 300);
  for (const [kind, re] of KINDS) if (re.test(description)) return kind;
  return '';
}

// The module's name from a title, without its code or session type:
// "MATH2811 - Mathematical Methods II Lecture" → "Mathematical Methods II". '' if nothing is left.
export function moduleTitle(title) {
  let t = (title || '').replace(new RegExp(CODE_RE.source, 'g'), ' ');
  for (const [, re] of KINDS) t = t.replace(new RegExp(`${re.source}s?\\b`, 'gi'), ' ');
  t = t.replace(/\b(group|grp)\s*\w{1,3}\b/gi, ' ') // "Group 3", "Grp A"
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:/|,.·]+|[\s\-–—:/|,.·]+$/g, '')
    .trim();
  return /[A-Za-z]{2}/.test(t) ? t : '';
}

// The text and URL of a location that is itself a web link (e.g. a Teams meeting), or null.
export function webLink(location) {
  return (location || '').match(/https?:\/\/\S+/)?.[0] || null;
}
