// Tests for the framework's building blocks. They run in a browser via `python build.py test`.

import { test, assert } from 'folio/testing';
import { Slot } from 'folio/Slot.js';
import { Area, Storage } from 'folio/Storage.js';
import { Events } from 'folio/Events.js';
import * as time from 'folio/time.js';
import { el, missing } from 'folio/ui.js';
import { Tabs } from 'folio/Tabs.js';

// A stand-in for the app that records reported problems.
const fakeApp = () => ({ problems: [], report(owner, err) { this.problems.push([owner, err.message]); } });

test('slot items come out in order', () => {
  const slot = new Slot(fakeApp(), 'test');
  slot.add({ id: 'c', order: 30 });
  slot.add({ id: 'a', order: 10 });
  slot.add({ id: 'b' }); // default order 50
  slot.add({ id: 'b2' });
  assert.deepEqual(slot.items.map((i) => i.id), ['a', 'c', 'b', 'b2']);
});

test('a broken slot item is reported against its feature and skipped', () => {
  const app = fakeApp();
  const slot = new Slot(app, 'test');
  slot.add({ text: () => 'one' }, 'good');
  slot.add({ text: () => { throw new Error('boom'); } }, 'broken');
  slot.add({ text: () => 'three' }, 'good');
  assert.deepEqual(slot.map((i) => i.text()), ['one', 'three']);
  assert.deepEqual(app.problems, [['broken', 'boom']]);
});

test('slot.first skips empty answers and slot.some counts errors as false', () => {
  const slot = new Slot(fakeApp(), 'test');
  slot.add({ v: () => undefined });
  slot.add({ v: () => { throw new Error('x'); } });
  slot.add({ v: () => 0 });
  assert.equal(slot.first((i) => i.v()), 0);
  assert.equal(slot.some((i) => i.v() === 'never'), false);
});

test('removing a feature removes everything it added', () => {
  const slot = new Slot(fakeApp(), 'test');
  slot.add({ id: 1 }, 'a');
  slot.add({ id: 2 }, 'b');
  slot.removeOwner('a');
  assert.deepEqual(slot.items.map((i) => i.id), [2]);
});

test('storage areas keep features\' data apart', () => {
  const storage = new Storage('folio-test-app');
  const notes = storage.area('notes');
  const modules = storage.area('modules');
  notes.clear();
  modules.clear();
  notes.set('items', { a: 1 });
  modules.set('items', ['x']);
  assert.deepEqual(notes.get('items'), { a: 1 });
  assert.deepEqual(modules.get('items'), ['x']);
  assert.deepEqual(notes.keys(), ['items']);
  notes.clear();
  assert.equal(notes.get('items', 'gone'), 'gone');
  assert.deepEqual(modules.get('items'), ['x']);
  modules.clear();
});

test('storage.once runs only the first time', () => {
  const area = new Area('folio-test-once.');
  for (const k of area.keys()) area.remove(k);
  let runs = 0;
  area.once('import', () => runs++);
  area.once('import', () => runs++);
  assert.equal(runs, 1);
  for (const k of area.keys()) area.remove(k);
});

test('a broken event listener doesn\'t stop the others', () => {
  const app = fakeApp();
  const events = new Events(app);
  const heard = [];
  events.on('ping', () => heard.push('first'), 'a');
  events.on('ping', () => { throw new Error('bad listener'); }, 'b');
  events.on('ping', (n) => heard.push(n), 'c');
  events.emit('ping', 42);
  assert.deepEqual(heard, ['first', 42]);
  assert.deepEqual(app.problems, [['b', 'bad listener']]);
});

test('date helpers', () => {
  const wed = new Date(2026, 9, 7, 15, 30);
  assert.equal(time.startOfWeek(wed).getDate(), 5); // Monday 5 October
  assert.ok(time.sameDay(time.addDays(wed, 7), new Date(2026, 9, 14)));
  assert.equal(time.inTime(25 * 60000), 'in 25 min');
  assert.equal(time.inTime(125 * 60000), 'in 2 h 5 min');
  assert.equal(time.toLocalInput(new Date(2026, 0, 2, 3, 4)), '2026-01-02T03:04');
});

test('el() treats outside text as text, never as code', () => {
  const node = el('div', { class: 'x' }, '<img src=x onerror=alert(1)>', null, false, ['a', 'b']);
  assert.equal(node.querySelector('img'), null);
  assert.equal(node.textContent, '<img src=x onerror=alert(1)>ab');
});

test('missing() says "Missing content" and what is missing', () => {
  const box = missing('Add your timetable');
  assert.equal(box.className, 'missing');
  assert.equal(box.querySelector('b').textContent, 'Missing content');
  assert.equal(box.querySelector('span').textContent, 'Add your timetable');
  assert.equal(missing().querySelector('span'), null);
});

test('the tab bar highlights the open view, and can sit between two tabs while swiping', () => {
  const picked = [];
  const tabs = new Tabs((id) => picked.push(id));
  const views = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }];
  tabs.render(views, views[1]);
  const buttons = [...tabs.nav.querySelectorAll('.tab')];
  assert.equal(buttons.length, 3);
  assert.equal(buttons[1].getAttribute('aria-current'), 'page');
  assert.ok(buttons[1].classList.contains('lit'));
  assert.equal(tabs.nav.style.getPropertyValue('--pos'), '1');
  tabs.place(1.6); // part of the way to the third tab
  assert.ok(buttons[2].classList.contains('lit'));
  assert.ok(!buttons[1].classList.contains('lit'));
  buttons[0].click();
  assert.deepEqual(picked, ['a']);
});
