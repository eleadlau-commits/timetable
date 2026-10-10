// Durham rooms: a built-in list of Durham University room codes, their buildings and map
// positions (in places.js). It has no screens of its own; other features ask it.
//
// Service 'places':
//   lookup(location) → { code, room, building, address, lat, lng } or null
//
// To use this app at another university, make a feature like this one with that university's
// rooms, providing the same 'places' service, and delete this folder.

import { Feature } from 'folio';
import { lookupPlace } from './places.js';

export default class DurhamRooms extends Feature {
  start() {
    this.provide('places', { lookup: lookupPlace });
  }
}
