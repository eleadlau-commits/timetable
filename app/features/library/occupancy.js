// Reads the Bill Bryson Library occupancy page and works out free seats per floor.
// No screen code here, so it can be tested on its own.
//
// The page lists each area as "free/total" under a "Level N" heading, for example
// "Level 4 … North 52/139 … East 1/132", and has a headline such as "707 free spaces".
// The headline is the library's own count, and the app shows it as the total of free seats,
// even when it doesn't match the areas added up (the page itself is sometimes out). Each floor's
// numbers are its areas added up. The reader only looks at the page's words, not its layout, so
// small changes to the page's design shouldn't break it.

export const SOURCE = 'https://apps.dur.ac.uk/study-spaces/library/bill-bryson/occupancy/display';

// Words that label numbers rather than name an area.
const NOISE = /^(?:free|spaces?|seats?|study|available|of|out|total|capacity|occupancy|high|average|low|full|busy|quiet|level|floor|wing|area|zone|and|the|[-–:•|])(?:\s+|$)/i;

function isNoise(name) {
  let rest = name.trim();
  while (rest) {
    const m = rest.match(NOISE);
    if (!m) return false;
    rest = rest.slice(m[0].length).trim();
  }
  return true;
}

// The text of an HTML page, one piece per text node, in reading order.
export function textOf(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, noscript, template').forEach((n) => n.remove());
  const pieces = [];
  const walk = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (t) pieces.push(t);
  }
  return pieces.join('\n');
}

// The library's own count of free seats ("707 free spaces"), or null if the page has none.
export function headline(text) {
  const m = text.match(/(\d[\d,]*)\s+(?:free|available)\s+(?:study\s+)?(?:spaces|seats)\b/i);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

// → { free, seats, counted, floors: [{ name, free, seats, zones: [{ name, free, seats }] }] },
//   or null if the page has no seat numbers. `free` is the library's own headline count when the
//   page has one; `counted` is the floors added up. `seats` is every seat on the floors (never
//   fewer than `free`, so the bar stays sensible).
export function readOccupancy(text) {
  const words = /(?:level|floor)\s*(\d+)|(\d+)\s*(?:\/|of|out of)\s*(\d+)|((?!(?:level|floor)\b)[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’&.-]*(?: (?!(?:level|floor)\b)[A-Za-zÀ-ÿ'’&.-]+)*)/gi;
  const floors = [];
  let floor = null;
  let name = null;
  for (const m of text.matchAll(words)) {
    if (m[1] !== undefined) {
      const label = `Level ${Number(m[1])}`;
      floor = floors.find((f) => f.name === label);
      if (!floor) floors.push((floor = { name: label, zones: [] }));
      name = null;
    } else if (m[2] !== undefined) {
      const free = Number(m[2]);
      const seats = Number(m[3]);
      if (!seats || free > seats) continue;
      if (!floor) floors.push((floor = { name: 'Other', zones: [] }));
      const zone = name || `Area ${floor.zones.length + 1}`;
      // Pages sometimes show the same numbers twice (say, a map and a list); keep the first.
      if (!floor.zones.some((z) => z.name === zone)) floor.zones.push({ name: zone, free, seats });
      name = null;
    } else if (m[4].length <= 30 && !isNoise(m[4])) {
      name = m[4].trim();
    }
  }

  const used = floors.filter((f) => f.zones.length);
  if (!used.length) return null;
  for (const f of used) {
    f.free = f.zones.reduce((n, z) => n + z.free, 0);
    f.seats = f.zones.reduce((n, z) => n + z.seats, 0);
  }
  const counted = used.reduce((n, f) => n + f.free, 0);
  const free = headline(text) ?? counted;
  return {
    free,
    seats: Math.max(used.reduce((n, f) => n + f.seats, 0), free),
    counted,
    floors: used,
  };
}

// How busy a place is, from its free and total seats. The bands match the library's own page.
export function busyness(free, seats) {
  if (!seats || free <= 0) return { id: 'full', label: 'Full' };
  const share = free / seats;
  if (share > 0.5) return { id: 'quiet', label: 'Plenty of seats' };
  if (share > 0.25) return { id: 'average', label: 'Fairly busy' };
  return { id: 'busy', label: 'Busy' };
}
