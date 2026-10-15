"""Live OTP integration gate. A downloaded schedule is not a routing verification."""
import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import urllib.request
import zipfile
from gtfs import rows, active_services, in_city

ROOT = Path(__file__).resolve().parents[1]
QUERY = '''query($from: InputCoordinates!, $to: InputCoordinates!, $date: String!, $time: String!) {
  plan(from: $from, to: $to, date: $date, time: $time,
       transportModes: [{mode: WALK}, {mode: BUS}], numItineraries: 5) {
    itineraries { startTime endTime duration walkTime waitingTime numberOfTransfers
      legs { mode startTime endTime duration transitLeg
        from { name lat lon } to { name lat lon }
        route { gtfsId shortName longName agency { name } }
        trip { gtfsId }
        legGeometry { points }
        steps { distance streetName relativeDirection absoluteDirection }
      }
    }
  }
}'''


def candidate(path, date):
    with zipfile.ZipFile(path) as archive:
        active = active_services(list(rows(archive, 'calendar.txt')),
                                 list(rows(archive, 'calendar_dates.txt')), date)
        stops = {r['stop_id']: r for r in rows(archive, 'stops.txt')}
        routes = {r['route_id']: r for r in rows(archive, 'routes.txt')}
        trips = {r['trip_id']: r for r in rows(archive, 'trips.txt')
                 if r['service_id'] in active and routes[r['route_id']]['route_type'] == '3'}
        first = {}
        for r in rows(archive, 'stop_times.txt'):
            tid = r['trip_id']
            stop = stops[r['stop_id']]
            if tid not in trips or not in_city(stop) or not r['departure_time']:
                continue
            hour, minute, second = map(int, r['departure_time'].split(':'))
            if not 8 <= hour < 18 or r.get('pickup_type') == '1':
                continue
            if tid not in first:
                first[tid] = (stop, hour * 3600 + minute * 60 + second, int(r['stop_sequence']))
                continue
            origin, departure, sequence = first[tid]
            distance = math.hypot((float(stop['stop_lat']) - float(origin['stop_lat'])) * 111000,
                                  (float(stop['stop_lon']) - float(origin['stop_lon'])) * 64000)
            if distance > 1500 and int(r['stop_sequence']) > sequence and r.get('drop_off_type') != '1':
                time = dt.datetime.combine(date, dt.time()) + dt.timedelta(seconds=departure - 300)
                return {'from': {'lat': float(origin['stop_lat']), 'lon': float(origin['stop_lon'])},
                        'to': {'lat': float(stop['stop_lat']), 'lon': float(stop['stop_lon'])},
                        'date': time.strftime('%Y-%m-%d'), 'time': time.strftime('%H:%M:%S')}, \
                    {'trip_id': tid, 'from': origin, 'to': stop, 'departure_seconds': departure}
    raise RuntimeError('No suitable active Durham bus trip found on requested date')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--endpoint', default='http://localhost:8080/otp/gtfs/v1')
    parser.add_argument('--date', required=True, help='Real service date, preferably next weekday')
    parser.add_argument('--output', default='data/journey-verification.json', help='Evidence file relative to repository')
    args = parser.parse_args()
    feed = ROOT / 'data/otp/north-east-gtfs.zip'
    variables, source = candidate(feed, dt.date.fromisoformat(args.date))
    payload = json.dumps({'query': QUERY, 'variables': variables}).encode()
    request = urllib.request.Request(args.endpoint, data=payload,
                                    headers={'Content-Type': 'application/json', 'OTPTimeout': '180000'})
    with urllib.request.urlopen(request, timeout=180) as response:
        result = json.load(response)
    if result.get('errors'):
        raise RuntimeError(json.dumps(result['errors']))
    itineraries = result['data']['plan']['itineraries']
    bus = [i for i in itineraries if any(l['mode'] == 'BUS' for l in i['legs'])]
    if not bus:
        raise RuntimeError('OTP returned no real bus journey; UI gate remains closed')
    walking_query = QUERY.replace('[{mode: WALK}, {mode: BUS}]', '[{mode: WALK}]')
    walking_request = urllib.request.Request(args.endpoint,
        data=json.dumps({'query': walking_query, 'variables': variables}).encode(),
        headers={'Content-Type': 'application/json', 'OTPTimeout': '180000'})
    with urllib.request.urlopen(walking_request, timeout=180) as response:
        walking = json.load(response)
    if walking.get('errors') or not walking['data']['plan']['itineraries']:
        raise RuntimeError('Walking-only routing gate failed')
    if any(leg['mode'] != 'WALK' for itinerary in walking['data']['plan']['itineraries']
           for leg in itinerary['legs']):
        raise RuntimeError('Walking-only response contains a non-walking leg')
    with zipfile.ZipFile(feed) as archive:
        known_trips = {r['trip_id'] for r in rows(archive, 'trips.txt')}
    for journey in bus:
        assert journey['endTime'] > journey['startTime']
        for leg in journey['legs']:
            if leg['mode'] == 'BUS':
                assert leg['trip']['gtfsId'].startswith('bods-ne:')
                assert leg['trip']['gtfsId'].split(':', 1)[1] in known_trips
                assert leg['route']['agency']['name']
    artifact_hashes = {}
    for name in ['north-east-gtfs.zip', 'north-east.osm.pbf', 'graph.obj']:
        with (ROOT / 'data/otp' / name).open('rb') as stream:
            artifact_hashes[name] = hashlib.file_digest(stream, 'sha256').hexdigest()
    evidence = {'verified_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                'otp_version': '2.7.0', 'variables': variables, 'source_schedule': source,
                'feed_sha256': artifact_hashes['north-east-gtfs.zip'], 'artifact_sha256': artifact_hashes,
                'result': result, 'walking_result': walking, 'passed': True}
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to(ROOT):
        raise ValueError('Evidence output must stay inside the repository')
    output.write_text(json.dumps(evidence, indent=2), encoding='utf8')
    print(f'PASS: {len(bus)} genuine bus itineraries plus walking-only route; evidence in {args.output}')


if __name__ == '__main__':
    main()
