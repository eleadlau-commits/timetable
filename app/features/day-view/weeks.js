// Where the Day view's week arrows go: the Monday of the next (direction 1) or previous
// (direction -1) week, whatever day is open now. No screen code, so it can be tested.

import { time } from 'folio';

export function mondayOf(day, direction) {
  return time.addDays(time.startOfWeek(day), direction * 7);
}
