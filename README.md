# Durham student journey planner

The `journey-planner` branch contains this application and descends from the existing timetable repository's `main` history. The earlier timetable app and its Android/Pages release workflow remain on `main`; this branch uses the Journey Planner configuration and does not publish releases or deploy Pages. Downloaded feeds, generated routing graphs, local credentials and build outputs are intentionally excluded. Follow the preparation steps below to recreate routing data on a new checkout.

Working first version: React/TypeScript/Vite, a TypeScript API, Leaflet/OpenStreetMap, and OpenTripPlanner 2.7.0 in Docker. The existing data pipeline and saved graph were preserved. There was no Git repository or history available to inspect.

On 12 October 2026, live verification passed for genuine bus and walking journeys, university destinations, Saturday service, transfers, leave-now searches and both occurrences of the repeated clock-change hour. The browser tests display a real bus journey and its map geometry. Production responses have no mock routes or fallback departures.

## Launch on Windows with the existing data

Start Docker Desktop in Linux-container mode. In PowerShell:

```powershell
Set-Location 'C:\Users\jackc\Documents\Durham app\Journey planner'
docker compose up -d --build otp api
docker compose ps
Invoke-RestMethod http://localhost:3001/api/health
```

Graph loading normally takes around a minute. If the health request fails during startup, wait for `Grizzly server running` in `docker compose logs otp` and retry. Open **http://localhost:3001**. The API container serves the built frontend; no separate Node process is required for this mode. Services bind only to loopback, and restart automatically while Docker is running.

To load the verified journey's locations: open **Info**, click **Load verified Bus Station → Dryburn Park journey**, then **Find route**. The picker is populated with 09:25 and resolves it to its next valid London occurrence within 24 hours. The retained verification evidence for 12 October 2026 at 09:25 returned Go North East X5, departing 09:30 and arriving 09:34; nine minutes elapsed includes the initial wait. Today's results are calculated afresh from the feed, not hardcoded. Direct live-test scripts retain historical service dates for regression checks. For a fresh journey use **Leave now**.

The interface is mobile-first: a full-background Durham map and a rounded bottom sheet inside a phone-width view (maximum 430px). Desktop keeps this narrow app centred. There is no top banner, swap button or Leaflet zoom control. The sheet has collapsed, mid and expanded positions; drag its grab handle, click it to cycle states, or use ArrowUp/ArrowDown/Home/End when focused. Content scrolls independently inside the sheet. Search fields use magnifying-glass icons and preserve temporary-edit restoration. Search focus expands the sheet; selecting a result returns it to mid height.

The white top-right target button recentres the map on GPS without changing the origin, destination or journey. Permission errors show a concise message while keeping the map usable. The blue GPS button beside From still selects the origin. Pinch, wheel, double-tap and keyboard zoom remain available without visible +/− buttons. Durham, England remains the initial view. Routing, walking/waiting breakdowns and the Leave now / Depart at logic are unchanged. Source details and connection status are in Info inside the sheet. No reference screenshots accompanied the redesign brief, so the UI follows its written layout requirements rather than a pixel-matched reference.

Cards show elapsed duration, arrival time and walking/bus chips. Expanded cards show concise walk → wait → bus → walk steps. Access walking starts at the requested search time, including future scheduled searches; transfer walking starts at the preceding bus arrival. Walking spans come from OTP timestamps and waits are the full difference between arrival at the boarding stop and the unchanged scheduled bus departure. Actual final alighting/egress gaps are retained. Departure instructions, badges, distances, operator prose and marketing copy are hidden. The routing API still returns original timetable timestamps, geometry and walking directions; the frontend does not mutate them. The seconds in the presented timeline add to total elapsed time; displayed whole minutes are rounded. Collapsing details keeps that journey on the map. The separate results date/time/Edit summary has been removed. Scroll the panel up to adjust search fields. The palette uses #007AFF, #F2F2F7, #FFFFFF, #1C1C1E and #8E8E93.

Depart-at and leave-now searches are supported. Arrive-by searches were not implemented in this version and remain future work.

Search for Bill Bryson Library, Teaching and Learning Centre, colleges or Durham Railway Station. From has a labelled GPS button and an origin map-pin button; To has a destination-pin button. The swap button and its placeholder were removed. Location controls, clear buttons, suggestions and markers have touch targets of at least 44 × 44 CSS pixels, including narrow 320px screens. GPS permission is required; outside-Durham origins receive an actionable message.

Tap a pin button to activate one-shot placement. The next map tap places or moves that marker and immediately deselects its button. Further taps do not move markers until a pin button is selected again. Existing markers remain draggable with no tool selected. Choosing a search suggestion, pressing Find route, using GPS or Escape also cancels placement. Drag releases are suppressed as placement clicks.

The pin buttons can also be dragged onto the map with a mouse, or with a deliberate 350ms long-press followed by a touch drag. A temporary preview uses the existing marker appearance. A successful drop moves the corresponding marker and deselects placement; releasing over the sheet or map controls cancels without changing coordinates. A and B use the same blue teardrop with a white letter, including previews. Markers update in place without duplicates; clearing a field removes its marker. Map placement/dragging preserves the current view, while searched/GPS points outside the view are revealed without changing zoom. New journey searches still fit the route above the sheet.

Focusing a location input clears only its temporary visible text, preserving the committed place and marker. Blank or invalid edits restore the previous selection on blur or Escape. Valid suggestions commit only that field; mouse/touch selection, ArrowUp/ArrowDown and Enter are supported. The evenly spaced blue focus ring surrounds the whole input without moving it.

**Depart at** uses large native hour/minute selectors with 24-hour values; there is no date field or calendar. At submission, the selected clock time is resolved to its next valid occurrence in Europe/London within 24 elapsed hours. Normally later times mean today and earlier times tomorrow. Equal hour/minute means now, retaining current seconds. DST repeats choose the next occurrence and send the backend's existing `occurrence` flag. Missing spring times are accepted only if another valid occurrence falls within the 24-hour window; otherwise an input error is shown. Fall-back choices beyond 24 elapsed hours are rejected. **Leave now** sends no scheduled departure and displays no additional time controls. Backend date/time contracts and routing calculations are unchanged.

```powershell
# Inspect services or stop them without removing routing data
docker compose logs --tail 60 otp api
docker compose stop api otp

# Automated checks (Node 22.12+ or 24 recommended)
npm.cmd ci
npm.cmd test
python -m unittest discover -s tests -v
npm.cmd run test:live
npx.cmd playwright install chromium
npm.cmd run test:browser
npm.cmd run build
```

`test:live` and browser checks require the running Docker services and the retained October 2026 verification feed. Update their fixed regression service dates after replacing that feed. `data/journey-verification.json` retains the raw OTP verification; `data/application-verification.json` records the application API response. `artifacts/` contains desktop/mobile browser screenshots.

For frontend/API editing with hot reload, keep only OTP running and use:

```powershell
docker compose stop api
docker compose up -d otp
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:5173. Vite proxies `/api` to the local TypeScript API on port 3001. Changes to the API require restarting `npm run dev`, or run `npm run dev:api` and `npm run dev:web` in separate terminals for backend watch mode. Do not run the Docker API and local API simultaneously on port 3001.

## Local setup (PowerShell)

Prerequisites: Python 3.12+ and Docker Desktop running Linux containers with approximately 8 GB of memory available. The graph build uses a 6 GB Java heap; the routing server uses 4 GB. Run the build and server sequentially. Node will be needed for the subsequent React/TypeScript/Vite application. No API key is needed for these public downloads.

```powershell
python scripts/prepare_data.py --date 2026-10-11
python -m unittest discover -s tests -v
docker compose --profile prepare run --rm osm-merge
docker compose --profile prepare run --rm places-export
docker compose --profile build run --rm otp-build
docker compose up -d otp
python scripts/wait_for_otp.py
```

Wait for OTP to finish loading, then choose a date within the downloaded feed's validity:

```powershell
python scripts/verify_journey.py --date 2026-10-12
python scripts/build_catalogue.py
docker compose up -d --build api
```

The verification reads an actual active bus trip from GTFS, chooses two Durham stops separated by at least 1.5 km, and asks OTP to route between their coordinates five minutes before the published departure. It requires a bus itinerary backed by a trip ID present in the downloaded BODS feed and an operator, verifies a separate walking-only calculation, and stores both complete responses and the feed/OSM/graph hashes in `data/journey-verification.json`. Downloading a feed or finding a scheduled trip does **not** pass this gate. The application API verifies its feed and graph hashes at startup and refuses a mismatched catalogue.

OTP's GraphQL endpoint is `http://localhost:8080/otp/gtfs/v1`, and its built-in GraphiQL explorer is `http://localhost:8080/graphiql`. There is no dependency on the removed REST routing API.

If downloads already exist, `python scripts/prepare_data.py --reuse --date YYYY-MM-DD` audits them without fetching. Replace the example dates with the current local date and a suitable service date when refreshing.

## Scope and data

The complete North East GTFS feed is retained: no trips, outlying stops, shapes, calendars or date exceptions are cut at the city boundary. The initial Durham search bounding box is 54.73–54.82 latitude and -1.64–-1.50 longitude; it is an operational search area, not an official administrative boundary. OSM extracts for County Durham, Tyne and Wear, Northumberland, North Yorkshire and Cumbria are merged with Osmium. This provides a substantial surrounding walking and transfer network. Border services reaching Scotland or further outside these extracts require expanded OSM coverage before offering those outer destinations. Completeness against every operator's published service register has not yet been established.

`data/validation.json` reports operators with active bus trips at Durham stops, GTFS reference checks, weekday/weekend coverage over fourteen days and Christmas/New Year service counts. These are feed-derived checks, not a guarantee that an operator's schedule matches on-street operations. OTP applies `calendar.txt` and `calendar_dates.txt`, including cancellations and additional holiday services. A feed-wide end date must never be treated as proof that every route runs until that date. Schedules are not live vehicle predictions.

## Provenance, licences and refresh

- Timetables: [DfT BODS regional download](https://data.bus-data.dft.gov.uk/timetable/download/gtfs-file/north_east/), with publisher/version/start/end dates preserved from `feed_info.txt`. BODS is an aggregation of operator submissions; retain attribution to DfT/BODS and the operators. The expected BODS reuse licence is Open Government Licence v3.0; confirm the current [BODS terms](https://data.bus-data.dft.gov.uk/) before production redistribution.
- Walking network: [Geofabrik England extracts](https://download.geofabrik.de/europe/united-kingdom/england.html), © OpenStreetMap contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright). Preserve attribution in the future map and comply with database share-alike obligations when distributing derived databases.
- Each download's URL, byte size, SHA-256, response Last-Modified/ETag (when downloaded by the script), and retrieval timestamp are recorded in `data/provenance.json`. Downloads and graph binaries are ignored by Git. Reused files explicitly record that no new retrieval took place.

For local refresh, stop both services (`docker compose stop api otp`), rerun preparation, OSM merge, places export and graph build using the setup sequence above. Start **OTP alone**, wait for readiness, rerun live verification with a date covered by the new feed, rebuild the catalogue, then start the API. Do not refresh the live directory while a graph build is running. Production refresh should run daily into a separate staging directory, validate active multi-operator Durham coverage and feed freshness, build a new graph, route-test weekdays/weekends/holidays/transfers and walking, then atomically switch the deployment. Preserve the previous validated graph for rollback. This production automation is not yet implemented.

## Backend contract and current limits

- `GET /api/health`: queries the running OTP agencies; reports readiness, feed dates and graph verification.
- `GET /api/config`: feed metadata and the previously verified search coordinates/time.
- `GET /api/places?q=...`: real named OSM points/buildings and GTFS stops in the initial city search area; searches names and categories.
- `POST /api/journeys`: `{from:{lat,lon},to:{lat,lon},departure?:{date:"YYYY-MM-DD",time:"HH:mm",occurrence?:"earlier"|"later"}}`. Omitting departure means leave now. Returns bus alternatives, walking-only comparison, fastest returned itinerary ID, elapsed time including initial waiting, legs, geometry and walking steps.

The TypeScript API uses OTP `planConnection` with an explicit timestamp. Bus searches are restricted to BUS plus walking access/egress/transfers and a two-hour departure window; walking-only is calculated separately. Up to twelve OTP alternatives are sorted by arrival, with the first five bus alternatives shown in the UI. “Fastest” means earliest arrival among returned candidates in this window; it is not an unbounded network-wide optimality guarantee. A walking journey can be faster than every bus. Feed-wide validity is checked before routing; OTP applies each trip's actual service calendar and holiday exceptions. Initial waiting is included in elapsed time even though OTP's itinerary duration can omit it.

Search works offline from the local catalogue. Map tiles need internet access; the interface uses local system fonts. OSM building locations use actual boundary vertices near the footprint centre, not verified accessible entrances. Footpaths, access restrictions and transfers come from the imported OSM/GTFS graph. The street graph has no elevation model or guaranteed wheelchair-accessible routing. GPS sends coordinates only to this local routing API; searches are not stored by the application.

The feed audit for 12 October reports 2,057 active city bus trips and 45 route IDs across Arriva North East, Gateshead Central Buses, Go North East, Stagecoach North East and Weardale Motor Services. All regional operators and complete trips remain in the graph. Cross-checking all registered Durham services against operator publications remains unfinished. Holiday services are taken directly from feed exceptions, but have not been independently confirmed with the operators. Live disruptions, realtime arrivals, fares, background refresh, public hosting and automated source-completeness monitoring remain future work.

`capacitor.config.ts` points to the standard Vite `dist` build. A future iOS wrapper can use `VITE_API_BASE_URL` to reach an HTTPS backend; allow its origin with backend `ALLOWED_ORIGINS`. The web app contains no API keys. Capacitor dependencies, native permissions/plugins and an Xcode/iOS build are not installed or validated yet. Keep server secrets out of all `VITE_` variables. Backend environment settings are `OTP_URL`, `DATA_DIR`, `HOST`, `PORT`, and `ALLOWED_ORIGINS`; see `.env.example` (environment variables must actually be supplied to the process; it does not auto-load this example).

Numerical response fixtures and mocked upstream failures exist only in the unit tests. Browser integration tests use the live local OTP backend. There is no production mock mode.

References: [OTP container workflow](https://docs.opentripplanner.org/en/v2.7.0/Container-Image/), [OTP build configuration](https://docs.opentripplanner.org/en/v2.7.0/BuildConfiguration/), [GTFS GraphQL](https://docs.opentripplanner.org/en/v2.7.0/apis/GTFS-GraphQL-API/), [DfT implementation guide](https://www.gov.uk/government/publications/bus-open-data-implementation-guide/bus-open-data-implementation-guide).
