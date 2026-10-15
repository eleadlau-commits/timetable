import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import type { AppData, JourneyResponse, Place } from '../shared/types.ts';
import { journeySteps } from '../src/journeyPresentation.ts';
const base = process.env.TEST_API_URL || 'http://localhost:3001';
async function get(path: string) { const r = await fetch(base + '/api' + path); assert.equal(r.status, 200, await r.clone().text()); return r.json(); }
const health = await get('/health'); assert.equal(health.ready, true); assert.equal(health.graphVerified, true);
const config: AppData = await get('/config');
const { from, to, date, time } = config.example;
const request = { from: { lat: from.lat, lon: from.lon }, to: { lat: to.lat, lon: to.lon }, departure: { date, time } };
const response = await fetch(base + '/api/journeys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
assert.equal(response.status, 200, await response.clone().text());
const result: JourneyResponse = await response.json();
assert.ok(result.bus.length > 0, 'Must return a real bus journey');
assert.ok(result.walking?.legs.every(l => l.mode === 'WALK'));
assert.ok(result.bus.every(i => i.legs.some(l => l.mode === 'BUS' && l.trip?.gtfsId.startsWith('bods-ne:'))));
assert.ok(result.bus.every(i => i.elapsedSeconds === Math.ceil((i.endTime - Date.parse(result.requestedDeparture)) / 1000)));
assert.equal(result.fastestId, [...result.bus, result.walking!].sort((a, b) => a.endTime - b.endTime)[0].id);
for (let i = 1; i < result.bus.length; i++) assert.ok(result.bus[i].endTime >= result.bus[i - 1].endTime);
const invalid = await fetch(base + '/api/journeys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request, departure: { date: '2030-01-01', time: '09:00' } }) });
assert.equal(invalid.status, 422);
const bill: Place[] = (await get('/places?q=Bill%20Bryson')).places;
assert.ok(bill.some(p => p.name === 'Bill Bryson Library' && p.source === 'OpenStreetMap'));
assert.ok((await get('/places?q=Durham%20Railway%20Station')).places.length > 0, 'Railway station must be searchable');
async function plan(from: Place, to: Place, departure?: {date: string; time: string; occurrence?: string}) {
  const r = await fetch(base + '/api/journeys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, ...(departure ? { departure } : {}) }) });
  assert.equal(r.status, 200, await r.clone().text());
  return await r.json() as JourneyResponse;
}
const university = await plan(from, bill[0], {date, time});
assert.ok(university.bus.length && university.walking, 'University journey must have real bus and walking alternatives');
const weekend = await plan(from, to, {date: '2026-10-17', time}); assert.ok(weekend.bus.length && weekend.walking);
const laterHour = await plan(from, to, {date: '2026-10-25', time: '01:30', occurrence: 'later'});
assert.equal(laterHour.requestedDeparture, '2026-10-25T01:30:00.000Z'); assert.ok(laterHour.walking);
const earlierHour = await plan(from, to, {date: '2026-10-25', time: '01:30', occurrence: 'earlier'});
assert.equal(earlierHour.requestedDeparture, '2026-10-25T00:30:00.000Z'); assert.ok(earlierHour.walking);
assert.ok((await plan(from, to)).walking, 'Leave-now search must work');
const newton = (await get('/places?q=Newton%20Hall%20Library')).places[0];
const butler = (await get('/places?q=Josephine%20Butler%20College')).places[0];
const transfers = await plan(newton, butler, {date, time});
assert.ok(transfers.bus.some(i => i.numberOfTransfers > 0 && i.legs.filter(l => l.mode === 'BUS').length >= 2));
for (const response of [result, university, weekend, transfers, earlierHour, laterHour]) {
  for (const itinerary of [...response.bus, ...(response.walking ? [response.walking] : [])]) {
    const steps = journeySteps(itinerary, response.requestedDeparture);
    assert.ok(steps.every(step => step.seconds >= 0));
    assert.ok(Math.abs(steps.reduce((sum, step) => sum + step.seconds, 0) - (itinerary.endTime - Date.parse(response.requestedDeparture)) / 1000) <= 1);
    assert.deepEqual(steps.filter(step => step.kind === 'bus').map(step => [step.startTime, step.endTime]), itinerary.legs.filter(leg => leg.mode === 'BUS').map(leg => [leg.startTime, leg.endTime]));
  }
}
await writeFile('data/application-verification.json', JSON.stringify({ verifiedAt: new Date().toISOString(), request, result }, null, 2));
console.log(`PASS: health, real bus + walking, fastest arrival, waiting, expiry, university, weekend, transfers, leave-now and both clock-change hours. ${result.bus.length} bus alternatives.`);
console.log(result.bus[0].legs.filter(l => l.mode === 'BUS').map(l => `${l.route?.agency.name} ${l.route?.shortName}: ${l.from.name} → ${l.to.name}`).join('\n'));
