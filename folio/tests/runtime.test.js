// Tests for the framework's building blocks. They run in a browser via `python build.py test`.

import { test, assert } from 'folio/testing';
import { Slot } from 'folio/Slot.js';
import { Area, Storage } from 'folio/Storage.js';
import { Events } from 'folio/Events.js';
import * as time from 'folio/time.js';
import * as check from 'folio/check.js';
import { el, missing, dialog, swipeDirection, onSeen } from 'folio/ui.js';
import { Tabs } from 'folio/Tabs.js';
import { mediaFor } from 'folio/appearance.js';
import { getText } from 'folio/net.js';

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
  assert.equal(time.dayKey(new Date(2026, 0, 2, 23, 59)), '2026-01-02');
  assert.equal(time.dayKey(new Date(2026, 10, 9, 12).getTime()), '2026-11-09');
  assert.equal(time.fromDayKey('2026-11-09'), new Date(2026, 10, 9, 12).getTime());
  assert.equal(time.fromDayKey('2026-02-31'), null);
  assert.equal(time.fromDayKey(''), null);
  assert.equal(time.fromDayKey('9 Nov'), null);
});

test('check tidies typed text and web addresses', () => {
  assert.equal(check.tidy('  Brunch \n  by the river ', 120), 'Brunch by the river');
  assert.equal(check.tidy('abcdef', 3), 'abc');
  assert.equal(check.tidy(null), '');
  assert.equal(check.link('flatwhite.co.uk'), 'https://flatwhite.co.uk/');
  assert.equal(check.link('durhamsu.com/join'), 'https://durhamsu.com/join');
  assert.equal(check.link(''), '');
  assert.equal(check.link('http://flatwhite.co.uk'), null);
  assert.equal(check.link('javascript:alert(1)'), null);
  assert.equal(check.link('localhost'), null);
});

test('check.form checks each field its own way', () => {
  const fields = [
    { key: 'line', label: 'Short line', most: 5 },
    { key: 'site', label: 'Website', type: 'link' },
    { key: 'ends', label: 'Last day', type: 'date' },
    { key: 'shout', label: 'Shout', clean: (v) => (v === 'no' ? null : String(v || '').toUpperCase()), wrong: 'Shout: not that.' },
  ];
  assert.deepEqual(check.form(fields, { line: ' Hello  there ', site: 'a.co.uk', ends: '2026-11-09', shout: 'hi' }).values,
    { line: 'Hello', site: 'https://a.co.uk/', ends: new Date(2026, 10, 9, 12).getTime(), shout: 'HI' });
  assert.deepEqual(check.form(fields, {}).values, { line: '', site: '', ends: null, shout: '' });
  assert.match(check.form(fields, { site: 'http://a.co.uk' }).error, /^Website: /);
  assert.equal(check.form(fields, { ends: '31 Feb' }).error, 'Last day: choose a day.');
  assert.equal(check.form(fields, { shout: 'no' }).error, 'Shout: not that.');
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

test('pop-ups fill the screen unless asked to be a small box', () => {
  const full = dialog({ title: 'Full', className: 'mine' });
  const box = dialog({ title: 'Box', size: 'box' });
  assert.ok(full.element.classList.contains('dialog-full'));
  assert.ok(full.element.classList.contains('mine'));
  assert.ok(box.element.classList.contains('dialog-box'));
  assert.ok(!box.element.classList.contains('dialog-full'));
  full.element.remove();
  box.element.remove();
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

test('appearance: dark styles are switched on, off, or left to the phone', () => {
  const dark = '(prefers-color-scheme: dark)';
  assert.equal(mediaFor(dark, 'auto'), dark);
  assert.equal(mediaFor(dark, 'dark'), 'all');
  assert.equal(mediaFor(dark, 'light'), 'not all');
  assert.equal(mediaFor('(prefers-color-scheme: light)', 'dark'), 'not all');
  assert.equal(mediaFor('(prefers-color-scheme: dark) and (min-width: 600px)', 'dark'), 'all and (min-width: 600px)');
  assert.equal(mediaFor('(prefers-reduced-motion: reduce)', 'dark'), '(prefers-reduced-motion: reduce)');
});

test('getText: in the phone apps the phone downloads it, with HTTP errors kept', async () => {
  const asked = [];
  const phone = (status, data) => ({
    native: true,
    plugin: (name) => (name === 'CapacitorHttp' ? { request: async (o) => { asked.push(o); return { status, data }; } } : null),
  });
  assert.equal(await getText('https://example.ac.uk/a.ics', phone(200, 'BEGIN:VCALENDAR')), 'BEGIN:VCALENDAR');
  assert.equal(asked[0].url, 'https://example.ac.uk/a.ics');
  assert.equal(asked[0].method, 'GET');
  let error = null;
  try { await getText('https://example.ac.uk/gone.ics', phone(404, '')); } catch (err) { error = err; }
  assert.equal(error?.status, 404);
});

test('a long enough swipe counts, a short one springs back, a quick flick counts sooner', () => {
  assert.equal(swipeDirection(-80), 1); // to the left: next
  assert.equal(swipeDirection(80), -1); // to the right: previous
  assert.equal(swipeDirection(-40), 0);
  assert.equal(swipeDirection(-40, { fast: true }), 1);
  assert.equal(swipeDirection(20, { fast: true }), 0);
});

test('onSeen: runs once for something on screen, not for something hidden', async () => {
  const shown = el('div', { style: 'position:fixed;top:0;left:0;width:50px;height:50px' });
  const hidden = el('div', { style: 'display:none;width:50px;height:50px' });
  let seenShown = 0;
  let seenHidden = 0;
  onSeen(shown, () => { seenShown += 1; });
  onSeen(hidden, () => { seenHidden += 1; });
  document.body.append(shown, hidden);
  for (let i = 0; i < 20 && !seenShown; i += 1) await new Promise((r) => setTimeout(r, 25));
  shown.style.top = '1px'; // moving it again doesn't count twice
  await new Promise((r) => setTimeout(r, 100));
  shown.remove();
  hidden.remove();
  assert.equal(seenShown, 1);
  assert.equal(seenHidden, 0);
});
