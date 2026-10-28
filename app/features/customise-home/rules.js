// The rules for the widgets the person puts on Home, kept apart from the screen code so they
// can be tested. A choice is a list, in order: [{ id, size }], e.g. [{ id: 'library', size: 'wide' }].
// Nothing saved (null) means Home's usual widgets.

// The photo choices: Home's own Durham photo, or one from the phone.
export const PHOTOS = ['durham', 'own'];

// A saved list made safe: only { id, size } pairs of names, each widget once. null if it isn't a list.
export function cleanWidgets(saved) {
  if (!Array.isArray(saved)) return null;
  const seen = new Set();
  return saved.filter((w) => w && typeof w.id === 'string' && typeof w.size === 'string' && !seen.has(w.id) && seen.add(w.id))
    .map(({ id, size }) => ({ id, size }));
}

// A new list with widget `id` in `size`: in its place if it's already there, otherwise at the end.
export function putWidget(list, id, size) {
  return list.some((w) => w.id === id)
    ? list.map((w) => (w.id === id ? { id, size } : w))
    : [...list, { id, size }];
}

export function removeWidget(list, id) {
  return list.filter((w) => w.id !== id);
}

// A new list with widget `id` moved one place earlier (-1) or later (+1).
export function moveWidget(list, id, direction) {
  const out = [...list];
  const from = out.findIndex((w) => w.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= out.length) return out;
  [out[from], out[to]] = [out[to], out[from]];
  return out;
}

// True if Home is as the app comes.
export function isOriginal(list, photo) {
  return list == null && (photo || 'durham') === 'durham';
}

// The size to shrink a photo to: no wider or taller than `max`, keeping its shape, never larger.
export function fitSize(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
