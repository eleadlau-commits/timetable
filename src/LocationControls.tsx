export function LocationIcon({ kind }: { kind: 'gps' | 'pin' }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'gps' ? <><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></> : <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></>}
  </svg>;
}
export type DragPosition = { x: number; y: number };
export function MapPinButton({ target, active, onClick, onPreview, onDrop }: {
  target: 'origin' | 'destination'; active: boolean; onClick: () => void;
  onPreview: (point: DragPosition | null) => void; onDrop: (point: DragPosition) => void;
}) {
  const gesture = useRef<{ id: number; x: number; y: number; touch: boolean; dragging: boolean; cancelled: boolean; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => () => { if (gesture.current?.timer) clearTimeout(gesture.current.timer); }, []);
  return <button type="button" className="location-control pin-control" aria-label={`Place ${target} on map`} title={`Place ${target} on map`} aria-pressed={active}
    style={{ touchAction: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
    onContextMenu={e => e.preventDefault()}
    onPointerDown={e => {
      if (e.button !== 0) return;
      suppressClick.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
      const state = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse', dragging: false, cancelled: false, timer: undefined as ReturnType<typeof setTimeout> | undefined };
      gesture.current = state;
      if (state.touch) state.timer = setTimeout(() => { if (gesture.current === state && !state.cancelled) { state.dragging = true; onPreview({ x: state.x, y: state.y }); } }, 350);
    }}
    onPointerMove={e => {
      const state = gesture.current; if (!state || state.id !== e.pointerId || state.cancelled) return;
      const moved = Math.hypot(e.clientX - state.x, e.clientY - state.y) > 6;
      if (moved && !state.dragging) {
        if (state.touch) { state.cancelled = true; clearTimeout(state.timer); suppressClick.current = true; return; }
        state.dragging = true;
      }
      if (state.dragging) { e.preventDefault(); onPreview({ x: e.clientX, y: e.clientY }); }
    }}
    onPointerUp={e => {
      const state = gesture.current; if (!state || state.id !== e.pointerId) return;
      clearTimeout(state.timer); gesture.current = null;
      suppressClick.current = true;
      if (state.dragging) onDrop({ x: e.clientX, y: e.clientY });
      else if (!state.cancelled) onClick();
      onPreview(null);
    }}
    onPointerCancel={() => { clearTimeout(gesture.current?.timer); gesture.current = null; suppressClick.current = true; onPreview(null); }}
    onClick={e => { if (e.detail === 0) { suppressClick.current = false; onClick(); return; } if (suppressClick.current) { suppressClick.current = false; return; } onClick(); }}><LocationIcon kind="pin"/></button>;
}
import { useEffect, useRef } from 'react';

