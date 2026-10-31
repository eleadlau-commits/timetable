import { test, assert } from 'folio/testing';
import { isFor, KINDS } from '../rules.js';

test('items are for students unless they say otherwise', () => {
  assert.ok(isFor({}, false));
  assert.ok(!isFor({}, true));
  assert.ok(isFor({ audience: 'business' }, true));
  assert.ok(!isFor({ audience: 'business' }, false));
  assert.ok(isFor({ audience: 'everyone' }, true));
  assert.ok(isFor({ audience: 'everyone' }, false));
});

test('there are two versions', () => {
  assert.deepEqual(KINDS, ['student', 'business']);
});
