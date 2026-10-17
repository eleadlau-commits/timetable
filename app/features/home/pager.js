// The rules for swiping between the pages at the top of Home, without any screen code, so
// they're easy to test.

// How far the pages move while a finger drags them dx pixels. At the first and last page they
// only give a little, to show there's nothing more that way.
export function dragOffset(index, dx, count) {
  const pastStart = index === 0 && dx > 0;
  const pastEnd = index >= count - 1 && dx < 0;
  return pastStart || pastEnd ? dx * 0.3 : dx;
}

// The page to settle on when the finger lets go: the next or previous one if it was dragged a
// fifth of the way, or flicked; otherwise the same one. Never past the first or last page.
export function settle(index, dx, width, count, { fast = false } = {}) {
  const far = Math.abs(dx) > width / 5 || (fast && Math.abs(dx) > 30);
  if (!far) return index;
  return Math.max(0, Math.min(count - 1, index + (dx < 0 ? 1 : -1)));
}
