import { test, assert } from 'folio/testing';
import { pack, fits, usedRows, rowsFor, MIN_ROWS } from '../grid.js';

const where = ({ placed }) => placed.map((p) => `${p.id}@${p.row},${p.col}:${p.cols}x${p.rows}`);

test("Home's usual widgets: library strip, then lectures and the campus card side by side", () => {
  const widgets = [{ id: 'library', size: 'wide' }, { id: 'up-next', size: 'large' }, { id: 'campus-card', size: 'tall' }];
  assert.deepEqual(where(pack(widgets, 6)), ['library@0,0:3x1', 'up-next@1,0:2x3', 'campus-card@1,2:1x3']);
});

test('tall and large widgets stretch to the bottom, strips do not', () => {
  const widgets = [{ id: 'library', size: 'wide' }, { id: 'up-next', size: 'large' }, { id: 'campus-card', size: 'tall' }];
  assert.deepEqual(where(pack(widgets, 7, { stretch: true })), ['library@0,0:3x1', 'up-next@1,0:2x6', 'campus-card@1,2:1x6']);
  assert.deepEqual(where(pack([{ id: 'a', size: 'wide' }], 5, { stretch: true })), ['a@0,0:3x1']);
});

test('a strip under a tall widget stops it stretching', () => {
  const widgets = [{ id: 'a', size: 'tall' }, { id: 'b', size: 'wide' }];
  // b goes under a (the first row where the whole width is free), and a stretches down to it.
  assert.deepEqual(where(pack(widgets, 6)), ['a@0,0:1x3', 'b@3,0:3x1']);
  assert.deepEqual(where(pack(widgets, 6, { stretch: true })), ['a@0,0:1x3', 'b@3,0:3x1']);
});

test('three tall widgets sit side by side', () => {
  const widgets = ['a', 'b', 'c'].map((id) => ({ id, size: 'tall' }));
  assert.deepEqual(where(pack(widgets, 4)), ['a@0,0:1x3', 'b@0,1:1x3', 'c@0,2:1x3']);
});

test("what doesn't fit is left over", () => {
  const widgets = [{ id: 'a', size: 'large' }, { id: 'b', size: 'large' }];
  assert.ok(!fits(widgets, 5));
  assert.deepEqual(pack(widgets, 5).left.map((w) => w.id), ['b']);
  assert.ok(fits(widgets, 6));
  assert.ok(fits([{ id: 'a', size: 'wide' }, { id: 'b', size: 'wide' }, { id: 'c', size: 'wide' }, { id: 'd', size: 'wide' }], 4));
  assert.ok(!fits([{ id: 'a', size: 'wide' }, { id: 'b', size: 'wide' }, { id: 'c', size: 'wide' }, { id: 'd', size: 'wide' }, { id: 'e', size: 'wide' }], 4));
});

test('an unknown size never fits', () => {
  assert.deepEqual(pack([{ id: 'a', size: 'huge' }], 6).left.map((w) => w.id), ['a']);
});

test('rows used', () => {
  assert.equal(usedRows([], 6), 0);
  assert.equal(usedRows([{ id: 'a', size: 'wide' }, { id: 'b', size: 'tall' }], 6), 4);
});

test('rows that fit the screen', () => {
  assert.equal(rowsFor(0), MIN_ROWS);
  assert.equal(rowsFor(420), 6);
  assert.equal(rowsFor(540), 8);
});
