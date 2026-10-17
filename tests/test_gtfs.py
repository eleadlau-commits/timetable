import datetime as dt
import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from gtfs import active_services


class CalendarTests(unittest.TestCase):
    def setUp(self):
        self.calendar = [dict(service_id='weekday', start_date='20261001', end_date='20261031',
                              monday='1', tuesday='1', wednesday='1', thursday='1', friday='1',
                              saturday='0', sunday='0')]

    def test_weekend_and_expiry(self):
        self.assertEqual(active_services(self.calendar, [], dt.date(2026, 10, 12)), {'weekday'})
        self.assertEqual(active_services(self.calendar, [], dt.date(2026, 10, 11)), set())
        self.assertEqual(active_services(self.calendar, [], dt.date(2026, 11, 2)), set())

    def test_holiday_exception_overrides_weekday(self):
        exceptions = [dict(service_id='weekday', date='20261012', exception_type='2'),
                      dict(service_id='holiday', date='20261012', exception_type='1')]
        self.assertEqual(active_services(self.calendar, exceptions, dt.date(2026, 10, 12)), {'holiday'})


if __name__ == '__main__':
    unittest.main()
