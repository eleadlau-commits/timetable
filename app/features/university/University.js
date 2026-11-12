// University: which university the app is set up for, and what it knows about it. The facts
// themselves come from university packs (folders like uni-durham, marked "kind": "pack"), which
// add one item each to the 'university.packs' slot. Everything else asks this feature, so no
// feature needs to know about Durham, and each copes when there's no answer (no pack, or a pack
// without, say, a library).
//
// Slot 'university.packs': { id, name, short, town, order?, timetableHosts?, guide?, rooms?,
//   libraries?, photo?, yearStart? } (see README.md for each).
//
// Service 'university':
//   pack()          the chosen pack, or null
//   packs()         every pack
//   name()          'Durham University', or null
//   short()         'Durham', or null
//   town()          'Durham', or null (the town Spots are in)
//   guide()         the timetable setup guide { intro, steps, pictures, private }, or null
//   libraries()     [{ id, name, page }], or []
//   photo()         the address of Home's photo, or null
//   yearStart()     the academic year's first month (0–11), September unless the pack says
//   lookupRoom(t)   { code, room, building, address, lat, lng } for a room as written, or null
//   packForLink(l)  the pack whose timetable server a link points at, or null
//   choose(id)      switches pack and sends 'university:changed' (nothing on screen offers it
//                   yet: there's only one pack)
//
// Service 'places': { lookup(location) }, the same as lookupRoom, for Maps.
//
// Saved data: 'choice' → the chosen pack's id (only once someone chooses; until then the first pack)

import { Feature } from 'folio';
import { choosePack, yearStart, packForLink } from './rules.js';

export default class University extends Feature {
  start() {
    this.defineSlot('university.packs', "One university's facts, from its pack. Item: { id, name, short, town, order?, timetableHosts?, guide?: { intro, steps, pictures, private }, rooms?: { lookup(location) }, libraries?: [{ id, name, page }], photo?, yearStart? }.");
    this.provide('university', this);
    this.provide('places', { lookup: (location) => this.lookupRoom(location) });
  }

  packs() {
    return this.slot('university.packs').items;
  }

  pack() {
    return choosePack(this.packs(), this.storage.get('choice', null));
  }

  name() { return this.pack()?.name || null; }
  short() { return this.pack()?.short || null; }
  town() { return this.pack()?.town || null; }
  guide() { return this.pack()?.guide || null; }
  libraries() { return this.pack()?.libraries || []; }
  photo() { return this.pack()?.photo || null; }
  yearStart() { return yearStart(this.pack()); }

  lookupRoom(location) {
    const rooms = this.pack()?.rooms;
    if (!rooms || !location) return null;
    try {
      return rooms.lookup(location) || null;
    } catch {
      return null;
    }
  }

  packForLink(link) {
    return packForLink(this.packs(), link);
  }

  choose(id) {
    if (!this.packs().some((p) => p.id === id) || id === this.pack()?.id) return;
    this.storage.set('choice', id);
    this.emit('university:changed', { id });
    this.refresh();
  }
}
