// Where society committees' things are kept in the online database. The steps themselves (codes,
// owners, changes waiting for approval, the weekly counts) are the card-owners feature's, the
// same as for shops; these are the names the database has always used for societies. The
// database's rules (firebase/firestore.rules) check every step again, so a changed app can't do
// more.
//
//   societies/{id}             the society's card, typed in by the team (the societies feature)
//   societyCodes/{code}        { society, usedBy (uid or null), made }: a code the team hands to a
//                              committee member (one per person)
//   societyOwners/{uid}        { society, code, at }: the society this account helps run
//   societyChanges/{society}   { society, by, line, meets, fee, instagram, join, status, at }: a
//                              committee's change, 'waiting' until approved or rejected
//   societyStats/{society}_{week}  { society, week, seen, taps }: how many phones showed the
//                              society, and tapped Instagram or Join, that week (nobody's name)

import { KEYS } from './rules.js';

// The card's fields, ready to store.
export function cardFields(change) {
  return Object.fromEntries(KEYS.map((key) => [key, String(change?.[key] || '')]));
}

// For the card-owners feature's store(config). A used code can be removed by the team, which
// also stops the person who used it looking after the society (e.g. when they leave the
// committee).
export const SOCIETIES = {
  cards: 'societies',
  codes: 'societyCodes',
  owners: 'societyOwners',
  changes: 'societyChanges',
  stats: 'societyStats',
  link: 'society',
  toStore: cardFields,
  most: 300,
  removeUsed: true,
  list: 'societies',
  groupBy: 'uni',
};
