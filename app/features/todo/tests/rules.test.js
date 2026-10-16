import { test, assert } from 'folio/testing';
import { DEFAULT_TAGS, dayKey, isOverdue, sortItems, filterItems, addTag, renameTag, deleteTag, dueLabel, dueToday, dueTodayText } from '../rules.js';

const today = new Date(2026, 9, 16, 15, 30); // Friday 16 October 2026, mid-afternoon
const item = (id, due, extra = {}) => ({ id, text: id, tag: null, due, done: false, added: 0, ...extra });

test('dates are kept as the phone\'s own day', () => {
  assert.equal(dayKey(today), '2026-10-16');
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('a to-do is overdue only once its day has gone by, and not when ticked', () => {
  assert.ok(isOverdue(item('a', '2026-10-15'), today));
  assert.ok(!isOverdue(item('b', '2026-10-16'), today));
  assert.ok(!isOverdue(item('c', '2026-10-20'), today));
  assert.ok(!isOverdue(item('d', null), today));
  assert.ok(!isOverdue(item('e', '2026-10-01', { done: true }), today));
});

test('sorted by due date, to-dos without a date last', () => {
  const items = [item('none', null), item('later', '2026-11-01'), item('late', '2026-10-01'), item('soon', '2026-10-17')];
  assert.deepEqual(sortItems(items).map((x) => x.id), ['late', 'soon', 'later', 'none']);
});

test('to-dos due the same day keep the order they were added', () => {
  const items = [item('second', '2026-10-17', { added: 2 }), item('first', '2026-10-17', { added: 1 }), item('x', null, { added: 0 })];
  assert.deepEqual(sortItems(items).map((x) => x.id), ['first', 'second', 'x']);
});

test('sorting leaves the original list alone', () => {
  const items = [item('b', null), item('a', '2026-10-17')];
  sortItems(items);
  assert.equal(items[0].id, 'b');
});

test('filtering by tag', () => {
  const items = [item('a', null, { tag: 'academic' }), item('b', null, { tag: 'society' }), item('c', null)];
  assert.deepEqual(filterItems(items, 'all').map((x) => x.id), ['a', 'b', 'c']);
  assert.deepEqual(filterItems(items, 'society').map((x) => x.id), ['b']);
});

test('the starting tags are Academic and Society', () => {
  assert.deepEqual(DEFAULT_TAGS.map((t) => t.name), ['Academic', 'Society']);
});

test('adding a tag', () => {
  const result = addTag(DEFAULT_TAGS, '  Part-time   job ');
  assert.equal(result.tag.name, 'Part-time job');
  assert.equal(result.tag.id, 'part-time-job');
  assert.equal(result.tags.length, 3);
  assert.equal(DEFAULT_TAGS.length, 2);
});

test('a tag needs a name nobody else has', () => {
  assert.equal(addTag(DEFAULT_TAGS, '   '), null);
  assert.equal(addTag(DEFAULT_TAGS, 'academic'), null);
});

test('new tags never get the id of another tag, or "all"', () => {
  const tags = [{ id: 'gym', name: 'Old gym name' }];
  assert.equal(addTag(tags, 'Gym').tag.id, 'gym-2');
  assert.equal(addTag([], 'All').tag.id, 'all-2');
  assert.equal(addTag([], '!!!').tag.id, 'tag');
});

test('renaming a tag keeps its id, so its to-dos keep it', () => {
  const tags = renameTag(DEFAULT_TAGS, 'society', 'Clubs');
  assert.deepEqual(tags[1], { id: 'society', name: 'Clubs' });
  assert.equal(renameTag(DEFAULT_TAGS, 'society', 'Academic'), null);
  assert.equal(renameTag(DEFAULT_TAGS, 'society', ''), null);
  assert.equal(renameTag(DEFAULT_TAGS, 'missing', 'X'), null);
  assert.ok(renameTag(DEFAULT_TAGS, 'society', 'SOCIETY'));
});

test('deleting a tag keeps its to-dos, without a tag', () => {
  const items = [item('a', null, { tag: 'society' }), item('b', null, { tag: 'academic' })];
  const result = deleteTag(DEFAULT_TAGS, items, 'society');
  assert.deepEqual(result.tags.map((t) => t.id), ['academic']);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].tag, null);
  assert.equal(result.items[1].tag, 'academic');
  assert.equal(items[0].tag, 'society');
});

test('due dates in words', () => {
  assert.equal(dueLabel('2026-10-16', today), 'Today');
  assert.equal(dueLabel('2026-10-17', today), 'Tomorrow');
  assert.equal(dueLabel('2026-10-15', today), 'Yesterday');
  assert.equal(dueLabel('2026-10-20', today), new Date(2026, 9, 20).toLocaleDateString([], { weekday: 'long' }));
  assert.match(dueLabel('2027-01-04', today), /2027/);
});

test('due today: only unticked to-dos whose date is today', () => {
  const items = [
    item('today', '2026-10-16'),
    item('ticked', '2026-10-16', { done: true }),
    item('overdue', '2026-10-15'),
    item('tomorrow', '2026-10-17'),
    item('no date', null),
    item('today too', '2026-10-16', { tag: 'society' }),
  ];
  assert.deepEqual(dueToday(items, today).map((x) => x.id), ['today', 'today too']);
  assert.deepEqual(dueToday([], today), []);
});

test('due today follows the day, including just before and after midnight', () => {
  const items = [item('a', '2026-10-16'), item('b', '2026-10-17')];
  assert.deepEqual(dueToday(items, new Date(2026, 9, 16, 23, 59)).map((x) => x.id), ['a']);
  assert.deepEqual(dueToday(items, new Date(2026, 9, 17, 0, 0)).map((x) => x.id), ['b']);
});

test('how many are due today, in words', () => {
  assert.equal(dueTodayText(0), 'Nothing due today');
  assert.equal(dueTodayText(1), '1 thing due today');
  assert.equal(dueTodayText(3), '3 things due today');
});
