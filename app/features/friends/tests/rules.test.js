import { test, assert } from 'folio/testing';
import {
  makeCode, readCode, pairId, firstName, cleanName, initials, sharedClasses, fingerprint,
  nowStatus, byDay, freeTogether, stalePeople, explainProblem, CODE_PATTERN,
  inviteLink, codeFrom, busyTimes, onlyBusy, whoIsFree, WEB_ADDRESS,
  groupFree, toggleShown, plannerList, plannerHue, friendSessions, cleanGroup, PLANNER_HUES,
} from '../rules.js';

const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute);

test('new codes look right and differ', () => {
  const codes = new Set(Array.from({ length: 50 }, () => makeCode()));
  for (const code of codes) assert.match(code, CODE_PATTERN);
  assert.ok(codes.size > 45);
  assert.equal(makeCode(() => 0), 'MD-AAAA-AAAA');
});

test('codes are read however they are typed', () => {
  assert.equal(readCode('md-7k3q-9p2x'), 'MD-7K3Q-9P2X');
  assert.equal(readCode(' 7K3Q 9P2X '), 'MD-7K3Q-9P2X');
  assert.equal(readCode('MD7K3Q9P2X'), 'MD-7K3Q-9P2X');
  assert.equal(readCode('MD-7K3Q-9P2'), null);
  assert.equal(readCode('MD-0O1I-9P2X'), null);   // characters codes never use
  assert.equal(readCode(''), null);
});

test('a pair of people has one id, whoever asks', () => {
  assert.equal(pairId('b', 'a'), 'a_b');
  assert.equal(pairId('a', 'b'), 'a_b');
});

test('names and initials', () => {
  assert.equal(firstName('Elead Lau'), 'Elead');
  assert.equal(firstName(''), 'Friend');
  assert.equal(cleanName('  Sam   Smith  '), 'Sam Smith');
  assert.equal(cleanName('x'.repeat(40)).length, 30);
  assert.equal(initials('Elead Lau'), 'EL');
  assert.equal(initials('sam'), 'S');
  assert.equal(initials('Mary Jane Watson'), 'MW');
  assert.equal(initials(''), '?');
});

test('only the next 4 weeks of shown, uncancelled classes are shared', () => {
  const now = at(19, 12);
  const s = (title, start, end, extra = {}) => ({ title, start, end, location: 'CLC013', ...extra });
  const sessions = [
    s('Yesterday', at(18, 9), at(18, 10)),
    s('Earlier today', at(19, 9), at(19, 10)),
    s('Hidden', at(20, 9), at(20, 10), { hidden: true }),
    s('Cancelled', at(20, 11), at(20, 12), { cancelled: true }),
    s('All day', at(21, 0), at(22, 0), { allDay: true }),
    s('In 4 weeks', at(19 + 27, 9), at(19 + 27, 10)),
    s('Too far', at(19 + 28, 9), at(19 + 28, 10)),
  ];
  const shared = sharedClasses(sessions, (x) => !x.hidden, now);
  assert.deepEqual(shared.map((c) => c.t), ['Earlier today', 'In 4 weeks']);
  assert.deepEqual(Object.keys(shared[0]), ['t', 's', 'e', 'l']);
});

test('the fingerprint changes when the classes do', () => {
  const a = [{ t: 'A', s: 1, e: 2, l: '' }];
  assert.equal(fingerprint(a), fingerprint([{ t: 'A', s: 1, e: 2, l: '' }]));
  assert.ok(fingerprint(a) !== fingerprint([{ t: 'B', s: 1, e: 2, l: '' }]));
});

test('busy or free right now', () => {
  const classes = [{ t: 'Lecture', s: +at(19, 10), e: +at(19, 11) }, { t: 'Tutorial', s: +at(19, 14), e: +at(19, 15) }];
  assert.deepEqual(nowStatus(classes, +at(19, 10, 30)), { busy: true, until: +at(19, 11), title: 'Lecture' });
  assert.deepEqual(nowStatus(classes, +at(19, 12)), { busy: false, until: +at(19, 14) });
  assert.deepEqual(nowStatus(classes, +at(19, 16)), { busy: false, until: null });
});

test('classes are grouped by day, from today', () => {
  const classes = [
    { t: 'Old', s: +at(18, 9), e: +at(18, 10) },
    { t: 'A', s: +at(19, 9), e: +at(19, 10) }, { t: 'B', s: +at(19, 11), e: +at(19, 12) },
    { t: 'C', s: +at(21, 9), e: +at(21, 10) },
  ];
  const days = byDay(classes, +at(19, 12));
  assert.deepEqual(days.map((d) => d.classes.map((c) => c.t)), [['A', 'B'], ['C']]);
});

test('free together: the gaps when neither of you has a class', () => {
  const mine = [{ s: +at(19, 9), e: +at(19, 10) }];
  const theirs = [{ s: +at(19, 9, 30), e: +at(19, 11) }, { s: +at(19, 14), e: +at(19, 15) }, { s: +at(19, 17, 45), e: +at(19, 19) }];
  const free = freeTogether(mine, theirs, at(19, 0));
  assert.deepEqual(free.map((f) => [new Date(f.s).getHours(), new Date(f.e).getHours()]), [[11, 14], [15, 17]]);
  assert.deepEqual(freeTogether([], [], at(19, 0)).length, 1);   // the whole day
});

test('people who removed you are taken off your list', () => {
  const friendships = [{ users: ['me', 'sam'] }, { users: ['alex', 'me'] }];
  assert.deepEqual(stalePeople(['sam', 'alex', 'zoe'], friendships, 'me'), ['zoe']);
});

test('problems are explained, with the database\'s code', () => {
  assert.match(explainProblem({ code: 'permission-denied' }), /rules may not be published.*\(permission-denied\)/);
  assert.match(explainProblem({ code: 'unavailable' }), /Couldn't reach.*\(unavailable\)/);
  assert.match(explainProblem(new Error('unverified')), /Confirm your email/);
  assert.match(explainProblem(new Error('full')), /50 friends/);
  assert.match(explainProblem({ code: 'weird' }), /\(weird\)/);
  assert.match(explainProblem({ code: 'unavailable' }, false), /offline/);
});

test('invite links point at the web version, whatever phone made them', () => {
  assert.equal(inviteLink('MD-7K3Q-9P2X'), `${WEB_ADDRESS}#friend=MD-7K3Q-9P2X`);
  assert.match(WEB_ADDRESS, /^https:\/\//);
});

test('a code is found in a link, a message or on its own', () => {
  assert.equal(codeFrom(inviteLink('MD-7K3Q-9P2X')), 'MD-7K3Q-9P2X');
  assert.equal(codeFrom('https://localhost/#friend=MD-7K3Q-9P2X'), 'MD-7K3Q-9P2X');   // old QR codes
  assert.equal(codeFrom('#friend=md-7k3q-9p2x'), 'MD-7K3Q-9P2X');
  assert.equal(codeFrom('Add me on Mobile Durham: my friend code is MD-7K3Q-9P2X'), 'MD-7K3Q-9P2X');
  assert.equal(codeFrom('md 7k3q 9p2x'), 'MD-7K3Q-9P2X');
  assert.equal(codeFrom('7K3Q9P2X'), 'MD-7K3Q-9P2X');
  assert.equal(codeFrom('https://example.com/'), null);
  assert.equal(codeFrom('#friend=nonsense'), null);
  assert.equal(codeFrom(''), null);
});

test('busy times join overlapping classes and leave out names and rooms', () => {
  const classes = [
    { t: 'B', s: at(5, 10), e: at(5, 12), l: 'X' },
    { t: 'A', s: at(5, 9), e: at(5, 11), l: 'Y' },
    { t: 'C', s: at(5, 12), e: at(5, 13), l: 'Z' },
    { t: 'D', s: at(5, 15), e: at(5, 16), l: 'Z' },
  ].map((c) => ({ ...c, s: +c.s, e: +c.e }));
  assert.deepEqual(busyTimes(classes), [{ s: +at(5, 9), e: +at(5, 13) }, { s: +at(5, 15), e: +at(5, 16) }]);
  assert.deepEqual(busyTimes([]), []);
  assert.equal(classes[0].t, 'B');                                   // the list isn't changed
});

test('who shares only free or busy', () => {
  assert.equal(onlyBusy({ busyOnly: ['sam'] }, 'sam'), true);
  assert.equal(onlyBusy({ busyOnly: ['sam'] }, 'alex'), false);
  assert.equal(onlyBusy({}, 'sam'), false);
  assert.equal(onlyBusy(null, 'sam'), false);
});

test('the Home widget lists free friends first, then busy, then the rest', () => {
  const now = +at(5, 10);
  const people = [
    { uid: 'a', name: 'Zed', classes: [{ s: +at(5, 9), e: +at(5, 11) }] },
    { uid: 'b', name: 'Amy', classes: null },
    { uid: 'c', name: 'Bo', classes: [{ s: +at(5, 14), e: +at(5, 15) }] },
    { uid: 'd', name: 'Cy', classes: [{ s: +at(5, 9), e: +at(5, 10, 30), t: 'X' }] },
    { uid: 'e', name: 'Di', classes: [], paused: true },
    { uid: 'f', name: 'Al', classes: [] },
  ];
  const { list, free } = whoIsFree(people, now);
  assert.deepEqual(list.map((p) => p.name), ['Al', 'Bo', 'Cy', 'Zed', 'Amy', 'Di']);
  assert.equal(free, 2);
  assert.equal(list[2].now.until, +at(5, 10, 30));
  assert.equal(list[4].now, null);
  assert.equal(list[5].now, null);                                   // paused counts as not shared
});

test('a group\'s free times: everyone\'s classes together, from now on', () => {
  const busy = [
    { s: +at(5, 9), e: +at(5, 11) },          // yours
    { s: +at(5, 10), e: +at(5, 12) },         // Sam's
    { s: +at(5, 14), e: +at(5, 15) },         // Alex's
    { s: +at(6, 9), e: +at(6, 18) },          // the next day, all day
  ];
  const days = groupFree(busy, at(5, 0), { days: 3, now: +at(5, 8) });
  assert.equal(days.length, 3);
  assert.deepEqual(days[0].free, [{ s: +at(5, 12), e: +at(5, 14) }, { s: +at(5, 15), e: +at(5, 18) }]);
  assert.deepEqual(days[1].free, []);
  assert.deepEqual(days[2].free, [{ s: +at(7, 9), e: +at(7, 18) }]);
  // Later in the day, only what's left.
  const later = groupFree(busy, at(5, 0), { days: 1, now: +at(5, 16, 50) });
  assert.deepEqual(later[0].free, [{ s: +at(5, 16, 50), e: +at(5, 18) }]);
  assert.deepEqual(groupFree(busy, at(5, 0), { days: 1, now: +at(5, 17, 45) })[0].free, []);   // under 30 minutes left
});

test('up to 4 friends are shown in the Planner', () => {
  assert.deepEqual(toggleShown([], 'a'), { shown: ['a'], full: false });
  assert.deepEqual(toggleShown(['a', 'b'], 'a'), { shown: ['b'], full: false });
  assert.deepEqual(toggleShown(['a', 'b', 'c', 'd'], 'e'), { shown: ['a', 'b', 'c', 'd'], full: true });
  assert.deepEqual(toggleShown(['a', 'b', 'c', 'd'], 'd'), { shown: ['a', 'b', 'c'], full: false });
});

test('the Planner\'s list: pinned first, then by name, and search', () => {
  const people = [{ uid: '1', name: 'Zoe' }, { uid: '2', name: 'Amy' }, { uid: '3', name: 'Sam' }, { uid: '4', name: 'Samir' }];
  assert.deepEqual(plannerList(people).map((p) => p.name), ['Amy', 'Sam', 'Samir', 'Zoe']);
  assert.deepEqual(plannerList(people, ['1']).map((p) => p.name), ['Zoe', 'Amy', 'Sam', 'Samir']);
  assert.deepEqual(plannerList(people, [], ' sam ').map((p) => p.name), ['Sam', 'Samir']);
  assert.equal(people[0].name, 'Zoe');                               // the list isn't changed
});

test('friends get their own colour in the Planner, or one in turn', () => {
  assert.equal(plannerHue(140, 0), 140);
  assert.equal(plannerHue(0, 3), 0);                                 // red is a real choice
  assert.equal(plannerHue(null, 0), PLANNER_HUES[0]);
  assert.equal(plannerHue(undefined, PLANNER_HUES.length + 1), PLANNER_HUES[1]);
});

test('a friend\'s classes become faint sessions with their name', () => {
  const [a, b] = friendSessions({ uid: 'u1', name: 'Sam', classes: [
    { t: 'MATH1001 Lecture', s: +at(5, 9), e: +at(5, 10), l: 'CLC013' },
    { s: +at(5, 11), e: +at(5, 12) },
  ] }, 200);
  assert.equal(a.title, 'Sam · MATH1001 Lecture');
  assert.equal(a.short, 'Sam');
  assert.equal(a.location, 'CLC013');
  assert.equal(+a.start, +at(5, 9));
  assert.ok(a.others && a.outline && a.hue === 200 && a.who === 'Sam');
  assert.equal(a.module, 'friend:u1');
  assert.equal(b.title, 'Sam · Busy');
  assert.equal(b.location, '');
  assert.ok(a.key !== b.key);
  assert.deepEqual(friendSessions({ uid: 'u', name: 'X', classes: null }, 0), []);
});

test('groups need a name and friends in them', () => {
  const friends = ['a', 'b', 'c'];
  assert.deepEqual(cleanGroup({ id: 'g', name: '  Flat  mates ', members: ['a', 'b', 'a', 'z'] }, friends), { id: 'g', name: 'Flat mates', members: ['a', 'b'] });
  assert.equal(cleanGroup({ id: 'g', name: ' ', members: ['a'] }, friends), null);
  assert.equal(cleanGroup({ id: 'g', name: 'Flat', members: ['z'] }, friends), null);
  assert.equal(cleanGroup({ id: 'g', name: 'x'.repeat(40), members: ['a'] }, friends).name.length, 30);
});
