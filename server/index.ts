import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError, graphql, JOURNEY_QUERY, normalise, parseRequest } from './routing.ts';
import type { AppData, JourneyResponse, Place } from '../shared/types.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = resolve(process.env.DATA_DIR || resolve(root, 'data'));
const data: AppData = JSON.parse(readFileSync(resolve(dataDir, 'app-data.json'), 'utf8'));
const endpoint = process.env.OTP_URL || 'http://127.0.0.1:8080/otp/gtfs/v1';
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001,capacitor://localhost,https://localhost').split(','));
async function sha256(path: string) { const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex'); }
console.log('Checking that the routing graph and source feed match the verified search catalogue…');
if (await sha256(resolve(dataDir, 'otp/graph.obj')) !== data.graphSha256 || await sha256(resolve(dataDir, 'otp/north-east-gtfs.zip')) !== data.feedSha256) throw new Error('Routing data changed. Re-run verify_journey.py and build_catalogue.py before starting the API.');

function json(res: ServerResponse, status: number, value: unknown) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
async function readBody(req: IncomingMessage) {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) { size += chunk.length; if (size > 10000) throw new ApiError(413, 'Request is too large.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new ApiError(400, 'Send valid JSON.'); }
}
function search(q: string): Place[] {
  const words = q.toLocaleLowerCase('en-GB').split(/\s+/).filter(Boolean);
  return data.places.filter(p => words.every(w => `${p.name} ${p.category}`.toLocaleLowerCase('en-GB').includes(w)))
    .sort((a, b) => {
      const score = (p: Place) => (p.name.toLowerCase() === q.toLowerCase() ? 100 : 0) + (p.name.toLowerCase().startsWith(q.toLowerCase()) ? 30 : 0) + (['University', 'Library', 'Railway station', 'Bus station'].includes(p.category) ? 10 : 0);
      return score(b) - score(a) || a.name.localeCompare(b.name);
    }).slice(0, 15);
}
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return json(res, 403, { error: 'This origin is not allowed.' });
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.writeHead(204); return res.end(); }
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/health') {
      const live = await graphql(endpoint, '{ agencies { name } }');
      return json(res, 200, { ready: true, feed: data.feed, graphVerified: true, operators: live.agencies.map((a: any) => a.name) });
    }
    if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, { feed: data.feed, operators: data.operators, example: data.example, placeCount: data.places.length });
    if (req.method === 'GET' && url.pathname === '/api/places') {
      const q = (url.searchParams.get('q') || '').trim();
      return json(res, 200, { places: q.length >= 2 && q.length <= 100 ? search(q) : [] });
    }
    if (req.method === 'POST' && url.pathname === '/api/journeys') {
      if (!req.headers['content-type']?.startsWith('application/json')) throw new ApiError(415, 'Send application/json.');
      const { request, departure, parts } = parseRequest(await readBody(req));
      if (parts.date < data.feed.startDate || parts.date > data.feed.endDate) throw new ApiError(422, `Timetables cover ${data.feed.startDate} to ${data.feed.endDate}. Select a date in that range.`);
      const location = (p: {lat: number; lon: number}) => ({ location: { coordinate: { latitude: p.lat, longitude: p.lon } } });
      const variables = { from: location(request.from), to: location(request.to), departure: departure.toISOString() };
      const [transit, walk] = await Promise.all([
        graphql(endpoint, JOURNEY_QUERY, { ...variables, modes: { transitOnly: true, transit: { access: ['WALK'], egress: ['WALK'], transfer: ['WALK'], transit: [{ mode: 'BUS' }] } } }),
        graphql(endpoint, JOURNEY_QUERY, { ...variables, modes: { directOnly: true, direct: ['WALK'] } }),
      ]);
      if (!transit.plan || !walk.plan || !Array.isArray(transit.plan.edges) || !Array.isArray(walk.plan.edges)) throw new ApiError(502, 'Incomplete routing response.');
      if (Math.abs(Date.parse(transit.plan.searchDateTime) - departure.getTime()) > 1000 || Math.abs(Date.parse(walk.plan.searchDateTime) - departure.getTime()) > 1000) throw new ApiError(502, 'The routing engine used a different departure time.');
      const bus = normalise(transit.plan.edges.map((e: any) => e.node), departure, 'bus').filter(i => i.legs.some(l => l.mode === 'BUS'));
      const walking = normalise(walk.plan.edges.map((e: any) => e.node), departure, 'walk').find(i => i.legs.every(l => l.mode === 'WALK')) || null;
      const warnings = ['Scheduled timetables; live delays and cancellations are not included.'];
      if (!bus.length) warnings.push('No bus journey found in the next two hours. Try another departure time.');
      if (!walking) warnings.push('No walking route found between these points.');
      if (Date.now() - Date.parse(data.feed.downloadedAt) > 7 * 86400000) warnings.push('This timetable download is over seven days old. Refresh the data before relying on it.');
      const all = [...bus, ...(walking ? [walking] : [])].sort((a, b) => a.endTime - b.endTime);
      const result: JourneyResponse = { requestedDeparture: departure.toISOString(), fastestId: all[0]?.id || null, bus, walking, warnings, feed: data.feed };
      return json(res, 200, result);
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'API endpoint not found.' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
    const dist = resolve(root, 'dist');
    let path = resolve(dist, '.' + decodeURIComponent(url.pathname));
    if (relative(dist, path).startsWith('..')) throw new ApiError(400, 'Invalid path.');
    if (!existsSync(path) || !extname(path)) path = resolve(dist, 'index.html');
    if (!existsSync(path)) return json(res, 404, { error: 'Frontend not built. Run npm run build or npm run dev.' });
    const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(path).on('error', () => res.destroy()).pipe(res);
  } catch (error) {
    const known = error instanceof ApiError;
    if (!known) console.error(error);
    json(res, known ? error.status : 500, { error: known ? error.message : 'An unexpected error occurred. Please try again.' });
  }
});
server.listen(port, host, () => console.log(`Durham API and production app: http://${host}:${port}`));
process.on('SIGTERM', () => server.close());
