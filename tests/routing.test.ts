import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, graphql, londonParts, normalise, parseRequest, scheduledInstant } from '../server/routing.ts';
import { decodePolyline } from '../shared/polyline.ts';

test('London departures use British Summer Time independently of host timezone', () => {
  assert.equal(scheduledInstant('2026-10-12', '09:25').toISOString(), '2026-10-12T08:25:00.000Z');
  assert.deepEqual(londonParts(new Date('2026-12-01T10:00:00Z')), { date: '2026-12-01', time: '10:00:00' });
});
test('rejects invalid dates and nonexistent spring clock-change time', () => {
  assert.throws(() => scheduledInstant('2026-02-30', '12:00'), ApiError);
  assert.throws(() => scheduledInstant('2027-03-28', '01:30'), /does not exist/);
  assert.equal(scheduledInstant('2026-10-25', '01:30', 'earlier').toISOString(), '2026-10-25T00:30:00.000Z');
  assert.equal(scheduledInstant('2026-10-25', '01:30', 'later').toISOString(), '2026-10-25T01:30:00.000Z');
});
test('rejects invalid and out-of-scope coordinates', () => {
  assert.throws(() => parseRequest({ from: { lat: '54.7', lon: -1.58 }, to: { lat: 54.78, lon: -1.59 } }), ApiError);
  assert.throws(() => parseRequest({ from: { lat: 51.5, lon: -0.1 }, to: { lat: 54.78, lon: -1.59 } }), /Durham city/);
  const request = parseRequest({ from: { lat: 54.777, lon: -1.58 }, to: { lat: 54.79, lon: -1.59 } }, new Date('2026-10-12T08:00:00Z'));
  assert.equal(request.parts.time, '09:00:00');
});
test('elapsed time includes initial waiting and results sort by arrival', () => {
  // Isolated numerical fixtures; these are not journeys served to the app.
  const departure = new Date('2026-10-12T08:00:00Z'); const t = departure.getTime();
  const results = normalise([{ startTime: t + 600000, endTime: t + 1800000, numberOfTransfers: 0 }, { startTime: t, endTime: t + 1200000, numberOfTransfers: 1 }], departure, 'test');
  assert.equal(results[0].elapsedSeconds, 1200);
  assert.equal(results[1].elapsedSeconds, 1800);
  assert.equal(results[1].initialWaitSeconds, 600);
});
test('upstream failures are explicit and never replaced with sample routes', async () => {
  const unavailable = (async () => { throw new Error('Unavailable'); }) as typeof fetch;
  await assert.rejects(() => graphql('http://test.invalid', '{}', {}, unavailable), e => e instanceof ApiError && e.status === 503);
  const invalid = (async () => new Response('not json')) as typeof fetch;
  await assert.rejects(() => graphql('http://test.invalid', '{}', {}, invalid), /invalid response/);
});
test('decodes route geometry and rejects truncated geometry', () => {
  // Public encoded-polyline specification example, used only as a unit fixture.
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
  assert.throws(() => decodePolyline('_'), /Invalid route geometry/);
});
