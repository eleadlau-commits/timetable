// Rules for the Your shop tab, without any screen code, so they can be tested.

// The cards to show, in order: those whose visible() isn't false. A card whose visible() throws
// is left out rather than breaking the page.
export function cardsToShow(items) {
  return (items || [])
    .filter((item) => {
      try {
        return typeof item?.render === 'function' && (typeof item.visible !== 'function' || item.visible() !== false);
      } catch {
        return false;
      }
    })
    .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
}

// The shop's name for the top of the tab: the first card that gives one, or ''.
export function headingOf(items) {
  for (const item of items || []) {
    try {
      const name = typeof item?.heading === 'function' ? item.heading() : null;
      if (typeof name === 'string' && name.trim()) return name.trim();
    } catch { /* try the next */ }
  }
  return '';
}
