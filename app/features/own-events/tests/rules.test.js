import { test, assert } from 'folio/testing';
import { problem, clean, days, sessionsFor, parseDate, dateKey, repeatText } from '../rules.js';

const form = (more = {}) => ({ title: 'Choir', date: '2026-11-03', start: '18:00', end: '19:30', place: '', weekly: false, until: '', ...more });
const d = (text) => parseDate(text);
const keys = (list) => list.map(dateKey);

test('the form needs a name, a day, and an end after the start', () => {
  assert.equal(problem(form()), null);
  assert.equal(problem(form({ title: '  ' })), 'Give it a name first.');
  assert.equal(problem(form({ date: '' })), 'Choose a day.');
  assert.equal(problem(form({ end: '' })), 'Choose a start and an end time.');
  assert.equal(problem(form({ end: '17:00' })), 'It needs to end after it starts.');
  assert.equal(problem(form({ end: '18:00' })), 'It needs to end after it starts.');
  assert.equal(problem(form({ weekly: true, until: '2026-10-01' })), 'The last week can\'t be before the first.');
});

test('a one-off event happens once', () => {
  const e = clean(form(), 'a');
  assert.deepEqual(keys(days(e, d('2026-11-01'), d('2026-11-30'))), ['2026-11-03']);
  assert.deepEqual(days(e, d('2026-11-04'), d('2026-11-30')), []);
});

test('a weekly event repeats every 7 days, from its first day until its last', () => {
  const e = clean(form({ weekly: true, until: '2026-11-24' }), 'a');
  assert.deepEqual(keys(days(e, d('2026-10-01'), d('2027-01-01'))), ['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
  assert.deepEqual(keys(days(e, d('2026-11-15'), d('2026-11-20'))), ['2026-11-17']);
});

test('a weekly event with no last week keeps going, and skipped weeks are left out', () => {
  const e = clean(form({ weekly: true, skip: ['2026-11-10'] }), 'a');
  assert.deepEqual(keys(days(e, d('2026-11-01'), d('2026-11-25'))), ['2026-11-03', '2026-11-17', '2026-11-24']);
  assert.equal(days(e, d('2027-06-01'), d('2027-06-08')).length, 1);
});

test('weeks keep their weekday across the clocks changing', () => {
  const e = clean(form({ date: '2026-10-20', weekly: true }), 'a');
  const list = days(e, d('2026-10-01'), d('2026-11-10'));
  assert.deepEqual(list.map((x) => x.getDay()), [2, 2, 2]);
});

test('each day becomes a session drawn as an outline, at the right times', () => {
  const [s] = sessionsFor([clean(form({ place: 'Castle' }), 'a')], d('2026-11-01'), d('2026-11-30'));
  assert.equal(s.title, 'Choir');
  assert.equal(s.location, 'Castle');
  assert.equal(s.own, true);
  assert.equal(s.outline, true);
  assert.equal(s.key, 'own:a@2026-11-03');
  assert.equal(s.start.getHours(), 18);
  assert.equal(s.end.getHours() * 60 + s.end.getMinutes(), 19 * 60 + 30);
});

test('repeating events say when they repeat', () => {
  assert.equal(repeatText(form()), '');
  assert.equal(repeatText(form({ weekly: true })), 'Every Tuesday');
});
