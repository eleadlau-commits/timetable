import { test, assert } from 'folio/testing';
import {
  makeCode, cleanCode, showCode, CODE_LETTERS, weekOf, lastWeek, weeksBack, trend, trendSentence, statId, toCount, explain,
} from '../rules.js';

const SHOP = { seen: 'your shop on Spots', taps: 'your Menu or Website' };
const SOCIETY = { seen: 'your society', taps: 'Instagram or Join' };

test('codes are 8 easy-to-read letters', () => {
  const code = makeCode();
  assert.equal(code.length, 8);
  assert.ok([...code].every((c) => CODE_LETTERS.includes(c)));
  assert.ok(!/[IO01]/.test(CODE_LETTERS));
  assert.equal(makeCode(() => [0, 1, 2, 3, 31, 32, 33, 255]), 'ABCD9AB9');
  assert.ok(makeCode() !== makeCode());
});

test('codes are understood however they are typed', () => {
  assert.equal(cleanCode('k7qm 2xpa'), 'K7QM2XPA');
  assert.equal(cleanCode(' K7QM-2XPA '), 'K7QM2XPA');
  assert.equal(cleanCode('K7QM2XP'), null);
  assert.equal(cleanCode('K7QM2XPO'), null); // O isn't used
  assert.equal(cleanCode(''), null);
  assert.equal(cleanCode(null), null);
  assert.equal(showCode('K7QM2XPA'), 'K7QM-2XPA');
});

test('weeks start on Monday', () => {
  assert.equal(weekOf(new Date(2026, 10, 1)), '2026-10-26'); // a Sunday
  assert.equal(weekOf(new Date(2026, 9, 26)), '2026-10-26'); // the Monday
  assert.equal(weekOf(new Date(2026, 10, 5, 15)), '2026-11-02');
  assert.equal(lastWeek(new Date(2026, 10, 1)), '2026-10-19');
  assert.equal(statId('cafe1', '2026-10-26'), 'cafe1_2026-10-26');
});

test('four weeks of counts for How it\'s going', () => {
  const weeks = weeksBack(4, new Date(2026, 10, 4));
  assert.deepEqual(weeks, ['2026-11-02', '2026-10-26', '2026-10-19', '2026-10-12']);
  const points = trend([{ week: '2026-11-02', seen: 48, taps: 9 }, { week: '2026-10-26', seen: 18, taps: 0 }], weeks);
  assert.deepEqual(points.map((p) => p.seen), [0, 0, 18, 48]);
  assert.equal(points[0].label, '12 Oct');
  // Counts saved by an older version (this week and last week only) still read right.
  assert.deepEqual(trend([{ week: '2026-11-02', seen: 5, taps: 1 }, { week: '2026-10-26', seen: 2, taps: 0 }], weeks).map((p) => p.seen), [0, 0, 2, 5]);
  assert.deepEqual(trend(null, weeks).map((p) => p.seen), [0, 0, 0, 0]);
});

test('the sentence under the bars, in a shop\'s words and a society\'s', () => {
  const weeks = weeksBack(4, new Date(2026, 10, 4));
  const points = trend([{ week: '2026-11-02', seen: 48, taps: 9 }, { week: '2026-10-26', seen: 18, taps: 0 }], weeks);
  assert.equal(trendSentence(points, SHOP), '48 students saw your shop on Spots this week, up from 18 last week. 9 students tapped your Menu or Website.');
  assert.equal(trendSentence(trend([{ week: '2026-11-02', seen: 1 }, { week: '2026-10-26', seen: 3 }], weeks), SHOP), '1 student saw your shop on Spots this week, down from 3 last week.');
  assert.equal(trendSentence(trend([], weeks), SHOP), '0 students saw your shop on Spots this week.');
  const thursday = new Date(2026, 10, 5, 15);
  const three = trend([{ week: '2026-11-02', seen: 12, taps: 3 }, { week: '2026-10-26', seen: 5 }], weeksBack(3, thursday));
  assert.equal(trendSentence(three, SOCIETY), '12 students saw your society this week, up from 5 last week. 3 students tapped Instagram or Join.');
  assert.equal(trendSentence([{ seen: 1, taps: 0 }], SOCIETY), '1 student saw your society this week.');
  assert.equal(trendSentence([], SOCIETY), '');
});

test('each phone counts a card once a day', () => {
  const day = new Date(2026, 10, 1, 10);
  const first = toCount(null, 'seen', ['a', 'b', 'a'], day);
  assert.deepEqual(first.fresh, ['a', 'b']);
  const again = toCount(first.record, 'seen', ['a', 'c'], day);
  assert.deepEqual(again.fresh, ['c']);
  // Taps are counted apart from being seen.
  assert.deepEqual(toCount(again.record, 'taps', ['a'], day).fresh, ['a']);
  // A new day starts again.
  assert.deepEqual(toCount(again.record, 'seen', ['a'], new Date(2026, 10, 2, 9)).fresh, ['a']);
  assert.deepEqual(toCount(null, 'seen', [null, ''], day).fresh, []);
  // What older versions saved ({ day: 'YYYY-MM-DD', seen, taps }) is read the same way.
  assert.deepEqual(toCount({ day: '2026-11-01', seen: ['a'], taps: [] }, 'seen', ['a', 'b'], day).fresh, ['b']);
});

test('what went wrong, in plain words', () => {
  assert.match(explain(new Error('bad-code')), /couldn't find that code/);
  assert.match(explain(new Error('used-code')), /already been used/);
  assert.match(explain({ code: 'permission-denied' }), /isn't allowed/);
  assert.match(explain({ code: 'unavailable' }), /online/);
  assert.match(explain(null), /went wrong/);
});
