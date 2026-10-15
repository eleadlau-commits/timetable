import { test, assert } from 'folio/testing';
import { clockParts, slotContent, missingText } from '../clock.js';

const at = new Date(2026, 9, 15, 15, 13);

test('the clock shows 24-hour time without a period in the UK', () => {
  assert.deepEqual(clockParts(at, 'en-GB'), { time: '15:13', period: '' });
});

test('the clock keeps AM/PM apart on 12-hour phones', () => {
  const { time, period } = clockParts(at, 'en-US');
  assert.equal(time, '3:13');
  assert.equal(period, 'PM');
});

test('a Home place shows what its items gave', () => {
  const card = document.createElement('div');
  assert.deepEqual(slotContent([null, card, 'add your timetable']), { shown: [card], missing: null });
});

test('a Home place with nothing to show says why', () => {
  assert.deepEqual(slotContent([null, 'add your timetable']), { shown: [], missing: 'add your timetable' });
  assert.deepEqual(slotContent([]), { shown: [], missing: '' });
  assert.equal(missingText('add your timetable'), 'Missing content: add your timetable');
  assert.equal(missingText(''), 'Missing content');
});
