// Personal relay for the Timetable app — a free Cloudflare Worker.
//
// Some university servers don't send the headers that let a web app read the
// calendar link directly (CORS). This worker fetches the link on the app's behalf
// and hands the calendar back. The app POSTs the link in the request body.
//
// Set ALLOWED_HOSTS to your university's timetable server so the relay can't be
// used to fetch anything else. Find the host name in your export link:
//   webcal://timetable.example.ac.uk/ical/abc123.ics  ->  'timetable.example.ac.uk'

const ALLOWED_HOSTS = [
  // 'timetable.example.ac.uk',
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function reply(body, status, extra = {}) {
  return new Response(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store', ...extra } });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return reply(null, 204);
    if (request.method !== 'POST') return reply('Timetable relay is running. The app sends links here with POST.', 200);

    let target;
    try {
      target = new URL((await request.text()).trim().replace(/^webcals?:\/\//i, 'https://'));
    } catch {
      return reply('That is not a valid link.', 400);
    }
    if (!/^https?:$/.test(target.protocol)) return reply('Only http and https links are allowed.', 400);
    if (ALLOWED_HOSTS.length && !ALLOWED_HOSTS.includes(target.hostname)) {
      return reply(`This relay only fetches from: ${ALLOWED_HOSTS.join(', ')}`, 403);
    }

    let upstream;
    try {
      upstream = await fetch(target.toString(), {
        headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1', 'User-Agent': 'Timetable-relay/1.0' },
        redirect: 'follow',
      });
    } catch {
      return reply("Couldn't reach the timetable server.", 502);
    }
    return reply(await upstream.text(), upstream.status, { 'Content-Type': 'text/calendar; charset=utf-8' });
  },
};
