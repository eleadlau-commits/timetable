import { test, assert } from 'folio/testing';
import { arrange } from '../groups.js';

const groups = [{ id: 'start', title: 'Getting started' }, { id: 'app', title: 'About the app' }];

test('questions go into their groups, in the groups\' order', () => {
  const result = arrange([
    { group: 'app', question: 'Is it free?' },
    { group: 'start', question: 'How do I connect my timetable?' },
  ], groups);
  assert.deepEqual(result.map((g) => g.title), ['Getting started', 'About the app']);
  assert.equal(result[0].items[0].question, 'How do I connect my timetable?');
});

test('within a group, lower order comes first, then by the question', () => {
  const result = arrange([
    { group: 'app', question: 'B', order: 20 },
    { group: 'app', question: 'C' },
    { group: 'app', question: 'A', order: 20 },
    { group: 'app', question: 'First', order: 1 },
  ], groups);
  assert.deepEqual(result[0].items.map((q) => q.question), ['First', 'A', 'B', 'C']);
});

test('unknown groups go to Other questions at the end, and empty groups are left out', () => {
  const result = arrange([
    { group: 'nowhere', question: 'Lost?' },
    { group: 'app', question: 'Is it free?' },
  ], groups);
  assert.deepEqual(result.map((g) => g.title), ['About the app', 'Other questions']);
});

test('items without a question are ignored', () => {
  assert.deepEqual(arrange([null, { group: 'app' }], groups), []);
});
