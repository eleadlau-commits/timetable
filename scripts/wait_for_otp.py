"""Wait for OTP to answer GraphQL after loading its graph."""
import argparse
import json
import time
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--endpoint', default='http://localhost:8080/otp/gtfs/v1')
parser.add_argument('--timeout', type=int, default=180)
args = parser.parse_args()
deadline = time.monotonic() + args.timeout
while time.monotonic() < deadline:
    try:
        request = urllib.request.Request(args.endpoint, data=b'{"query":"{ agencies { name } }"}', headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=10) as response:
            body = json.load(response)
        if not body.get('errors') and body.get('data', {}).get('agencies'):
            print('OTP is ready: loaded graph and GraphQL API are responding.')
            break
    except Exception:
        pass
    time.sleep(3)
else:
    raise SystemExit('OTP did not become ready. Check: docker compose logs --tail 80 otp')
