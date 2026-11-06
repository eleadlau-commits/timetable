// The Societies part of Approve changes (the shop feature's window, slot 'approve.parts'), for the
// team: committees' changes, with what's on the card now and what it would become, and making
// society codes. Drawn by the card-owners feature's Approvals, the same as the shop's own parts.

import { differences } from './rules.js';

export function societyApprovals(feature) {
  const approvals = new feature.owners.Approvals(feature, feature.store, {
    differences,
    words: {
      changes: 'Society changes',
      none: 'No society changes waiting.',
      unnamed: 'A society',
      approved: 'Approved. Students see it within 12 hours.',
      codes: 'Society codes',
      noCards: 'Add a society in the Firebase console first (see the societies README), then make its code here.',
      pickId: 'society-code-for',
      thing: 'the society',
      madeNote: 'Give it to one committee member. It works once, for one account. Make one for each person.',
      removedNote: 'The person who used it will stop looking after the society.',
    },
  });
  // The item for the 'approve.parts' slot.
  return {
    id: 'societies',
    order: 50,
    waiting: (db) => approvals.waiting(db),
    load: (db) => approvals.load(db),
    render: (window) => approvals.render(window),
  };
}
