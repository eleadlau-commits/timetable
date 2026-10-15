"""Download, audit, and stage regional data. Python standard library only."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import shutil
import urllib.request
from gtfs import inspect

ROOT = Path(__file__).resolve().parents[1]
BODS = 'https://data.bus-data.dft.gov.uk/timetable/download/gtfs-file/north_east/'
REGIONS = ['durham', 'tyne-and-wear', 'northumberland', 'north-yorkshire', 'cumbria']


def download(url, path):
    temporary = path.with_suffix(path.suffix + '.part')
    request = urllib.request.Request(url, headers={'User-Agent': 'DurhamJourneyPlanner/0.1'})
    with urllib.request.urlopen(request, timeout=120) as response, temporary.open('wb') as out:
        shutil.copyfileobj(response, out)
        metadata = {'url': url, 'last_modified': response.headers.get('Last-Modified'),
                    'etag': response.headers.get('ETag')}
    temporary.replace(path)
    return metadata


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', default=dt.date.today().isoformat())
    parser.add_argument('--reuse', action='store_true', help='Audit existing downloads without fetching')
    args = parser.parse_args()
    date = dt.date.fromisoformat(args.date)
    downloads = ROOT / 'data/downloads'
    downloads.mkdir(parents=True, exist_ok=True)
    sources = [(BODS, 'north-east-gtfs.zip', 'Open Government Licence v3.0')]
    sources += [(f'https://download.geofabrik.de/europe/united-kingdom/england/{r}-latest.osm.pbf',
                 f'{r}.osm.pbf', 'ODbL 1.0') for r in REGIONS]
    records = []
    for url, name, licence in sources:
        path = downloads / name
        print(f'{"Checking" if args.reuse else "Downloading"} {name}', flush=True)
        metadata = {'url': url}
        if not args.reuse:
            metadata = download(url, path)
        if not path.exists():
            raise FileNotFoundError(path)
        with path.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        records.append({**metadata, 'file': name, 'bytes': path.stat().st_size,
                        'sha256': digest, 'licence': licence})
    report = inspect(downloads / 'north-east-gtfs.zip', date)
    (ROOT / 'data/validation.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    if not report['valid']:
        raise ValueError('GTFS failed the current multi-operator Durham coverage gate')
    provenance = {'recorded_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                  'reused_downloads': args.reuse, 'sources': records}
    (ROOT / 'data/provenance.json').write_text(json.dumps(provenance, indent=2), encoding='utf8')
    shutil.copy2(downloads / 'north-east-gtfs.zip', ROOT / 'data/otp/north-east-gtfs.zip')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
