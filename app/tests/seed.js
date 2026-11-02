// Sample data for the automatic tests (`python build.py test`). Only used in test builds:
// it runs before the features start and fills in a small timetable around today's date, plus
// some saved settings, so every screen has something to show.
//
// Open a test build with #view=week (or home, day, agenda) to start on that view.

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
// A time `minutes` from when the test starts, on the quarter hour, so there's always a next class.
const fromNow = (minutes) => {
  const d = new Date(Date.now() + minutes * 60000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
};
const at = (dayOffset, hour, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

function sampleCalendar() {
  const event = (uid, title, start, hours, extra = []) => [
    'BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${title}`, `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(new Date(start.getTime() + hours * 3600000))}`, ...extra, 'END:VEVENT',
  ];
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:Sample Timetable',
    ...event('lec@seed', 'ECON1011 Principles of Economics Lecture', at(0, 9), 1,
      ['LOCATION:CLC013', 'DESCRIPTION:Lecturer: Dr A. Example', 'RRULE:FREQ=DAILY;COUNT=10']),
    ...event('sem@seed', 'ECON1011 Seminar', at(0, 9, 30), 1.5, ['LOCATION:ER 201']),
    ...event('geo@seed', 'GEOG1041 Practical', at(1, 14), 2, ['LOCATION:Geography Building W007', 'STATUS:CANCELLED']),
    ...event('online@seed', 'Maths drop-in', at(2, 15), 1, ['LOCATION:Online (Teams)']),
    ...event('talk@seed', 'Careers talk', at(0, 18), 1, ['LOCATION:Gala Theatre']),
    ...event('alg@seed', 'MATH2031 Linear Algebra II Lecture', fromNow(40), 1, ['LOCATION:CG85']),
    ...event('prob@seed', 'MATH2041 Probability Tutorial', fromNow(100), 1, ['LOCATION:CG60']),
    ...event('stat@seed', 'MATH2051 Statistics Workshop', fromNow(160), 1, ['LOCATION:E005']),
    ...event('code@seed', 'Coding Society', fromNow(220), 1.5, ['LOCATION:MCS 2052']),
    'END:VCALENDAR',
  ].join('\r\n');
}

export default function seed(app) {
  const area = (name) => app.storage.area(name);
  area('timetable').set('ics', sampleCalendar());
  area('timetable').set('source', 'link');
  area('timetable').set('url', 'https://timetable.example.invalid/sample.ics'); // so there's a link to refresh (it fails: it isn't real)
  area('timetable').set('updated', Date.now());
  area('notes').set('notes', { [`lec@seed@${at(0, 9).getTime()}`]: 'Bring laptop\nRead chapter 2' });
  area('modules').set('names', { ECON1011: 'Microeconomics' });
  area('modules').set('colours', { ECON1011: 42 });
  area('modules').set('hidden', { GEOG1041: true });
  area('reminders').set('lead', 15);
  area('campus-card').set('card', { format: 'code_128', value: '12345678' });
  const floor = (name, zones) => ({ name, zones, free: zones.reduce((n, z) => n + z.free, 0), seats: zones.reduce((n, z) => n + z.seats, 0) });
  const floors = [
    floor('Level 2', [{ name: 'North', free: 40, seats: 180 }, { name: 'South', free: 31, seats: 160 }]),
    floor('Level 4', [{ name: 'North', free: 52, seats: 139 }, { name: 'East', free: 72, seats: 400 }]),
  ];
  area('library').set('last', {
    at: Date.now(),
    occupancy: { floors, free: floors.reduce((n, f) => n + f.free, 0), seats: floors.reduce((n, f) => n + f.seats, 0) },
  });
  const day = (offset) => { const d = at(offset, 12); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  // Your own events in the Planner: a weekly one this evening and a one-off tomorrow lunchtime.
  area('own-events').set('items', [
    { id: 'e1', title: 'Choir rehearsal', date: day(0), start: '18:00', end: '19:30', place: 'Castle Great Hall', weekly: true, until: '', skip: [] },
    { id: 'e2', title: 'Lunch with Sam', date: day(1), start: '12:00', end: '13:00', place: '', weekly: false, until: '', skip: [] },
  ]);
  area('todo').set('items', [
    { id: 't1', text: 'Hand in economics essay', tag: 'academic', due: day(-1), done: false, added: 1 },
    { id: 't2', text: 'Book room for society social', tag: 'society', due: day(2), done: false, added: 2 },
    { id: 't3', text: 'Read chapter 2', tag: 'academic', due: day(0), done: true, added: 3 },
    { id: 't4', text: 'Buy a new notebook', tag: null, due: null, done: false, added: 4 },
    { id: 't5', text: 'Email tutor about the seminar', tag: 'academic', due: day(0), done: false, added: 5 },
  ]);
  const studied = (start, minutes, module, session) => ({ start: start.getTime(), end: start.getTime() + minutes * 60000, module, session });
  area('study-timer').set('history', [
    studied(at(-2, 10), 50, 'MATH2031', 1), studied(at(-2, 11), 50, 'MATH2031', 1),
    studied(at(-1, 14), 25, 'ECON1011', 2), studied(at(-1, 14, 30), 25, 'ECON1011', 2), studied(at(-1, 19), 60, null, 3),
    studied(new Date(Date.now() - 3 * 3600000), 45, 'MATH2041', 4),
    studied(at(-8, 10), 120, 'ECON1011', 5),
  ]);
  area('study-timer').set('goal', 10);
  // Places on Spots, as if just fetched (so the tests don't ask the real database).
  const place = (id, kind, name, line, extra = {}) => ({ id, kind, name, line, deal: null, dealEnds: null, address: '', link: null, order: 50, ...extra });
  area('listings').set('saved', {
    at: Date.now(),
    places: [
      place('p1', 'cafes', 'Flat White Kitchen', 'Brunch and coffee by the river',
        { deal: '10% off with your campus card', address: '21a Elvet Bridge', link: 'https://example.invalid/flat-white', order: 1,
          open: '0800-1700|0800-1700|0800-1700|0800-1700|0800-1700|0900-1700|' }),
      place('p2', 'cafes', 'Cafe on the Green', 'Cake, soup and a quiet corner',
        { deal: 'Free refill on filter coffee', dealEnds: at(6, 12).getTime(), address: 'Palace Green',
          photo: 'features/home/photos/durham.jpg' }), // a stand-in photo, to see how one looks
      place('p3', 'cafes', 'Old Deal Cafe', 'A deal that has ended', { deal: 'Ended', dealEnds: at(-3, 12).getTime() }),
      place('p4', 'pubs', 'The Swan and Three Cygnets', 'Pints with a view', { address: 'Elvet Bridge' }),
    ],
  });
  area('shop').set('no-count', true); // the tests never count views of places on Spots
  const view = new URLSearchParams(location.hash.slice(1)).get('view');
  if (view) area('folio').set('view', view);
}
