// Looking after a card: what shops (the shop feature) and society committees (the
// society-committee feature) share for looking after their own card on Spots or Explore, so it's
// written, fixed and tested once. It shows nothing itself. It offers the service 'cardOwners':
//
//   Rules (rules.js): makeCode(), cleanCode(), showCode(), weekOf(), weeksBack(n), trend(stats, weeks), trendSentence(points, { seen, taps }),
//     toCount(record, kind, ids), explain(err)
//   The database (store.js): isAdmin(db, uid), and store(config) → the steps for one kind of
//     card (codes, owners, changes waiting for approval, weekly counts), with the database
//     names that kind already uses
//   Screens (screens.js): bars(points), codeField({ id, label, noun, use }), diffList(rows),
//     approveButtons(), and new Approvals(feature, store, options): the changes waiting and the
//     codes, for the Approve changes window
//   counter(feature, store, { skip }) → count(kind, ids): counts, at most once a day per card on
//     this phone, that a card was seen or tapped. What's been counted today is kept in the
//     calling feature's own saved data ('counted'), as before.
//
// Saved data: none of its own.

import { Feature } from 'folio';
import * as rules from './rules.js';
import { makeStore, isAdmin, toMs } from './store.js';
import { bars, codeField, diffList, approveButtons, Approvals } from './screens.js';

export default class CardOwners extends Feature {
  start() {
    this.provide('cardOwners', {
      ...rules,
      isAdmin,
      toMs,
      store: (config) => makeStore(config),
      bars,
      codeField,
      diffList,
      approveButtons,
      Approvals,
      counter: (feature, store, options) => this.counter(feature, store, options),
    });
  }

  // Counting on students' phones: each phone counts a card once a day for being seen, and once
  // for a tap. Test builds ('no-count' in the feature's saved data) never count.
  counter(feature, store, { skip = () => false } = {}) {
    return async (kind, ids) => {
      const account = feature.use('account');
      if (skip() || feature.storage.get('no-count', false) || !account || !navigator.onLine) return;
      const { fresh, record } = rules.toCount(feature.storage.get('counted', null), kind, ids || []);
      if (!fresh.length) return;
      feature.storage.set('counted', record);
      try {
        const db = await account.publicDatabase();
        const week = rules.weekOf();
        for (const id of fresh) await store.count(db, account.fields, id, week, kind).catch(() => {});
      } catch { /* offline, or Firebase couldn't load: it's only a count */ }
    };
  }
}
