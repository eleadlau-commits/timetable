import { test, assert } from 'folio/testing';
import { lookupPlace } from '../places.js';

const building = (location) => lookupPlace(location)?.building ?? null;

test('room codes find their building', () => {
  assert.equal(building('CLC013'), 'Calman Learning Centre');
  assert.equal(building('Calman Learning Centre CLC013'), 'Calman Learning Centre');
  assert.equal(building('TLC042'), 'Teaching and Learning Centre');
  assert.equal(building('D110'), 'Dawson Building');
  assert.equal(building('MCS0001'), 'Mathematical Sciences and Computer Science Building');
});

test('Elvet Riverside rooms are split between its two buildings', () => {
  assert.equal(building('ER140'), 'Elvet Riverside 1');
  assert.equal(building('ER201'), 'Elvet Riverside 2');
  assert.equal(building('ERA62a'), 'Elvet Riverside 1');
});

test('codes written in other ways still match', () => {
  assert.equal(building('ER 201'), 'Elvet Riverside 2');
  assert.equal(building('Room TLC042'), 'Teaching and Learning Centre');
  assert.equal(building('CB-0008'), 'Confluence Building');
  assert.equal(building('CB-LG001'), 'Confluence Building');
  assert.equal(building('cg85'), 'Chemistry Building');
  assert.equal(building('DH-A04'), 'Dunelm House');
});

test('rooms in a different building from their prefix', () => {
  assert.equal(building('E240'), 'Higginson Building');
  assert.equal(building('E121'), 'Christopherson Building');
  assert.equal(building('MU106'), '48–49 North Bailey');
  assert.equal(building('OE42-1008'), '42 Old Elvet');
  assert.equal(building('PO004'), '47–49 Old Elvet');
});

test('named rooms and map positions', () => {
  const place = lookupPlace('CLC013');
  assert.equal(place.room, 'Arnold Wolfendale Lecture Theatre');
  assert.ok(place.lat > 54.7 && place.lat < 54.8 && place.lng < -1.5 && place.lng > -1.6, 'should be in Durham');
});

test('locations without a known code are left alone', () => {
  assert.equal(lookupPlace('Online'), null);
  assert.equal(lookupPlace('Gala Theatre'), null);
  assert.equal(lookupPlace('Group 3 seminar'), null);
  assert.equal(lookupPlace('XYZ123'), null);
});
