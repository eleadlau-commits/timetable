import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Itinerary, Leg } from '../shared/types.ts';
import { journeySteps } from '../src/journeyPresentation.ts';

// Isolated numerical fixtures; no mock journeys are served to the application.
const requested = '2027-01-04T09:00:00.000Z';
const t = Date.parse(requested);
const point = { name: 'Test stop', lat: 0, lon: 0 };
function leg(mode: string, minute: number, durationMinutes: number): Leg {
  return { mode, startTime: t + minute * 60000, endTime: t + (minute + durationMinutes) * 60000, duration: durationMinutes * 60, distance: 0, from: point, to: point, transitLeg: mode === 'BUS', steps: [], legGeometry: { points: 'unchanged-test-geometry' } };
}
function itinerary(legs: Leg[]): Itinerary {
  return { id: 'test', startTime: legs[0].startTime, endTime: legs.at(-1)!.endTime, duration: 0, walkTime: 0, waitingTime: 0, numberOfTransfers: 0, elapsedSeconds: (legs.at(-1)!.endTime - t) / 1000, initialWaitSeconds: (legs[0].startTime - t) / 1000, legs };
}
function check(journey: Itinerary, expected: [string, number][]) {
  const before = JSON.stringify(journey);
  const steps = journeySteps(journey, requested);
  assert.deepEqual(steps.map(s => [s.kind, s.seconds / 60]), expected);
  assert.equal(steps[0].startTime, t);
  assert.equal(steps.at(-1)!.endTime, journey.endTime);
  assert.equal(steps.reduce((sum, step) => sum + step.seconds, 0), journey.elapsedSeconds);
  steps.forEach((step, i) => { assert.ok(step.seconds >= 0); if (i) assert.equal(step.startTime, steps[i - 1].endTime); });
  assert.equal(JSON.stringify(journey), before, 'OTP timetable, geometry and directions must not change');
  assert.deepEqual(steps.filter(s => s.kind === 'bus').map(s => [s.startTime, s.endTime]), journey.legs.filter(l => l.mode === 'BUS').map(l => [l.startTime, l.endTime]));
}
test('137-minute journey shows 109-minute wait after immediate 11-minute walk', () => {
  check(itinerary([leg('WALK', 109, 11), leg('BUS', 120, 5), leg('WALK', 125, 12)]), [['walk', 11], ['wait', 109], ['bus', 5], ['walk', 12]]);
});
test('transfer walks start at preceding bus arrival and include the full connection wait', () => {
  check(itinerary([leg('WALK', 20, 10), leg('BUS', 31, 5), leg('WALK', 46, 5), leg('BUS', 52, 5), leg('WALK', 57, 3)]), [['walk', 10], ['wait', 21], ['bus', 5], ['walk', 5], ['wait', 11], ['bus', 5], ['walk', 3]]);
});
test('at-stop origin and same-stop transfer use actual timestamps, not cached waiting estimates', () => {
  const journey = itinerary([leg('BUS', 30, 5), leg('BUS', 40, 5)]);
  journey.initialWaitSeconds = 1;
  check(journey, [['wait', 30], ['bus', 5], ['wait', 5], ['bus', 5]]);
});
test('keeps actual final alighting gap and fractional seconds consistent', () => {
  check(itinerary([leg('BUS', 10, 5), leg('WALK', 15.5, 5.25)]), [['wait', 10], ['bus', 5], ['wait', .5], ['walk', 5.25]]);
});
test('walking-only journey has no inserted waiting', () => {
  check(itinerary([leg('WALK', 0, 12.5)]), [['walk', 12.5]]);
});
