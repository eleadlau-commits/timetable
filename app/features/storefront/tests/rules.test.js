import { test, assert } from 'folio/testing';
import { cardsToShow, headingOf } from '../rules.js';

const card = (id, extra = {}) => ({ id, render: () => null, ...extra });

test('cards show in order, and hidden ones are left out', () => {
  const shown = cardsToShow([
    card('trend', { order: 30 }),
    card('details', { order: 10 }),
    card('hidden', { order: 5, visible: () => false }),
    card('broken', { visible: () => { throw new Error('oops'); } }),
    card('deal', { order: 20 }),
    { id: 'no-render' },
  ]);
  assert.deepEqual(shown.map((c) => c.id), ['details', 'deal', 'trend']);
  assert.deepEqual(cardsToShow(null), []);
});

test('the name at the top comes from the first card that has one', () => {
  assert.equal(headingOf([card('a'), card('b', { heading: () => ' Flat White Kitchen ' }), card('c', { heading: () => 'Other' })]), 'Flat White Kitchen');
  assert.equal(headingOf([card('a', { heading: () => { throw new Error('x'); } }), card('b', { heading: () => '' })]), '');
});
