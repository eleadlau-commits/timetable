import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Place } from '../shared/types';

type Props = { label: string; value: Place | null; onChange: (place: Place | null) => void; onFocus: () => void; actions?: ReactNode };
export default function PlaceSearch({ label, value, onChange, onFocus, actions }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const query = draft.trim();

  // Draft text never changes the committed selection or its map coordinates.
  function beginEditing() { setEditing(true); setDraft(''); setActive(-1); onFocus(); }
  function restore() { setEditing(false); setDraft(''); setSuggestions([]); setError(''); setLoading(false); setActive(-1); }
  function select(place: Place) { onChange(place); restore(); }

  useEffect(() => {
    setSuggestions([]); setActive(-1); setError('');
    if (!editing || query.length < 2) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      api<{ places: Place[] }>('/places?q=' + encodeURIComponent(query), { signal: controller.signal })
        .then(data => { if (!controller.signal.aborted) { setSuggestions(data.places); if (!data.places.length && draft) setError('No matching places. Try another name or use the map pin.'); } })
        .catch(e => { if (!controller.signal.aborted && e.name !== 'AbortError') setError('Place search is unavailable. Please try again.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, editing, draft]);

  return <div className="place-search">
    <label htmlFor={id}>{label}</label>
    <div className="place-input-row">
      <div className={'input-wrap ' + (value ? 'chosen' : '')}>
        <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
        <input ref={input} id={id} role="combobox" aria-expanded={editing && suggestions.length > 0}
          aria-controls={id + '-list'} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
          value={editing ? draft : value?.name || ''} placeholder={label === 'From' ? 'Search starting point' : 'Search destination'} autoComplete="off"
          onFocus={beginEditing} onPointerDown={() => { if (!editing) beginEditing(); }} onBlur={restore}
          onChange={e => { setEditing(true); setDraft(e.target.value); }}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); restore(); return; }
            if (!editing && (e.key.length === 1 && !e.ctrlKey && !e.metaKey || e.key === 'Backspace' || e.key === 'Delete')) {
              e.preventDefault(); beginEditing(); setDraft(e.key.length === 1 ? e.key : ''); return;
            }
            if (e.key === 'ArrowDown') { e.preventDefault(); if (!editing) beginEditing(); else if (suggestions.length) setActive(a => Math.min(a + 1, suggestions.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); if (suggestions.length) setActive(a => Math.max(a - 1, 0)); }
            if (e.key === 'Enter' && editing) { e.preventDefault(); const place = suggestions[active] || (suggestions.length === 1 ? suggestions[0] : null); if (place) select(place); }
          }} />
        {value && !editing && <button type="button" className="clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => { onChange(null); restore(); }}>×</button>}
      </div>
      {actions}
    </div>
    {editing && (suggestions.length > 0 || error || loading) && <div className="suggestions" id={id + '-list'} role="listbox" aria-label={`${label} suggestions`}>
      {loading && <div className="suggestion-message" role="status">Searching Durham…</div>}
      {error && <div className="suggestion-message" role="status">{error}</div>}
      {suggestions.map((p, i) => <button key={p.id} id={`${id}-${i}`} type="button" role="option" tabIndex={-1}
        aria-selected={i === active} className={i === active ? 'active' : ''}
        onPointerDown={e => e.preventDefault()} onMouseDown={e => e.preventDefault()} onClick={() => select(p)}>
        <strong>{p.name}</strong><span>{p.category}</span>
      </button>)}
    </div>}
  </div>;
}
