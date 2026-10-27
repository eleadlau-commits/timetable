// Rules for the places on Spots, without any screen code, so they can be tested.
//
// Each place is a document in the database's 'spots' collection, typed in by the team in the
// Firebase console. People type, so everything is checked and tidied here: anything that
// doesn't make sense is left out rather than shown wrong.

import { time } from 'folio';

// The kinds of place, as Spots' cards know them. Typed as 'cafe', 'Café', 'cafes', … all work.
export const KINDS = ['cafes', 'pubs', 'clubs'];

// How long the saved copy is used before asking the database again. Every look counts against
// the free plan's daily reads (one per place), so the app doesn't ask more often than this.
export const FRESH_FOR = 6 * time.HOUR;

// The most places asked for at once (the database's rules refuse a bigger ask).
export const MOST = 100;

const LIMITS = { name: 60, line: 120, deal: 120, address: 120 };

export function kindOf(text) {
  const plain = String(text || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const kind = plain.endsWith('s') ? plain : `${plain}s`;
  return KINDS.includes(kind) ? kind : null;
}

function words(value, most) {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > most ? `${text.slice(0, most - 1).trimEnd()}…` : text;
}

// Only proper web addresses, so a link can't run code.
export function webLink(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

// A date from the database (a Timestamp, a Date, a number or text), as a time in ms, or null.
export function toMillis(value) {
  if (value == null || value === '') return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

// One document from the database, tidied: { id, kind, name, line, deal, dealEnds, address, link,
// order }, or null if it can't be shown (not published, no name, or a kind Spots doesn't have).
export function toPlace(id, data) {
  if (!data || data.published !== true) return null;
  const kind = kindOf(data.kind);
  const name = words(data.name, LIMITS.name);
  if (!kind || !name) return null;
  return {
    id: String(id),
    kind,
    name,
    line: words(data.line, LIMITS.line),
    deal: words(data.deal, LIMITS.deal) || null,
    dealEnds: toMillis(data.dealEnds),
    address: words(data.address, LIMITS.address),
    link: webLink(data.link),
    order: Number.isFinite(data.order) ? data.order : 50,
  };
}

// The deal, if there is one and it hasn't ended. A deal ends at the end of its last day.
export function liveDeal(place, now = Date.now()) {
  if (!place?.deal) return null;
  if (place.dealEnds != null && time.addDays(time.startOfDay(new Date(place.dealEnds)), 1).getTime() <= now) return null;
  return place.deal;
}

const byOrder = (a, b) => a.order - b.order || a.name.localeCompare(b.name);

// The places of one kind, in the team's order (then by name).
export function placesOf(places, kind) {
  return (places || []).filter((p) => p.kind === kind).sort(byOrder);
}

// Every place with a deal on now, in the team's order.
export function withDeals(places, now = Date.now()) {
  return (places || []).filter((p) => liveDeal(p, now)).sort(byOrder);
}

// "Until 30 Nov", or '' if the deal has no end.
export function dealUntil(place) {
  if (place?.dealEnds == null) return '';
  return `Until ${new Date(place.dealEnds).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

export function isStale(saved, now = Date.now()) {
  return !saved || !Number.isFinite(saved.at) || now - saved.at >= FRESH_FOR || saved.at > now;
}
