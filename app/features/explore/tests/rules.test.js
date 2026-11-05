import { test, assert } from 'folio/testing';
import { cardsToShow } from '../rules.js';

const card = (id, extra = {}) => ({ id, onClick: () => {}, ...extra });

test('cards show in order, and hidden or broken ones are left out', () => {
  const shown = cardsToShow([
    card('societies', { order: 20 }),
    card('spots', { order: 10 }),
    card('hidden', { visible: () => false }),
    card('broken', { visible: () => { throw new Error('oops'); } }),
    { id: 'no-click' },
  ]);
  assert.deepEqual(shown.map((c) => c.id), ['spots', 'societies']);
  assert.deepEqual(cardsToShow(undefined), []);
});
