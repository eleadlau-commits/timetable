import { test, assert } from 'folio/testing';
import { rich, steps, guideFor, GENERAL } from '../guide.js';

test('the guide\'s words can have bold, slanted and code parts', () => {
  const parts = rich('**Copy the link.** It starts with `webcal://`, then _Copy link_.');
  const tags = parts.map((p) => (typeof p === 'string' ? 'text' : p.tagName.toLowerCase()));
  assert.deepEqual(tags, ['b', 'text', 'code', 'text', 'i', 'text']);
  assert.equal(parts[0].textContent, 'Copy the link.');
});

test('the steps are numbered, and Help can change the last one', () => {
  const guide = guideFor(null);
  assert.equal(steps(guide).querySelectorAll('li').length, GENERAL.steps.length);
  const help = steps(guide, '**Paste it into the app.**');
  assert.equal(help.querySelectorAll('li').length, GENERAL.steps.length);
  assert.equal(help.lastElementChild.textContent, 'Paste it into the app.');
});

test("a university's guide is used, with its pictures, and gaps are filled from the general one", () => {
  const own = { intro: 'Ours.', steps: ['One', 'Two'], pictures: { 1: { src: 'x.png', alt: 'X' } } };
  const g = guideFor(own);
  assert.equal(g.intro, 'Ours.');
  assert.equal(g.private, GENERAL.private);
  const list = steps(g);
  assert.equal(list.querySelectorAll('li').length, 2);
  assert.equal(list.querySelectorAll('img').length, 1);
  assert.equal(guideFor({ intro: 'Only words' }).steps, GENERAL.steps);
});
