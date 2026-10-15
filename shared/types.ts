export type Point = { lat: number; lon: number };
export type Place = Point & { id: string; name: string; category: string; source: string; url?: string };
export type LegPlace = Point & { name: string; stop?: { gtfsId: string; code?: string } | null };
export type Leg = {
  mode: string; startTime: number; endTime: number; duration: number; distance: number;
  from: LegPlace; to: LegPlace; transitLeg: boolean;
  route?: { gtfsId: string; shortName: string; longName: string; agency: { name: string } } | null;
  trip?: { gtfsId: string } | null;
  legGeometry?: { points: string } | null;
  steps: { distance: number; streetName: string; relativeDirection: string; absoluteDirection: string }[];
};
export type Itinerary = {
  id: string; startTime: number; endTime: number; duration: number; walkTime: number;
  waitingTime: number; numberOfTransfers: number; legs: Leg[]; elapsedSeconds: number; initialWaitSeconds: number;
};
export type JourneyRequest = { from: Point; to: Point; departure?: { date: string; time: string; occurrence?: 'earlier' | 'later' } };
export type JourneyResponse = {
  requestedDeparture: string; fastestId: string | null; bus: Itinerary[]; walking: Itinerary | null;
  warnings: string[]; feed: { version: string; startDate: string; endDate: string; downloadedAt: string };
};
export type AppData = {
  places: Place[]; feed: JourneyResponse['feed']; feedSha256: string; graphSha256: string;
  operators: string[]; example: { from: Place; to: Place; date: string; time: string };
};
