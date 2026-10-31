import { test, assert } from 'folio/testing';
import { textOf, readOccupancy, busyness, headline } from '../occupancy.js';

// Shaped like the library's page in October 2026.
const PAGE = `<html><body><h1>Library Occupancy - Bill Bryson Library</h1>
<p><strong>707</strong> free spaces</p>
<section><h2>Level 4</h2>
  <div class="zone"><span>North</span> <span>52/139</span> <em>High</em></div>
  <div class="zone"><span>East</span> <span>1/132</span> <em>Low</em></div>
</section>
<section><h2>Level 3</h2>
  <div class="zone"><span>South</span> <span>0 / 203</span> <em>Full</em></div>
  <div class="zone"><span>West</span><span>44</span>/<span>75</span></div>
</section>
<section><h2>Level 2</h2><div><span>Café</span> <span>26/100</span></div></section>
<script>var zones = { "North": "1/2" };</script>
<p>Key: High (&gt;50%) Average (&gt;25%) Low Full</p></body></html>`;

test('free seats are added up per floor', () => {
  const o = readOccupancy(textOf(PAGE));
  assert.deepEqual(o.floors.map((f) => [f.name, f.free, f.seats]),
    [['Level 4', 53, 271], ['Level 3', 44, 278], ['Level 2', 26, 100]]);
  assert.equal(o.counted, 123);
  assert.equal(o.seats, 707); // never fewer seats than the headline's free ones
});

test('the total of free seats is the library\'s own headline, even when the floors add up differently', () => {
  assert.equal(readOccupancy(textOf(PAGE)).free, 707);
  assert.equal(headline('1,204 free study spaces'), 1204);
  assert.equal(headline('Level 4 North 52/139'), null);
});

test('without a headline, the floors are added up', () => {
  const o = readOccupancy('Level 1 North 31/57 Level 2 East 41/170');
  assert.equal(o.free, 72);
  assert.equal(o.seats, 227);
});

test('areas keep their names, and labels like "High" are not mistaken for names', () => {
  const o = readOccupancy(textOf(PAGE));
  assert.deepEqual(o.floors[0].zones, [{ name: 'North', free: 52, seats: 139 }, { name: 'East', free: 1, seats: 132 }]);
  assert.deepEqual(o.floors[1].zones.map((z) => z.name), ['South', 'West']);
  assert.equal(o.floors[2].zones[0].name, 'Café');
});

test('plain text works too, and numbers that can\'t be seats are ignored', () => {
  const o = readOccupancy('Level 1\nNorth\n31 of 57\nWest 200/109\nLevel 1\nEast 0/128');
  assert.deepEqual(o.floors[0].zones, [{ name: 'North', free: 31, seats: 57 }, { name: 'East', free: 0, seats: 128 }]);
});

test('a page without seat numbers gives nothing', () => {
  assert.equal(readOccupancy(textOf('<p>Sorry, occupancy data is unavailable.</p>')), null);
});

test('how busy it is follows the library\'s bands', () => {
  assert.equal(busyness(60, 100).id, 'quiet');
  assert.equal(busyness(30, 100).id, 'average');
  assert.equal(busyness(10, 100).id, 'busy');
  assert.equal(busyness(0, 100).id, 'full');
});

test('a floor heading on the same line as other words still starts a new floor', () => {
  const o = readOccupancy('Ground floor first: Level 1 North 31/57 Level 2 East 41/170');
  assert.deepEqual(o.floors.map((f) => [f.name, f.zones[0].name]), [['Level 1', 'North'], ['Level 2', 'East']]);
});
