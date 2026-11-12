import { test, assert } from 'folio/testing';
import { STEPS, PICTURES, INTRO, PRIVATE } from '../guide.js';

test("Durham's guide has its steps, and pictures only under steps that exist", () => {
  assert.equal(STEPS.length, 5);
  assert.ok(INTRO.includes('My Timetable'));
  assert.ok(PRIVATE.length > 20);
  for (const i of Object.keys(PICTURES)) assert.ok(Number(i) < STEPS.length);
  for (const p of Object.values(PICTURES)) assert.ok(p.src.endsWith('.png'));
});
