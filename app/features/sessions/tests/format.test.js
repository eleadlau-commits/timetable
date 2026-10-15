import { test, assert } from 'folio/testing';
import { moduleKey, hueFor, kindOf, webLink } from '../format.js';

test('module codes group sessions of the same module', () => {
  assert.equal(moduleKey('ECON1011 Principles of Economics Lecture'), 'ECON1011');
  assert.equal(moduleKey('ECON 1011 Seminar Group 4'), 'ECON1011');
  assert.equal(moduleKey('Library induction'), 'Library induction');
});

test('a module always gets the same colour', () => {
  assert.equal(hueFor('ECON1011'), hueFor('ECON1011'));
  assert.ok(hueFor('ECON1011') >= 0 && hueFor('ECON1011') < 360);
});

test('the session type comes from the title, then the description', () => {
  assert.equal(kindOf({ title: 'GEOG1041 Seminar Group 3', description: '' }), 'Seminar');
  assert.equal(kindOf({ title: 'GEOG1041', description: 'Practical in Lab 2' }), 'Practical');
  assert.equal(kindOf({ title: 'Careers fair', description: '' }), '');
});

test('a web link in a location is found', () => {
  assert.equal(webLink('Online: https://teams.example.com/meet/1'), 'https://teams.example.com/meet/1');
  assert.equal(webLink('CLC013'), null);
});
