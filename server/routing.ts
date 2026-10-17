import type { Itinerary, JourneyRequest, Point } from '../shared/types.ts';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const londonFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export function londonParts(date: Date): { date: string; time: string } {
  const p = Object.fromEntries(londonFormat.formatToParts(date).map(p => [p.type, p.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}` };
}
export function scheduledInstant(date: string, time: string, occurrence = 'earlier'): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)) throw new ApiError(400, 'Enter a valid date and departure time.');
  const fullTime = time.length === 5 ? time + ':00' : time;
  const baseline = Date.parse(`${date}T${fullTime}Z`);
  if (!Number.isFinite(baseline) || new Date(baseline).toISOString().slice(0, 10) !== date) throw new ApiError(400, 'Invalid departure date.');
  const matches = [baseline - 3600000, baseline].filter(t => { const p = londonParts(new Date(t)); return p.date === date && p.time === fullTime; });
  if (!matches.length) throw new ApiError(400, 'That local time does not exist because the clocks move forward. Choose another time.');
  return new Date(occurrence === 'later' ? matches[matches.length - 1] : matches[0]);
}
function coordinate(value: unknown): Point {
  if (!value || typeof value !== 'object') throw new ApiError(400, 'Choose both a starting point and destination.');
  const p = value as Point;
  if (typeof p.lat !== 'number' || typeof p.lon !== 'number' || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) throw new ApiError(400, 'Coordinates must be finite numbers.');
  if (p.lat < 54.73 || p.lat > 54.82 || p.lon < -1.64 || p.lon > -1.50) throw new ApiError(400, 'Please select a location within the initial Durham city area.');
  return { lat: p.lat, lon: p.lon };
}
export function parseRequest(input: unknown, now = new Date()): { request: JourneyRequest; departure: Date; parts: { date: string; time: string } } {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'Send a journey request.');
  const value = input as JourneyRequest;
  const request: JourneyRequest = { from: coordinate(value.from), to: coordinate(value.to) };
  if (Math.abs(request.from.lat - request.to.lat) + Math.abs(request.from.lon - request.to.lon) < 0.00001) throw new ApiError(400, 'Choose a different destination.');
  let departure = now;
  if (value.departure !== undefined) {
    const d = value.departure;
    if (!d || typeof d.date !== 'string' || typeof d.time !== 'string' || (d.occurrence !== undefined && !['earlier', 'later'].includes(d.occurrence))) throw new ApiError(400, 'Invalid scheduled departure.');
    departure = scheduledInstant(d.date, d.time, d.occurrence);
    request.departure = d;
  }
  return { request, departure, parts: londonParts(departure) };
}
export const JOURNEY_QUERY = `query Journey($from: PlanLabeledLocationInput!, $to: PlanLabeledLocationInput!, $departure: OffsetDateTime!, $modes: PlanModesInput!) {
  plan: planConnection(origin: $from, destination: $to, dateTime: {earliestDeparture: $departure}, modes: $modes,
       first: 12, searchWindow: "PT2H", preferences: {street: {walk: {reluctance: 1, boardCost: 0}}, transit: {board: {waitReluctance: 1}}}) {
    searchDateTime routingErrors { code }
    edges { node { startTime endTime duration walkTime waitingTime numberOfTransfers
      legs { mode startTime endTime duration distance transitLeg
        from { name lat lon stop { gtfsId code } } to { name lat lon stop { gtfsId code } }
        route { gtfsId shortName longName agency { name } } trip { gtfsId }
        legGeometry { points } steps { distance streetName relativeDirection absoluteDirection }
      }
    } }
  }
}`;
export async function graphql(endpoint: string, query: string, variables = {}, fetcher: typeof fetch = fetch): Promise<any> {
  let response: Response;
  try {
    response = await fetcher(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'OTPTimeout': '45000' }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(50000) });
  } catch { throw new ApiError(503, 'The routing engine is unavailable or still loading. Please try again shortly.'); }
  if (!response.ok) throw new ApiError(502, 'The routing engine could not process this request.');
  let body: any;
  try { body = await response.json(); } catch { throw new ApiError(502, 'The routing engine returned an invalid response.'); }
  if (body.errors?.length || !body.data) {
    console.error('OTP GraphQL errors:', body.errors);
    throw new ApiError(502, 'The routing engine returned an error. Please try another location or time.');
  }
  return body.data;
}
export function normalise(itineraries: any[], departure: Date, prefix: string): Itinerary[] {
  return itineraries.filter(i => i.endTime > departure.getTime() && i.startTime >= departure.getTime() - 1000).map((i, index) => ({
    ...i, id: `${prefix}-${index}`, elapsedSeconds: Math.ceil((i.endTime - departure.getTime()) / 1000),
    initialWaitSeconds: Math.max(0, Math.round((i.startTime - departure.getTime()) / 1000)),
  })).sort((a, b) => a.endTime - b.endTime || a.numberOfTransfers - b.numberOfTransfers);
}
