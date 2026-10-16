// The to-do list's rules, without any screen code, so they're easy to test.
//
// A to-do: { id, text, tag: tag id or null, due: 'YYYY-MM-DD' or null, done: true/false, added: time }
// A tag:   { id, name }
// Dates are kept as 'YYYY-MM-DD' (the phone's own day), so a due date never shifts with time zones.

export const DEFAULT_TAGS = [
  { id: 'academic', name: 'Academic' },
  { id: 'society', name: 'Society' },
];

const pad = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DD' for a Date, in the phone's time zone.
export function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The Date (midnight) for a 'YYYY-MM-DD'.
export function fromDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Not ticked, and the due date has gone by (a to-do due today isn't overdue yet).
export function isOverdue(item, today = new Date()) {
  return !item.done && !!item.due && item.due < dayKey(today);
}

// By due date, soonest first; to-dos without a date go last. Ties keep the order they were added.
export function sortItems(items) {
  return [...items].sort((a, b) => {
    if (a.due !== b.due) {
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due < b.due ? -1 : 1;
    }
    return (a.added || 0) - (b.added || 0);
  });
}

// The to-dos with a tag, or all of them for 'all'.
export function filterItems(items, tagId) {
  return tagId === 'all' ? items : items.filter((item) => item.tag === tagId);
}

// A tag name is usable if it isn't empty and no other tag has it already (ignoring case).
function cleanName(tags, name, exceptId = null) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  if (tags.some((t) => t.id !== exceptId && t.name.toLowerCase() === clean.toLowerCase())) return null;
  return clean;
}

// Adds a tag. Returns { tags, tag }, or null if the name is empty or already used.
export function addTag(tags, name) {
  const clean = cleanName(tags, name);
  if (!clean) return null;
  const base = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tag';
  let id = base;
  for (let n = 2; id === 'all' || tags.some((t) => t.id === id); n++) id = `${base}-${n}`;
  const tag = { id, name: clean };
  return { tags: [...tags, tag], tag };
}

// Renames a tag. Its id stays the same, so its to-dos keep it. Returns the new tags, or null if
// the name is empty or another tag has it.
export function renameTag(tags, id, name) {
  const clean = cleanName(tags, name, id);
  if (!clean || !tags.some((t) => t.id === id)) return null;
  return tags.map((t) => (t.id === id ? { ...t, name: clean } : t));
}

// Deletes a tag. Its to-dos stay, just without a tag. Returns { tags, items }.
export function deleteTag(tags, items, id) {
  return {
    tags: tags.filter((t) => t.id !== id),
    items: items.map((item) => (item.tag === id ? { ...item, tag: null } : item)),
  };
}

// A short word for a due date: Today, Tomorrow, Yesterday, a weekday in the coming week, or the date.
export function dueLabel(due, today = new Date()) {
  const day = fromDayKey(due);
  const start = fromDayKey(dayKey(today));
  const days = Math.round((day - start) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days < 7) return day.toLocaleDateString([], { weekday: 'long' });
  const sameYear = day.getFullYear() === start.getFullYear();
  return day.toLocaleDateString([], { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' });
}
