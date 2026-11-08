// Listings: the places on the Spots tab (cafés, pubs and clubs, with their student deals), from
// the online database's 'spots' collection. The team adds and changes them in the Firebase
// console; the app only reads them, and the database's rules (firebase/firestore.rules) refuse
// any change from the app. Everyone can read them, signed in or not.
//
// The places are kept on the phone, so Spots shows them straight away and offline, and the
// database is asked again only when the saved copy is older than FRESH_FOR (rules.js), to stay
// well inside the free plan's daily reads. It reads lists/spots, every published place in one
// document (1 read, kept up to date by the team's phones: see the card-owners feature), and only
// reads the places one by one if that list isn't there.
//
// Saved data: 'saved' → { at (ms), places: [{ id, kind, name, line, deal, dealEnds, address, link, hours, open, photo, menu, order }] }

import { Feature } from 'folio';
import { toPlace, placesOf, withDeals, liveDeal, dealUntil, isStale, fromList, MOST } from './rules.js';

export default class Listings extends Feature {
  start() {
    this.account = this.use('account');
    this.saved = this.storage.get('saved', null);
    this.add('spots.places', {
      places: (kind) => placesOf(this.list, kind).map((place) => this.forSpots(place)),
      deals: () => withDeals(this.list).map((place) => this.forSpots(place)),
      update: () => this.update(),
    });
  }

  get list() {
    return Array.isArray(this.saved?.places) ? this.saved.places : [];
  }

  // What Spots shows for a place: the deal only while it's on.
  forSpots(place) {
    const deal = liveDeal(place);
    return {
      id: place.id, name: place.name, line: place.line, address: place.address, link: place.link,
      hours: place.hours || '', open: place.open || '', photo: place.photo || null, menu: place.menu || null,
      deal, until: deal ? dealUntil(place) : '',
    };
  }

  // Asks the database again if the saved copy is old (at most once at a time, and not offline).
  update() {
    if (this.loading || !navigator.onLine || !this.account || !isStale(this.saved)) return;
    if (this.failedAt && Date.now() - this.failedAt < 5 * 60000) return;
    this.loading = this.load()
      .catch(() => { this.failedAt = Date.now(); })
      .finally(() => { this.loading = null; });
  }

  async load() {
    const db = await this.account.publicDatabase();
    const places = (await this.fromList(db) || await this.oneByOne(db))
      .map(([id, data]) => toPlace(id, data, import.meta.url)).filter(Boolean);
    const changed = JSON.stringify(places) !== JSON.stringify(this.list);
    this.saved = { at: Date.now(), places };
    this.storage.set('saved', this.saved);
    if (changed) this.refresh();
  }

  // Every published place in one document (1 read), or null if there's no list yet.
  async fromList(db) {
    const snap = await db.doc('lists/spots').get().catch(() => null);
    return snap?.exists ? fromList(snap.data()) : null;
  }

  // The places one by one (a read each): before the team's phone has made the list.
  async oneByOne(db) {
    const snap = await db.collection('spots').where('published', '==', true).limit(MOST).get();
    return snap.docs.map((d) => [d.id, d.data()]);
  }
}
