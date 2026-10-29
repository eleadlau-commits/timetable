import { test, assert } from 'folio/testing';
import { rich, steps, STEPS } from '../guide.js';

test('the guide\'s words can have bold, slanted and code parts', () => {
  const parts = rich('**Copy the link.** It starts with `webcal://`, then _Copy link_.');
  const tags = parts.map((p) => (typeof p === 'string' ? 'text' : p.tagName.toLowerCase()));
  assert.deepEqual(tags, ['b', 'text', 'code', 'text', 'i', 'text']);
  assert.equal(parts[0].textContent, 'Copy the link.');
});

test('the steps are numbered, and Help can change the last one', () => {
  assert.equal(steps().querySelectorAll('li').length, STEPS.length);
  const help = steps('**Paste it into the app.**');
  assert.equal(help.querySelectorAll('li').length, STEPS.length);
  assert.equal(help.lastElementChild.textContent, 'Paste it into the app.');
});
