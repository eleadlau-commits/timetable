import type { Itinerary } from '../shared/types';

export type JourneyStep = {
  kind: 'walk' | 'wait' | 'bus'; label: string; seconds: number;
  detail?: string;
  startTime: number; endTime: number;
};

// Move access/transfer walking forward to the search time or preceding bus arrival.
// Bus timestamps and walking spans stay intact; all remaining time is waiting.
export function journeySteps(journey: Itinerary, requestedDeparture: string): JourneyStep[] {
  const steps: JourneyStep[] = [];
  let cursor = Date.parse(requestedDeparture);
  let boarded = false;
  const add = (kind: JourneyStep['kind'], label: string, endTime: number, detail?: string) => {
    steps.push({ kind, label, startTime: cursor, endTime, seconds: (endTime - cursor) / 1000, detail });
    cursor = endTime;
  };
  journey.legs.forEach((leg, index) => {
    if (leg.mode === 'BUS') {
      if (leg.startTime > cursor) add('wait', 'Wait', leg.startTime, leg.from.name);
      steps.push({ kind: 'bus', label: leg.route?.shortName || leg.route?.longName || 'Bus', startTime: leg.startTime, endTime: leg.endTime, seconds: (leg.endTime - leg.startTime) / 1000, detail: `${leg.from.name} → ${leg.to.name}` });
      cursor = leg.endTime;
      boarded = true;
    } else {
      // Retain any actual alighting/egress gap after the final scheduled bus.
      // Access and transfer gaps instead move into the following boarding wait.
      const hasLaterBus = journey.legs.slice(index + 1).some(next => next.mode === 'BUS');
      if (boarded && !hasLaterBus && leg.startTime > cursor) add('wait', 'Wait', leg.startTime, leg.from.name);
      add('walk', 'Walk', cursor + (leg.endTime - leg.startTime));
    }
  });
  return steps;
}
