"""Inspect genuine GTFS; never synthesize timetable records."""
import csv
import datetime as dt
import io
import zipfile

CITY_BOUNDS = (54.73, -1.64, 54.82, -1.50)  # initial search area, not a clipping boundary


def rows(archive, name):
    if name not in archive.namelist():
        return
    with archive.open(name) as stream:
        yield from csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig"))


def active_services(calendar, exceptions, date):
    key = date.strftime("%Y%m%d")
    weekday = date.strftime("%A").lower()
    active = {r['service_id'] for r in calendar
              if r['start_date'] <= key <= r['end_date'] and r[weekday] == '1'}
    for r in exceptions:
        if r['date'] == key:
            if r['exception_type'] == '1':
                active.add(r['service_id'])
            elif r['exception_type'] == '2':
                active.discard(r['service_id'])
    return active


def in_city(stop):
    south, west, north, east = CITY_BOUNDS
    return south <= float(stop['stop_lat']) <= north and west <= float(stop['stop_lon']) <= east


def inspect(path, date):
    with zipfile.ZipFile(path) as archive:
        required = {'agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt'}
        missing = required - set(archive.namelist())
        if missing:
            raise ValueError(f'Missing GTFS files: {missing}')
        if not {'calendar.txt', 'calendar_dates.txt'} & set(archive.namelist()):
            raise ValueError('No service calendar')
        agencies = {r['agency_id']: r for r in rows(archive, 'agency.txt')}
        stops = {r['stop_id']: r for r in rows(archive, 'stops.txt')}
        routes = {r['route_id']: r for r in rows(archive, 'routes.txt')}
        trips = {r['trip_id']: r for r in rows(archive, 'trips.txt')}
        calendars = list(rows(archive, 'calendar.txt'))
        exceptions = list(rows(archive, 'calendar_dates.txt'))
        city = {sid for sid, stop in stops.items() if in_city(stop)}
        serving = set()
        invalid = 0
        count = 0
        for r in rows(archive, 'stop_times.txt'):
            count += 1
            if r['trip_id'] not in trips or r['stop_id'] not in stops:
                invalid += 1
            if r['stop_id'] in city:
                serving.add(r['trip_id'])
        invalid += sum(t['route_id'] not in routes for t in trips.values())
        bus_trips = {tid for tid in serving if tid in trips and
                     trips[tid]['route_id'] in routes and
                     (int(routes[trips[tid]['route_id']]['route_type']) == 3 or
                      700 <= int(routes[trips[tid]['route_id']]['route_type']) < 800)}
        dates = [date + dt.timedelta(days=i) for i in range(14)]
        dates += [dt.date(date.year, 12, 25), dt.date(date.year + 1, 1, 1)]
        summaries = []
        for day in dates:
            active = active_services(calendars, exceptions, day)
            tids = {tid for tid in bus_trips if trips[tid]['service_id'] in active}
            rids = {trips[tid]['route_id'] for tid in tids}
            operators = sorted({agencies[routes[rid]['agency_id']]['agency_name'] for rid in rids})
            summaries.append({'date': day.isoformat(), 'active_city_bus_trips': len(tids),
                              'operators': operators, 'route_count': len(rids)})
        return {'checked_date': date.isoformat(), 'feed_info': list(rows(archive, 'feed_info.txt')),
                'agency_count': len(agencies), 'stop_count': len(stops), 'city_stop_count': len(city),
                'city_bus_trip_count': len(bus_trips), 'stop_time_count': count,
                'broken_references': invalid, 'service_dates': summaries,
                'valid': invalid == 0 and len(summaries[0]['operators']) >= 2}
