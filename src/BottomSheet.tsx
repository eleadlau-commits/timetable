import { useRef, useState, type ReactNode } from 'react';

export type SheetState = 'collapsed' | 'mid' | 'expanded';
const states: SheetState[] = ['collapsed', 'mid', 'expanded'];
export function sheetHeight(state: SheetState, viewport: number) {
  return state === 'collapsed' ? 104 : Math.round(viewport * (state === 'mid' ? .54 : .88));
}

export default function BottomSheet({ state, onStateChange, heading, children }: {
  state: SheetState; onStateChange: (state: SheetState) => void; heading: ReactNode; children: ReactNode;
}) {
  const sheet = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; y: number; height: number; moved: boolean; current: number } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const ignoreClick = useRef(false);
  const height = state === 'collapsed' ? '104px' : state === 'mid' ? '54%' : '88%';
  return <aside ref={sheet} className={'planner ' + (dragHeight !== null ? 'sheet-dragging' : '')} aria-label="Journey planner" data-state={state}
    style={{ height: dragHeight === null ? height : dragHeight }}>
    <button type="button" className="sheet-grabber" aria-label="Resize journey panel" aria-expanded={state !== 'collapsed'}
      onPointerDown={e => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId); ignoreClick.current = false;
        const h = sheet.current!.getBoundingClientRect().height;
        drag.current = { id: e.pointerId, y: e.clientY, height: h, moved: false, current: h };
      }}
      onPointerMove={e => {
        const d = drag.current; if (!d || d.id !== e.pointerId) return;
        if (Math.abs(e.clientY - d.y) < 3 && !d.moved) return;
        d.moved = true;
        const viewport = sheet.current!.parentElement!.getBoundingClientRect().height;
        d.current = Math.max(104, Math.min(viewport * .88, d.height + d.y - e.clientY));
        setDragHeight(d.current);
      }}
      onPointerUp={e => {
        const d = drag.current; if (!d || d.id !== e.pointerId) return;
        drag.current = null; ignoreClick.current = d.moved;
        if (d.moved) {
          const viewport = sheet.current!.parentElement!.getBoundingClientRect().height;
          onStateChange(states.reduce((best, next) => Math.abs(sheetHeight(next, viewport) - d.current) < Math.abs(sheetHeight(best, viewport) - d.current) ? next : best));
        }
        setDragHeight(null);
      }}
      onPointerCancel={() => { drag.current = null; ignoreClick.current = true; setDragHeight(null); }}
      onClick={() => { if (ignoreClick.current) { ignoreClick.current = false; return; } onStateChange(states[(states.indexOf(state) + 1) % states.length]); }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') ignoreClick.current = false;
        if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
          e.preventDefault(); onStateChange(e.key === 'Home' ? 'collapsed' : e.key === 'End' ? 'expanded' : states[Math.max(0, Math.min(2, states.indexOf(state) + (e.key === 'ArrowUp' ? 1 : -1)))]);
        }
      }}><span className="sheet-handle" aria-hidden="true"/></button>
    <div className="sheet-heading">{heading}</div>
    <div className="sheet-body">{children}</div>
  </aside>;
}
