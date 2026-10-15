"""Build the search index from real OSM features and GTFS stops after live verification."""
import csv
import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import zipfile
from gtfs import CITY_BOUNDS, in_city

ROOT = Path(__file__).resolve().parents[1]


def coordinates(geometry):
    kind, coords = geometry['type'], geometry['coordinates']
    if kind == 'Point':
        return coords
    if kind == 'Polygon':
        ring = coords[0]
    elif kind == 'MultiPolygon':
        ring = max(coords, key=lambda p: len(p[0]))[0]
    else:
        return None
    # Representative boundary vertex nearest the bounding-box centre: a real mapped
    # coordinate, rather than an invented building entrance or potentially external centroid.
    cx = (min(p[0] for p in ring) + max(p[0] for p in ring)) / 2
    cy = (min(p[1] for p in ring) + max(p[1] for p in ring)) / 2
    return min(ring, key=lambda p: (p[0] - cx)**2 + (p[1] - cy)**2)


def main():
    evidence = json.loads((ROOT / 'data/journey-verification.json').read_text())
    if not evidence.get('passed'):
        raise RuntimeError('A genuine bus/walking routing verification is required')
    for name, expected in evidence['artifact_sha256'].items():
        with (ROOT / 'data/otp' / name).open('rb') as stream:
            if hashlib.file_digest(stream, 'sha256').hexdigest() != expected:
                raise RuntimeError(f'{name} changed since verification; verify it again')
    features = json.loads((ROOT / 'data/otp/durham-places.geojson').read_text(encoding='utf8'))['features']
    south, west, north, east = CITY_BOUNDS
    places, seen = [], set()
    for feature in features:
        tags = feature['properties']
        name = tags.get('name') or tags.get('name:en')
        point = coordinates(feature['geometry'])
        if not name or point is None:
            continue
        lon, lat = point[:2]
        if not (south <= lat <= north and west <= lon <= east):
            continue
        ident = str(feature.get('id'))
        if ident.startswith('a'):
            num = int(ident[1:]); osm_type = 'relation' if num % 2 else 'way'; osm_id = num // 2
        else:
            osm_type = 'node' if ident.startswith('n') else 'way'; osm_id = int(ident[1:])
        key = (name.lower(), round(lat, 4), round(lon, 4))
        if key in seen:
            continue
        seen.add(key)
        category = 'Place'
        if tags.get('amenity') == 'library': category = 'Library'
        elif tags.get('railway') == 'station': category = 'Railway station'
        elif tags.get('amenity') == 'bus_station': category = 'Bus station'
        elif tags.get('amenity') in ('university', 'college') or 'college' in name.lower() or tags.get('building') == 'university': category = 'University'
        elif tags.get('building'): category = 'Building'
        elif tags.get('shop'): category = 'Shop'
        places.append(dict(id=f'osm:{osm_type}:{osm_id}', name=name, lat=lat, lon=lon,
                           category=category, source='OpenStreetMap', url=f'https://www.openstreetmap.org/{osm_type}/{osm_id}'))
    with zipfile.ZipFile(ROOT / 'data/otp/north-east-gtfs.zip') as archive:
        def table(name):
            with archive.open(name) as stream:
                return list(csv.DictReader(io.TextIOWrapper(stream, encoding='utf-8-sig')))
        for stop in table('stops.txt'):
            if in_city(stop):
                places.append(dict(id=f"bods-ne:{stop['stop_id']}", name=stop['stop_name'],
                                   lat=float(stop['stop_lat']), lon=float(stop['stop_lon']),
                                   category='Bus stop', source='BODS GTFS'))
        info = table('feed_info.txt')[0]
    def iso(value): return dt.datetime.strptime(value, '%Y%m%d').date().isoformat()
    provenance = json.loads((ROOT / 'data/provenance.json').read_text())
    source = evidence['source_schedule']
    def stop_place(stop):
        return next(p for p in places if p['id'] == 'bods-ne:' + stop['stop_id'])
    validation = json.loads((ROOT / 'data/validation.json').read_text())
    result = {'places': places, 'feed': {'version': info['feed_version'], 'startDate': iso(info['feed_start_date']),
               'endDate': iso(info['feed_end_date']), 'downloadedAt': provenance['recorded_at']},
              'feedSha256': evidence['feed_sha256'], 'graphSha256': evidence['artifact_sha256']['graph.obj'],
              'operators': sorted(set(o for d in validation['service_dates'] for o in d['operators'])),
              'example': {'from': stop_place(source['from']), 'to': stop_place(source['to']),
                          'date': evidence['variables']['date'], 'time': evidence['variables']['time']}}
    (ROOT / 'data/app-data.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf8')
    print(f'Indexed {len(places)} real Durham destinations/stops')
    print('\n'.join(p['name'] for p in places if p['category'] in ('University', 'Library', 'Railway station')))


if __name__ == '__main__': main()
