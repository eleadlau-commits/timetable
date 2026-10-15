import { useEffect, useRef, useState } from 'react';
import type { AppData, JourneyResponse, Place, Point } from '../shared/types';
import { api } from './api';
import JourneyMap, { type MapActions } from './JourneyMap';
import PlaceSearch from './PlaceSearch';
import JourneyCard from './JourneyCard';
import BottomSheet, { type SheetState } from './BottomSheet';
import { LocationIcon, MapPinButton, type DragPosition } from './LocationControls';
import { londonTimeParts, nextLondonDeparture } from '../shared/departureTime';

const dateLabel = (date: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(date));
function initialDeparture() { return londonTimeParts(new Date()).time.slice(0, 5); }
export default function App() {
  const [config, setConfig] = useState<Pick<AppData, 'feed' | 'operators' | 'example'> | null>(null);
  const [health, setHealth] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [pick, setPick] = useState<'from' | 'to' | null>(null);
  const mapActions = useRef<MapActions | null>(null);
  const [pinPreview, setPinPreview] = useState<(DragPosition & { target: 'from' | 'to' }) | null>(null);
  const [mode, setMode] = useState<'now' | 'scheduled'>('now');
  const [departure, setDeparture] = useState(initialDeparture);
  const [sheetState, setSheetState] = useState<SheetState>('mid');
  const [recenterLoading, setRecenterLoading] = useState(false);
  const [mapMessage, setMapMessage] = useState('');
  const [results, setResults] = useState<JourneyResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoDialog = useRef<HTMLDialogElement>(null);
  const resultsPanel = useRef<HTMLElement>(null);
  const controller = useRef<AbortController | null>(null);
  const gpsGeneration = useRef(0);
  useEffect(() => {
    gps(true);
    return () => { gpsGeneration.current++; };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    api<Pick<AppData, 'feed' | 'operators' | 'example'>>('/config', { signal: c.signal }).then(setConfig).catch(e => { if (e.name !== 'AbortError') setError('Could not connect to the backend. Start the Docker services and retry.'); });
    const check = () => api<{ ready: boolean }>('/health', { signal: c.signal }).then(() => setHealth('ready')).catch(e => { if (e.name !== 'AbortError') setHealth('offline'); });
    check(); const interval = setInterval(check, 30000);
    return () => { c.abort(); clearInterval(interval); controller.current?.abort(); };
  }, []);
  useEffect(() => {
    const dialog = infoDialog.current;
    if (infoOpen) dialog?.showModal(); else dialog?.close();
  }, [infoOpen]);
  useEffect(() => { if (results) resultsPanel.current?.scrollIntoView({ block: 'nearest' }); }, [results]);
  useEffect(() => { const cancel = (e: KeyboardEvent) => { if (e.key === 'Escape') setPick(null); }; window.addEventListener('keydown', cancel); return () => window.removeEventListener('keydown', cancel); }, []);
  function reset() { controller.current?.abort(); setLoading(false); setResults(null); setSelectedId(null); setExpandedId(null); setError(''); }
  function updateFrom(p: Place | null) { gpsGeneration.current++; setGpsLoading(false); setFrom(p); reset(); }
  function updateTo(p: Place | null) { setTo(p); reset(); }
  function pickLocation(point: Point, target: 'from' | 'to', placement = false) {
    const p: Place = { ...point, id: `map:${point.lat},${point.lon}`, name: `Map point (${point.lat.toFixed(5)}, ${point.lon.toFixed(5)})`, category: 'Selected location', source: 'Map selection' };
    if (target === 'from') updateFrom(p); else updateTo(p);
    if (placement) setPick(null);
  }
  function dropPin(position: DragPosition, target: 'from' | 'to') {
    const point = mapActions.current?.pointAtClient(position.x, position.y);
    if (point) { pickLocation(point, target, true); setSheetState('mid'); }
  }
  function recenter() {
    setMapMessage('');
    if (!navigator.geolocation) { setMapMessage('Location unavailable. You can still use the map.'); return; }
    setRecenterLoading(true);
    navigator.geolocation.getCurrentPosition(position => {
      setRecenterLoading(false);
      mapActions.current?.recenter({ lat: position.coords.latitude, lon: position.coords.longitude });
    }, () => { setRecenterLoading(false); setMapMessage('Location unavailable. You can still use the map.'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }
  function choosePin(target: 'from' | 'to') { setPick(p => p === target ? null : target); setSheetState('mid'); }
  function gps(initial = false) {
    if (!initial) { setPick(null); reset(); }
    if (!navigator.geolocation) { if (!initial) setError('Geolocation is not available. Search for your starting point or pick it on the map.'); return; }
    setGpsLoading(true); const generation = ++gpsGeneration.current;
    navigator.geolocation.getCurrentPosition(position => {
      if (generation !== gpsGeneration.current) return;
      setGpsLoading(false);
      const { latitude: lat, longitude: lon, accuracy } = position.coords;
      updateFrom({ lat, lon, id: 'gps', name: 'Current location', category: `GPS accuracy ±${Math.round(accuracy)} m`, source: 'Device location' });
    }, () => { if (generation === gpsGeneration.current) { setGpsLoading(false); if (!initial) setError('Could not access your location. Allow location permission or choose a starting point manually.'); } }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }
  async function plan() {
    setPick(null);
    if (!from || !to) { setError('Select a starting point and destination from search results or the map.'); return; }
    if (mode === 'scheduled' && !departure) { setError('Choose a departure time.'); return; }
    controller.current?.abort(); const c = new AbortController(); controller.current = c;
    setLoading(true); setError(''); setResults(null); setSelectedId(null); setExpandedId(null);
    try {
      const response = await api<JourneyResponse>('/journeys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: { lat: from.lat, lon: from.lon }, to: { lat: to.lat, lon: to.lon }, ...(mode === 'scheduled' ? { departure: nextLondonDeparture(departure) } : {}) }), signal: c.signal });
      if (!c.signal.aborted) { setResults(response); setSelectedId(response.fastestId); }
    } catch (e) { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Journey search failed.'); }
    finally { if (!c.signal.aborted) setLoading(false); }
  }
  function example() { if (!config) return; reset(); updateFrom(config.example.from); updateTo(config.example.to); setMode('scheduled'); setDeparture(config.example.time.slice(0, 5)); setInfoOpen(false); }
  const journeys = results ? [...results.bus.slice(0, 5), ...(results.walking ? [results.walking] : [])].sort((a, b) => a.endTime - b.endTime) : [];
  const selected = journeys.find(i => i.id === selectedId) || null;
  return <div className="app">
    <main className="workspace">
      <JourneyMap from={from} to={to} itinerary={selected} pick={pick} onPick={pickLocation} actions={mapActions}/>
      <button type="button" className="recenter-button" aria-label="Recenter on current location" title="Recenter on current location" aria-busy={recenterLoading} disabled={recenterLoading} onClick={recenter}><LocationIcon kind="gps"/></button>
      {mapMessage && <div className="map-message" role="status">{mapMessage}</div>}
      <BottomSheet state={sheetState} onStateChange={setSheetState} heading={<><h1>Durham Journeys</h1><button className="info-button" type="button" onClick={() => setInfoOpen(true)} aria-label="About Durham Journeys"><span className="info-icon" aria-hidden="true">i</span></button></>}>
        <form onSubmit={e => { e.preventDefault(); plan(); }}>
          <div className="location-fields">
            <PlaceSearch label="From" value={from} onChange={p => { updateFrom(p); setPick(null); if (p) setSheetState('mid'); }} onFocus={() => setSheetState('expanded')} actions={<>
              <button type="button" className="location-control gps-control" aria-label="Use my location" aria-busy={gpsLoading} disabled={gpsLoading} onClick={() => gps()}><LocationIcon kind="gps"/><span>{gpsLoading ? 'Locating…' : 'Use my location'}</span></button>
              <MapPinButton target="origin" active={pick === 'from'} onClick={() => choosePin('from')} onPreview={p => setPinPreview(p ? { ...p, target: 'from' } : null)} onDrop={p => dropPin(p, 'from')}/>
            </>} />
            <PlaceSearch label="To" value={to} onChange={p => { updateTo(p); setPick(null); if (p) setSheetState('mid'); }} onFocus={() => setSheetState('expanded')} actions={<>
              <MapPinButton target="destination" active={pick === 'to'} onClick={() => choosePin('to')} onPreview={p => setPinPreview(p ? { ...p, target: 'to' } : null)} onDrop={p => dropPin(p, 'to')}/>
            </>} />
          </div>
          <div className="time-toggle" aria-label="Departure mode"><button type="button" className={mode === 'now' ? 'active' : ''} aria-pressed={mode === 'now'} onClick={() => { reset(); setMode('now'); }}>Leave now</button><button type="button" className={mode === 'scheduled' ? 'active' : ''} aria-pressed={mode === 'scheduled'} onClick={() => { reset(); setMode('scheduled'); }}>Depart at</button></div>
          {mode === 'scheduled' && <div className="scheduled"><label htmlFor="departure-hour">Departure</label><div className="time-picker">
            <select id="departure-hour" aria-label="Departure hour" value={departure.slice(0, 2)} onChange={e => { reset(); setDeparture(e.target.value + ':' + departure.slice(3, 5)); }}>{Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}</select>
            <span aria-hidden="true">:</span>
            <select aria-label="Departure minute" value={departure.slice(3, 5)} onChange={e => { reset(); setDeparture(departure.slice(0, 2) + ':' + e.target.value); }}>{Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}</select>
          </div></div>}
          <button className="plan-button" type="submit" disabled={loading || !config}>{loading ? 'Finding route…' : 'Find route'}<span aria-hidden="true">→</span></button>
          {error && <div className="error" role="alert">{error}</div>}
          {health === 'offline' && !error && <div className="error" role="status">Routing unavailable. Check the backend and try again.</div>}
        </form>
        {loading && <div className="loading-state" role="status"><div className="spinner"/>Checking routes…</div>}
        {results && <section ref={resultsPanel} className="results" aria-label="Journey results" aria-live="polite"><div className="results-heading"><h1>Routes</h1></div>{journeys.map(i => <JourneyCard key={i.id} journey={i} active={i.id === selectedId} selected={i.id === expandedId} requestedDeparture={results.requestedDeparture} onSelect={() => { setSelectedId(i.id); setExpandedId(id => id === i.id ? null : i.id); }}/>) }{!journeys.length && <p className="empty-results">No routes found. Try a different time or location.</p>}<div className="warnings">{results.warnings.filter(w => !w.startsWith('Scheduled timetables;')).map(w => <p key={w}>{w}</p>)}</div></section>}
      </BottomSheet>
    </main>
    {pinPreview && <div aria-hidden="true" className={`journey-pin ${pinPreview.target === 'from' ? 'origin-pin' : 'destination-pin'} menu-pin-preview`} style={{ position: 'fixed', left: pinPreview.x - 22, top: pinPreview.y - 22, width: 44, height: 44, zIndex: 10000, pointerEvents: 'none' }}><span><b>{pinPreview.target === 'from' ? 'A' : 'B'}</b></span></div>}
    <dialog ref={infoDialog} className="info-panel" onClose={() => setInfoOpen(false)}>
      <div className="info-heading"><h2>Durham Journeys</h2><button className="close-info" type="button" onClick={() => setInfoOpen(false)} aria-label="Close information" autoFocus>×</button></div>
      <p className={'status ' + health}><i/>{health === 'ready' ? 'Routing connected' : health === 'loading' ? 'Connecting…' : 'Routing unavailable'}</p>
      <p>Scheduled buses and walking in Durham, England. Live delays and cancellations are not included. All times use Europe/London.</p>
      {config && <><dl><div><dt>Timetable</dt><dd>BODS / Department for Transport</dd></div><div><dt>Feed version</dt><dd>{config.feed.version}</dd></div><div><dt>Downloaded</dt><dd>{dateLabel(config.feed.downloadedAt)}</dd></div><div><dt>Feed range</dt><dd>{config.feed.startDate} – {config.feed.endDate}</dd></div></dl><p className="info-note">Individual service dates apply. {config.operators.join(', ')}.</p><button className="example-button" type="button" onClick={example}>Load verified Bus Station → Dryburn Park journey</button></>}
      <p className="info-note">© OpenStreetMap contributors. Building map points may not be accessible entrances. Independent project; not affiliated with Durham University.</p>
    </dialog>
  </div>;
}
