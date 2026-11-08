// Rules for societies, without any screen code, so they can be tested.
//
// Each society is a document in the database's 'societies' collection, typed in by the team in
// the Firebase console. People type, so everything is checked and tidied here: anything that
// doesn't make sense is left out rather than shown wrong.

// The kinds of society, in the order the list shows them: [id, name].
export const TYPES = [
  ['sport', 'Sport'],
  ['academic', 'Academic'],
  ['arts', 'Arts and music'],
  ['culture', 'Culture'],
  ['faith', 'Faith'],
  ['volunteering', 'Volunteering'],
  ['other', 'Other'],
];
const TYPE_IDS = TYPES.map(([id]) => id);

// How long the saved copy is used before asking the database again (one read per society).
export const FRESH_FOR = 12 * 60 * 60 * 1000;

// The most societies asked for at once (the database's rules refuse a bigger ask).
export const MOST = 300;

const LIMITS = { name: 60, line: 140, meets: 120, fee: 60 };

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

// 'sport', 'Sports', ' SPORT ' → 'sport'; anything unknown → 'other'.
export function typeOf(value) {
  const plain = String(value || '').trim().toLowerCase();
  const found = TYPE_IDS.find((id) => plain === id || plain === `${id}s`);
  return found || 'other';
}

export function typeName(id) {
  return (TYPES.find(([t]) => t === id) || TYPES[TYPES.length - 1])[1];
}

// An Instagram account as typed ('@durhamhiking', 'durhamhiking', or the full address) → its
// https address, or null.
export function instagramLink(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  if (/^https:\/\/(www\.)?instagram\.com\//i.test(text)) return webLink(text);
  const handle = text.replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : null;
}

// A photo: an https address, or the name of a picture in this feature's photos/ folder
// ('hiking.jpg'), which comes with the app. null for anything else.
export function photoOf(value, folder) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const name = value.trim();
  if (/^[a-z0-9][a-z0-9_-]*\.(jpe?g|png|webp)$/i.test(name)) return folder ? new URL(`photos/${name}`, folder).href : null;
  return webLink(name);
}

// One document from the database, tidied: { id, type, name, line, meets, fee, instagram, join,
// photo, order }, or null if it can't be shown (not published, or no name).
export function toSociety(id, data, folder = null) {
  if (!data || data.published !== true) return null;
  const name = words(data.name, LIMITS.name);
  if (!name) return null;
  return {
    id: String(id),
    type: typeOf(data.type),
    name,
    line: words(data.line, LIMITS.line),
    meets: words(data.meets, LIMITS.meets),
    fee: words(data.fee, LIMITS.fee),
    instagram: instagramLink(data.instagram),
    join: webLink(data.join),
    photo: photoOf(data.photo, folder),
    order: Number.isFinite(data.order) ? data.order : 50,
  };
}

const plain = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// The societies to show: of one type (or 'all'), matching what's typed in the search (any word,
// in the name or line), in the team's order, then by name.
export function pick(list, type = 'all', search = '') {
  const words = plain(search).split(/\s+/).filter(Boolean);
  return (list || [])
    .filter((s) => type === 'all' || s.type === type)
    .filter((s) => {
      const text = plain(`${s.name} ${s.line}`);
      return words.every((w) => text.includes(w));
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

// The types that have at least one society, in TYPES order, with how many: [{ id, name, count }].
export function typesIn(list) {
  return TYPES
    .map(([id, name]) => ({ id, name, count: (list || []).filter((s) => s.type === id).length }))
    .filter((t) => t.count > 0);
}

export function isStale(saved, now = Date.now()) {
  return !saved || !Number.isFinite(saved.at) || now - saved.at >= FRESH_FOR || saved.at > now;
}

// The list of every published society in one document (lists/societies, made by the team's phones,
// see the card-owners feature): its items as [[id, data]], or null if there's no usable list
// (then the app reads the societys one by one). Reading the list costs 1 read instead of one per
// society.
export function fromList(data) {
  const items = data?.items;
  if (!items || typeof items !== 'object' || Array.isArray(items)) return null;
  return Object.entries(items).filter(([, d]) => d && typeof d === 'object' && d.published === true);
}
