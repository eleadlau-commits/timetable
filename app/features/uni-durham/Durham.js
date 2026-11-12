// Durham University's pack: everything the app knows that is only true at Durham. It has no
// screens; it adds one item to the University feature's 'university.packs' slot, and other
// features ask the 'university' service. To add another university, copy this folder (as
// uni-<name>), change the facts, and keep the same shape.

import { Feature } from 'folio';
import { lookupPlace } from './rooms.js';
import { INTRO, STEPS, PICTURES, PRIVATE } from './guide.js';

// Bill Bryson Library's public page of free seats (read by the library feature).
export const LIBRARY_PAGE = 'https://apps.dur.ac.uk/study-spaces/library/bill-bryson/occupancy/display';

export default class Durham extends Feature {
  start() {
    this.add('university.packs', {
      id: 'durham',
      order: 10,
      name: 'Durham University',
      short: 'Durham',
      town: 'Durham',
      timetableHosts: ['mytimetable.durham.ac.uk'],
      guide: { intro: INTRO, steps: STEPS, pictures: PICTURES, private: PRIVATE },
      rooms: { lookup: lookupPlace },
      libraries: [{ id: 'bill-bryson', name: 'Bill Bryson Library', page: LIBRARY_PAGE }],
      photo: new URL('photos/durham.jpg', import.meta.url).href,
      yearStart: 8, // September
    });
  }
}
