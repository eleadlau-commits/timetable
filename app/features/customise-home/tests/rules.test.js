import { test, assert } from 'folio/testing';
import { cleanWidgets, putWidget, removeWidget, moveWidget, isOriginal, fitSize } from '../rules.js';

const list = [{ id: 'library', size: 'wide' }, { id: 'up-next', size: 'large' }, { id: 'campus-card', size: 'tall' }];
const ids = (l) => l.map((w) => `${w.id}:${w.size}`);

test('saved lists are made safe', () => {
  assert.equal(cleanWidgets(undefined), null);
  assert.equal(cleanWidgets({}), null);
  assert.deepEqual(cleanWidgets([]), []);
  assert.deepEqual(ids(cleanWidgets([{ id: 'a', size: 'wide', extra: 1 }, { id: 'a', size: 'tall' }, null, { id: 3, size: 'wide' }, { id: 'b' }])), ['a:wide']);
});

test('adding a widget puts it at the end', () => {
  assert.deepEqual(ids(putWidget(list.slice(0, 1), 'campus-card', 'wide')), ['library:wide', 'campus-card:wide']);
});

test('adding one that is there already changes its size, in its place', () => {
  assert.deepEqual(ids(putWidget(list, 'up-next', 'tall')), ['library:wide', 'up-next:tall', 'campus-card:tall']);
});

test('removing', () => {
  assert.deepEqual(ids(removeWidget(list, 'up-next')), ['library:wide', 'campus-card:tall']);
  assert.deepEqual(ids(removeWidget(list, 'gone')), ids(list));
});

test('moving', () => {
  assert.deepEqual(ids(moveWidget(list, 'campus-card', -1)), ['library:wide', 'campus-card:tall', 'up-next:large']);
  assert.deepEqual(ids(moveWidget(list, 'library', -1)), ids(list));
  assert.deepEqual(ids(moveWidget(list, 'campus-card', 1)), ids(list));
  assert.deepEqual(ids(moveWidget(list, 'library', 1)), ['up-next:large', 'library:wide', 'campus-card:tall']);
});

test('original or not', () => {
  assert.ok(isOriginal(null, 'durham'));
  assert.ok(isOriginal(undefined, undefined));
  assert.ok(!isOriginal([], 'durham'));
  assert.ok(!isOriginal(null, 'own'));
});

test('photos are shrunk, never enlarged', () => {
  assert.deepEqual(fitSize(4000, 3000, 1400), { width: 1400, height: 1050 });
  assert.deepEqual(fitSize(3000, 4000, 1400), { width: 1050, height: 1400 });
  assert.deepEqual(fitSize(800, 600, 1400), { width: 800, height: 600 });
});
