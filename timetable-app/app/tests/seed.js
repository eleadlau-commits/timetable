// Sample data for the automatic tests (`python build.py test`). Only used in test builds:
// it runs before the features start and fills in a small timetable around today's date, plus
// some saved settings, so every screen has something to show.
//
// Open a test build with #view=week (or day, agenda) to start on that view.

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
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
    'END:VCALENDAR',
  ].join('\r\n');
}

export default function seed(app) {
  const area = (name) => app.storage.area(name);
  area('timetable').set('ics', sampleCalendar());
  area('timetable').set('source', 'file');
  area('timetable').set('updated', Date.now());
  area('notes').set('notes', { [`lec@seed@${at(0, 9).getTime()}`]: 'Bring laptop\nRead chapter 2' });
  area('modules').set('names', { ECON1011: 'Microeconomics' });
  area('modules').set('colours', { ECON1011: 42 });
  area('modules').set('hidden', { GEOG1041: true });
  area('reminders').set('lead', 15);
  area('campus-card').set('card', { format: 'code_128', value: '12345678' });
  const view = new URLSearchParams(location.hash.slice(1)).get('view');
  if (view) area('folio').set('view', view);
}
