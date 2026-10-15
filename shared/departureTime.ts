import type { JourneyRequest } from './types';

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
export function londonTimeParts(now: Date) {
  const p = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}` };
}

// Search actual instants, rather than adding 24 hours to a local calendar date.
// This handles missing/repeated London hours without depending on the host zone.
export function nextLondonDeparture(clock: string, now = new Date()): NonNullable<JourneyRequest['departure']> {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) throw new Error('Choose a valid departure time.');
  const current = londonTimeParts(now);
  let instant: Date | null = current.time.slice(0, 5) === clock ? new Date(Math.floor(now.getTime() / 1000) * 1000) : null;
  const limit = now.getTime() + 24 * 60 * 60 * 1000;
  for (let t = Math.floor(now.getTime() / 60000) * 60000 + 60000; !instant && t <= limit; t += 60000) {
    const candidate = new Date(t);
    if (londonTimeParts(candidate).time.slice(0, 5) === clock) instant = candidate;
  }
  if (!instant) throw new Error('That time does not occur within the next 24 hours. Choose another time.');
  const parts = londonTimeParts(instant);
  const earlier = londonTimeParts(new Date(instant.getTime() - 3600000));
  return { ...parts, occurrence: earlier.date === parts.date && earlier.time === parts.time ? 'later' : 'earlier' };
}
