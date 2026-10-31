// The groups on the Help page and how questions are sorted into them, without any screen code,
// so it can be tested. To add a group, add it here; features name it by its id.

export const GROUPS = [
  { id: 'start', title: 'Getting started' },
  { id: 'timetable', title: 'Your timetable' },
  { id: 'home', title: 'Home and the tabs' },
  { id: 'study', title: 'Studying' },
  { id: 'around', title: 'Around Durham' },
  { id: 'friends', title: 'Friends' },
  { id: 'business', title: 'For businesses' },
  { id: 'account', title: 'Your account' },
  { id: 'privacy', title: 'Privacy and your data' },
  { id: 'app', title: 'About the app' },
];

const OTHER = { id: 'other', title: 'Other questions' };

// Questions in their groups, in the order above, each group sorted by `order` (then by the
// question). Questions naming a group that isn't listed go in "Other questions" at the end.
// Empty groups are left out. → [{ id, title, items }]
export function arrange(items, groups = GROUPS) {
  const known = new Set(groups.map((g) => g.id));
  const sorted = [...items]
    .filter((item) => item && item.question)
    .sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || String(a.question).localeCompare(String(b.question)));
  return [...groups, OTHER]
    .map((g) => ({ ...g, items: sorted.filter((item) => (known.has(item.group) ? item.group : 'other') === g.id) }))
    .filter((g) => g.items.length);
}
