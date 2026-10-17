import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextLondonDeparture } from '../shared/departureTime.ts';
import { scheduledInstant } from '../server/routing.ts';

function resolve(time: string, now: string) {
  const d = nextLondonDeparture(time, new Date(now));
  const actual = scheduledInstant(d.date, d.time, d.occurrence);
  assert.ok(actual.getTime() >= Math.floor(Date.parse(now) / 1000) * 1000);
  assert.ok(actual.getTime() <= Date.parse(now) + 86400000);
  return actual.toISOString();
}
test('later clock time is today; earlier clock times are overnight', () => {
  const now = '2026-10-12T20:00:00Z'; // 21:00 London
  assert.equal(resolve('23:30', now), '2026-10-12T22:30:00.000Z');
  assert.equal(resolve('02:00', now), '2026-10-13T01:00:00.000Z');
  assert.equal(resolve('09:00', now), '2026-10-13T08:00:00.000Z');
});
test('equal clock time means now, including seconds', () => {
  assert.equal(resolve('21:00', '2026-10-12T20:00:35.444Z'), '2026-10-12T20:00:35.000Z');
});
test('midnight, month and year boundaries use the correct London date', () => {
  assert.equal(resolve('00:00', '2026-10-12T22:59:30Z'), '2026-10-12T23:00:00.000Z');
  assert.equal(resolve('00:00', '2026-12-31T23:59:30Z'), '2027-01-01T00:00:00.000Z');
  assert.equal(resolve('00:00', '2026-10-31T23:59:30Z'), '2026-11-01T00:00:00.000Z');
});
test('spring DST skips missing instants, allowing only a real occurrence within 24 hours', () => {
  assert.equal(resolve('02:00', '2027-03-28T00:30:00Z'), '2027-03-28T01:00:00.000Z');
  assert.equal(resolve('01:30', '2027-03-28T00:30:00Z'), '2027-03-29T00:30:00.000Z');
  assert.throws(() => nextLondonDeparture('01:30', new Date('2027-03-27T02:30:00Z')), /next 24 hours/);
});
test('autumn repeated hour picks the next occurrence and preserves its backend offset choice', () => {
  assert.equal(resolve('01:30', '2026-10-25T00:15:00Z'), '2026-10-25T00:30:00.000Z');
  assert.equal(resolve('01:30', '2026-10-25T00:45:00Z'), '2026-10-25T01:30:00.000Z');
  assert.equal(resolve('01:30', '2026-10-25T01:15:00Z'), '2026-10-25T01:30:00.000Z');
  assert.equal(resolve('01:30', '2026-10-25T01:30:12Z'), '2026-10-25T01:30:12.000Z');
});
test('fall-back times beyond 24 elapsed hours are rejected', () => {
  assert.throws(() => nextLondonDeparture('20:30', new Date('2026-10-24T20:00:00Z')), /next 24 hours/);
  assert.throws(() => nextLondonDeparture('24:00'), /valid departure time/);
});
