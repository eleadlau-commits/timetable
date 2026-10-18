import { test, assert } from 'folio/testing';
import { backupPath, isSaved, linkToBackUp } from '../rules.js';

const LINK = 'https://timetable.example.ac.uk/ical/abc.ics';

test('the link goes in your private area', () => {
  assert.equal(backupPath('abc'), 'users/abc/private/main');
});

test('a link counts as saved only for the same account and the same link', () => {
  assert.ok(isSaved({ uid: 'sam', link: LINK }, 'sam', LINK));
  assert.ok(!isSaved({ uid: 'sam', link: LINK }, 'alex', LINK));
  assert.ok(!isSaved({ uid: 'sam', link: LINK }, 'sam', 'https://other.example/x.ics'));
  assert.ok(!isSaved(null, 'sam', LINK));
  assert.ok(!isSaved({ uid: 'sam', link: LINK }, 'sam', null));
});

test('only a timetable from a link is backed up', () => {
  assert.equal(linkToBackUp({ source: 'link', url: LINK }), LINK);
  assert.equal(linkToBackUp({ source: 'file', url: LINK }), null);
  assert.equal(linkToBackUp({ source: 'link', url: null }), null);
  assert.equal(linkToBackUp({ source: 'link', url: 'javascript:alert(1)' }), null);
  assert.equal(linkToBackUp(null), null);
});
