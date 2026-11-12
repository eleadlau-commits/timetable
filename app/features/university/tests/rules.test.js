import { test, assert } from 'folio/testing';
import { choosePack, yearStart, packForLink } from '../rules.js';

const durham = { id: 'durham', order: 10, timetableHosts: ['mytimetable.durham.ac.uk'] };
const york = { id: 'york', order: 20, timetableHosts: ['york.ac.uk'] };

test('the saved pack, or else the first by order', () => {
  assert.equal(choosePack([york, durham], null), durham);
  assert.equal(choosePack([york, durham], 'york'), york);
  assert.equal(choosePack([york, durham], 'gone'), durham);
  assert.equal(choosePack([], 'durham'), null);
});

test('the year starts in September unless the pack says', () => {
  assert.equal(yearStart(null), 8);
  assert.equal(yearStart({}), 8);
  assert.equal(yearStart({ yearStart: 0 }), 0);
  assert.equal(yearStart({ yearStart: 12 }), 8);
});

test('a timetable link points at its university', () => {
  assert.equal(packForLink([durham, york], 'https://mytimetable.durham.ac.uk/calendar/export/abc.ics'), durham);
  assert.equal(packForLink([durham, york], 'https://timetable.york.ac.uk/x.ics'), york);
  assert.equal(packForLink([durham, york], 'https://example.com/x.ics'), null);
  assert.equal(packForLink([durham, york], 'not a link'), null);
});
