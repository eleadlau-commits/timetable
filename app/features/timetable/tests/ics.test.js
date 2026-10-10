import { test, assert } from 'folio/testing';
import { parseICS, expandEvents } from '../ics.js';

// A timetable in the format universities export, with the awkward cases.
const SAMPLE = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'X-WR-CALNAME:Test Timetable',
  'BEGIN:VEVENT',
  'UID:lecture@test',
  'SUMMARY:ECON1011 Principles of Economics Lecture',
  'LOCATION:Calman Learning Centre CLC013',
  'DESCRIPTION:Lecturer: Dr A. Example\\nReading is on the module ',
  ' page\\, see Ultra.',
  'DTSTART;TZID=Europe/London:20261005T090000',
  'DTEND;TZID=Europe/London:20261005T100000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=20',
  'EXDATE;TZID=Europe/London:20261012T090000',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:lecture@test',
  'RECURRENCE-ID;TZID=Europe/London:20261014T090000',
  'SUMMARY:ECON1011 Principles of Economics Lecture (room change)',
  'LOCATION:TLC042',
  'DTSTART;TZID=Europe/London:20261014T110000',
  'DTEND;TZID=Europe/London:20261014T120000',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:seminar@test',
  'SUMMARY:GEOG1041 Seminar',
  'DTSTART:20261006T130000Z',
  'DTEND:20261006T140000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:practical@test',
  'SUMMARY:GEOG1041 Practical',
  'STATUS:CANCELLED',
  'DTSTART;TZID=Europe/London:20261007T140000',
  'DURATION:PT2H',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:allday@test',
  'SUMMARY:Reading week',
  'DTSTART;VALUE=DATE:20261109',
  'DTEND;VALUE=DATE:20261114',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const calendar = parseICS(SAMPLE);
const events = expandEvents(calendar.events, new Date('2026-09-01T00:00:00Z'), new Date('2027-03-01T00:00:00Z'));
const lectures = events.filter((e) => e.key.startsWith('lecture@test'));

test('reads the calendar name and folded, escaped text', () => {
  assert.equal(calendar.name, 'Test Timetable');
  const first = lectures[0];
  assert.equal(first.description, 'Lecturer: Dr A. Example\nReading is on the module page, see Ultra.');
  assert.equal(first.location, 'Calman Learning Centre CLC013');
});

test('repeating sessions skip excluded weeks', () => {
  const days = lectures.map((e) => e.start.toISOString().slice(0, 10));
  assert.ok(days.includes('2026-10-05'), 'first Monday');
  assert.ok(!days.includes('2026-10-12'), 'excluded Monday');
  // 20 occurrences, minus the excluded one; the moved one is replaced, not added.
  assert.equal(lectures.length, 19);
});

test('a moved session shows its new time and room', () => {
  const moved = lectures.find((e) => e.start.toISOString().startsWith('2026-10-14'));
  assert.equal(moved.location, 'TLC042');
  assert.equal(moved.start.toISOString(), '2026-10-14T10:00:00.000Z'); // 11:00 in London (summer time)
});

test('times stay right when the clocks change', () => {
  const before = lectures.find((e) => e.start.toISOString().startsWith('2026-10-21'));
  const after = lectures.find((e) => e.start.toISOString().startsWith('2026-10-26'));
  assert.equal(before.start.toISOString(), '2026-10-21T08:00:00.000Z'); // 09:00 British Summer Time
  assert.equal(after.start.toISOString(), '2026-10-26T09:00:00.000Z'); // 09:00 Greenwich Mean Time
});

test('UTC times, durations, cancellations and all-day events', () => {
  const seminar = events.find((e) => e.key.startsWith('seminar@test'));
  assert.equal(seminar.start.toISOString(), '2026-10-06T13:00:00.000Z');
  const practical = events.find((e) => e.key.startsWith('practical@test'));
  assert.ok(practical.cancelled);
  assert.equal((practical.end - practical.start) / 3600000, 2);
  const reading = events.find((e) => e.key.startsWith('allday@test'));
  assert.ok(reading.allDay);
});
