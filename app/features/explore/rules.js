// Rules for the Explore tab, without any screen code, so they can be tested.

// The cards to show, in order: those whose visible() isn't false. A card whose visible() throws
// is left out rather than breaking the tab.
export function cardsToShow(items) {
  return (items || [])
    .filter((item) => {
      try {
        return typeof item?.onClick === 'function' && (typeof item.visible !== 'function' || item.visible() !== false);
      } catch {
        return false;
      }
    })
    .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
}
