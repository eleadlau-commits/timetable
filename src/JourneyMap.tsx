import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import L from 'leaflet';
import type { Itinerary, Place, Point } from '../shared/types';
import { decodePolyline } from '../shared/polyline';

type Target = 'from' | 'to';
export type MapActions = { pointAtClient: (x: number, y: number) => Point | null; recenter: (point: Point) => void };
type Props = { from: Place | null; to: Place | null; itinerary: Itinerary | null; pick: Target | null; onPick: (point: Point, target: Target, placement?: boolean) => void; actions: RefObject<MapActions | null> };

export default function JourneyMap({ from, to, itinerary, pick, onPick, actions }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);
  const markers = useRef<Record<Target, L.Marker | null>>({ from: null, to: null });
  const routeBounds = useRef<L.LatLngBounds | null>(null);
  const fitRoute = useRef<() => void>(() => {});
  const interaction = useRef({ pick, onPick });
  const [tileError, setTileError] = useState(false);
  const [geometryError, setGeometryError] = useState(false);
  interaction.current = { pick, onPick };
  useImperativeHandle(actions, () => ({ recenter: point => {
    const instance = map.current; if (!instance) return;
    instance.panTo([point.lat, point.lon], { animate: false });
    const height = document.querySelector('.planner')?.getBoundingClientRect().height || 0;
    instance.panBy([0, height / 2], { animate: false });
  }, pointAtClient: (x, y) => {
    const hit = document.elementFromPoint(x, y);
    if (!map.current || !element.current || !hit?.closest('.map') || hit.closest('.leaflet-control')) return null;
    const box = element.current.getBoundingClientRect();
    const point = map.current.containerPointToLatLng([x - box.left, y - box.top]);
    return { lat: point.lat, lon: point.lng };
  } }), []);
  const suppressPlacementUntil = useRef(0);

  useEffect(() => {
    if (!element.current) return;
    const instance = L.map(element.current, { zoomControl: false }).setView([54.7749, -1.5810], 14);
    map.current = instance;
    fitRoute.current = () => {
      const bounds = routeBounds.current;
      if (!bounds?.isValid()) return;
      const panel = document.querySelector('.planner')?.getBoundingClientRect();
      instance.fitBounds(bounds, { paddingTopLeft: [24, 64], paddingBottomRight: [24, (panel?.height || 320) + 24], maxZoom: 16 });
    };
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).on('tileerror', () => setTileError(true)).addTo(instance);
    layers.current = L.layerGroup().addTo(instance);
    instance.on('click', e => { const current = interaction.current; if (current.pick && Date.now() >= suppressPlacementUntil.current) current.onPick({ lat: e.latlng.lat, lon: e.latlng.lng }, current.pick, true); });
    let size = instance.getSize();
    const resize = new ResizeObserver(() => {
      const panel = document.querySelector('.planner')?.getBoundingClientRect();
      element.current?.style.setProperty('--panel-height', `${panel?.height || 320}px`);
      instance.invalidateSize({ pan: false });
      const next = instance.getSize();
      // Suggestions and panel resizing must not move the map under a finger.
      if (!next.equals(size)) { size = next; fitRoute.current(); }
    });
    resize.observe(element.current);
    const panel = document.querySelector('.planner'); if (panel) resize.observe(panel);
    return () => { resize.disconnect(); instance.remove(); map.current = null; layers.current = null; markers.current = { from: null, to: null }; };
  }, []);

  useEffect(() => {
    // Rapid placement taps must not be interpreted as a double-tap zoom.
    // Keep the placement click out of Leaflet's 200ms double-tap detector.
    // Pinch and wheel navigation remain available throughout placement.
    if (pick) { map.current?.doubleClickZoom.disable(); return; }
    const timer = window.setTimeout(() => map.current?.doubleClickZoom.enable(), 250);
    return () => window.clearTimeout(timer);
  }, [pick]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    for (const target of ['from', 'to'] as const) {
      const place = target === 'from' ? from : to;
      let marker = markers.current[target];
      if (!place) { marker?.remove(); markers.current[target] = null; continue; }
      const changed = !marker || !marker.getLatLng().equals([place.lat, place.lon]);
      if (!marker) {
        const name = target === 'from' ? 'Origin' : 'Destination';
        marker = L.marker([place.lat, place.lon], {
          draggable: true, autoPan: false, autoPanOnFocus: false, keyboard: true, title: `${name} marker`,
          icon: L.divIcon({ className: `journey-pin ${target === 'from' ? 'origin-pin' : 'destination-pin'}`, html: `<span><b>${target === 'from' ? 'A' : 'B'}</b></span>`, iconSize: [44, 44], iconAnchor: [22, 22] }),
        }).addTo(instance);
        markers.current[target] = marker;
        const owned = marker;
        const commit = () => { const p = owned.getLatLng(); interaction.current.onPick({ lat: p.lat, lon: p.lng }, target); };
        marker.on('dragstart', () => { suppressPlacementUntil.current = Infinity; owned.closeTooltip(); });
        marker.on('dragend', () => { suppressPlacementUntil.current = Date.now() + 250; commit(); });
        const icon = marker.getElement();
        icon?.setAttribute('aria-label', `${name} marker. Drag or use arrow keys to move.`);
        icon?.addEventListener('keydown', e => {
          const direction: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
          const delta = direction[e.key]; if (!delta) return;
          e.preventDefault(); e.stopPropagation();
          const point = instance.latLngToContainerPoint(owned.getLatLng()).add(L.point(delta));
          owned.setLatLng(instance.containerPointToLatLng(point)); commit();
        });
      } else {
        marker.setLatLng([place.lat, place.lon]);
      }
      const tooltip = document.createElement('span'); tooltip.textContent = `${target === 'from' ? 'A' : 'B'}: ${place.name}`;
      if (marker.getTooltip()) marker.setTooltipContent(tooltip); else marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -20] });
      // A searched/GPS point outside the view is revealed without changing zoom.
      // Map placement and dragging already happen in the user's chosen view.
      if (changed && place.source !== 'Map selection' && !instance.getBounds().contains([place.lat, place.lon])) instance.panTo([place.lat, place.lon], { animate: false });
    }
  }, [from, to]);

  useEffect(() => {
    if (!map.current || !layers.current) return;
    const group = layers.current; group.clearLayers();
    const bounds = L.latLngBounds([]);
    setGeometryError(false);
    itinerary?.legs.forEach(leg => {
      if (leg.legGeometry?.points) {
        try {
          const points = decodePolyline(leg.legGeometry.points);
          if (points.length) { L.polyline(points, { color: leg.mode === 'BUS' ? '#007AFF' : '#78848c', weight: leg.mode === 'BUS' ? 5 : 3, dashArray: leg.mode === 'WALK' ? '5 7' : undefined, opacity: .9 }).addTo(group); points.forEach(p => bounds.extend(p)); }
        } catch { setGeometryError(true); }
      }
      if (leg.mode === 'BUS') [leg.from, leg.to].forEach(stop => {
        const label = document.createElement('span'); label.textContent = stop.name;
        L.circleMarker([stop.lat, stop.lon], { radius: 4, color: '#007AFF', fillColor: '#fff', fillOpacity: 1, weight: 2 }).bindTooltip(label).addTo(group);
      });
    });
    routeBounds.current = itinerary ? bounds : null;
    if (itinerary) fitRoute.current();
  }, [itinerary]);

  return <section className="map-panel" aria-label="Durham, England journey map">
    <div ref={element} className="map" />
    {pick && <div className="map-hint placing" role="status" aria-live="polite">Tap map to place {pick === 'from' ? 'start' : 'destination'}</div>}
    {itinerary && <div className="map-legend"><span><i className="bus-line"/>Bus</span><span><i className="walk-line"/>Walk</span></div>}
    {(tileError || geometryError) && <div className="map-error" role="status">{geometryError ? 'A route geometry could not be displayed. Journey details remain available.' : 'Map tiles could not load. Check your internet connection; journey details remain available.'}</div>}
  </section>;
}
