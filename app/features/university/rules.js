// Small rules about university packs, without the screen, so they can be tested.

// The pack to use: the one saved, if it's still there, otherwise the first by order (Durham, for
// now). null when there are no packs at all.
export function choosePack(packs, saved) {
  const list = [...packs].sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
  return list.find((p) => p.id === saved) || list[0] || null;
}

// The academic year's first month (0 = January … 8 = September), September unless the pack says.
export function yearStart(pack) {
  const m = pack?.yearStart;
  return Number.isInteger(m) && m >= 0 && m <= 11 ? m : 8;
}

// The pack whose timetable server a pasted link points at, or null. Packs list their servers'
// host names in `timetableHosts`, e.g. ['mytimetable.durham.ac.uk'].
export function packForLink(packs, link) {
  let host;
  try { host = new URL(link).hostname.toLowerCase(); } catch { return null; }
  return packs.find((p) => (p.timetableHosts || []).some((h) => host === h || host.endsWith(`.${h}`))) || null;
}
