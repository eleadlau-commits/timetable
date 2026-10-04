
import { parseICS, expandEvents } from './ics.js';
import { lookupPlace } from './places.js';
import { FORMATS, drawableFormat, checkBarcode, barcodeSVG } from './barcode.js';

const K = {
  url: 'tt.url',
  relay: 'tt.relay',
  ics: 'tt.ics',
  updated: 'tt.updated',
  source: 'tt.source',
  view: 'tt.view',
  prefs: 'tt.prefs',
};
const DAY = 86400000;
const STALE_MS = 30 * 60 * 1000;
const HOUR_PX = 52; // keep in sync with .wk-col background in styles.css
const VIEWS = ['day', 'week', 'agenda'];
const PALETTE = [0, 22, 42, 95, 140, 172, 198, 222, 255, 285, 320];
const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
// Fallback barcode reader for phones whose browser has no built-in BarcodeDetector.
const ZXING_LIB = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
// True inside the Android app. There, Capacitor routes fetch() through native code,
// so the university server can't block it and the relay/QR options aren't needed.
const NATIVE = !!window.Capacitor?.isNativePlatform?.();

// localStorage can throw (private mode, storage blocked) – never let that break the app.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, String(v));
      return true;
    } catch { return false; }
  },
};

const $ = (s) => document.querySelector(s);

let events = [];
let calName = '';
let selected = startOfDay(new Date());
let view = VIEWS.includes(store.get(K.view)) ? store.get(K.view) : 'day';
let busy = false;
let forceSetup = false;
let pendingRelay = null;
let lastRefreshFailed = false;
let prefs = loadPrefs();
let currentSession = null;
let editingModule = null;
let noteTimer;

/* ---------- personal settings: hidden modules, names, colours, notes ---------- */

function emptyPrefs() {
  return {
    hidden: {}, names: {}, colours: {}, notes: {}, places: {}, mapsArea: '',
    // lead: minutes before every class (0 = off); sessions: per-session override by session key;
    // custom: the user's own one-off reminders, { id, title, at (ms) }.
    reminders: { lead: 0, sessions: {}, custom: [] },
    // The scanned campus card barcode, { format, value }.
    card: null,
  };
}

function loadPrefs() {
  try {
    return { ...emptyPrefs(), ...JSON.parse(store.get(K.prefs) || '{}') };
  } catch {
    return emptyPrefs();
  }
}

function savePrefs() {
  if (!store.set(K.prefs, JSON.stringify(prefs))) toast("Couldn't save that change on this device.");
}

/* ---------- dates & formatting ---------- */

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d) { const x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); }
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const fmtTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d, month = 'long') => d.toLocaleDateString([], { day: 'numeric', month });
const timeRange = (e) => (e.allDay ? 'All day' : `${fmtTime(e.start)}–${fmtTime(e.end)}`);

function dayLabel(d) {
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long' });
}

function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

function inTime(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `in ${h} h${r ? ` ${r} min` : ''}`;
}

/* ---------- DOM helpers ---------- */

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false || kid === '') continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

const ICONS = {
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  note: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
};
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name];
  return svg;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}

/* ---------- modules & presentation ---------- */

// Sessions are grouped into modules by their code (e.g. "ECON1011"), or by title if there's no code.
const CODE_RE = /\b[A-Z]{2,5}\s?\d{3,5}[A-Z]?\b/;
function moduleKey(title) {
  const m = title.match(CODE_RE);
  return m ? m[0].replace(/\s/g, '') : title.trim();
}

function hueFor(key) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}

const moduleHue = (key) => prefs.colours[key] ?? hueFor(key);
const nameOf = (e) => prefs.names[e.module] || e.title;
const shortName = (e) => prefs.names[e.module] || e.module;
const isShown = (e) => !prefs.hidden[e.module];

const KINDS = ['Lecture', 'Seminar', 'Tutorial', 'Practical', 'Workshop', 'Lab', 'Exam', 'Drop-in', 'Fieldwork']
  .map((k) => [k, new RegExp(`\\b${k}`, 'i')]);

function kindOf(e) {
  for (const [k, re] of KINDS) if (re.test(e.title)) return k;
  const desc = e.description.slice(0, 300);
  for (const [k, re] of KINDS) if (re.test(desc)) return k;
  return '';
}

// Badge for a card: the session type, unless the displayed name already says it.
function badgeFor(e) {
  if (e.cancelled) return 'Cancelled';
  const k = kindOf(e);
  return k && !new RegExp(`\\b${k}`, 'i').test(nameOf(e)) ? k : '';
}

const ONLINE_RE = /\b(online|teams|zoom|virtual|remote|collaborate)\b/i;
const isPhysical = (location) => !!location && !/https?:\/\//.test(location) && !ONLINE_RE.test(location);

// The building part of a location: room codes like "CLC013" removed, as they confuse map
// searches. Locations that are only a code stay as they are.
function buildingOf(location) {
  const building = location.replace(/\b[A-Z]{1,5}\d{2,4}[A-Z]?\b/g, '').replace(/\s{2,}/g, ' ').replace(/[\s,;–-]+$/, '').trim();
  return building || location.trim();
}

// The full building name the user typed for this location, if any.
const placeName = (location) => (isPhysical(location) ? prefs.places[buildingOf(location)] || '' : '');

// The building from the built-in list of room codes (places.js), if the location has a known code.
const knownPlace = (location) => (isPhysical(location) ? lookupPlace(location) : null);

// Short building name to show next to the location: what the user typed, else the built-in name.
function buildingName(location) {
  return placeName(location).split(',')[0].trim() || knownPlace(location)?.building || '';
}

// Location as shown on cards: the timetable's text, plus the building name when it adds something.
function placeLabel(location) {
  const full = buildingName(location);
  return full && !location.toLowerCase().includes(full.toLowerCase()) ? `${location} · ${full}` : location;
}

function placeLink(location) {
  if (!location) return null;
  const url = location.match(/https?:\/\/\S+/);
  if (url) return url[0];
  if (!isPhysical(location)) return null;
  const typed = placeName(location);
  const known = knownPlace(location);
  let query;
  if (typed) {
    const area = prefs.mapsArea && !typed.toLowerCase().includes(prefs.mapsArea.toLowerCase()) ? prefs.mapsArea : '';
    query = [typed, area].filter(Boolean).join(', ');
  } else if (known) {
    // Coordinates put the pin exactly on the building rather than wherever a text search lands.
    query = `${known.lat},${known.lng}`;
  } else {
    query = [buildingOf(location), prefs.mapsArea].filter(Boolean).join(', ');
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function eventsOn(d, includeHidden = false) {
  const from = startOfDay(d);
  const to = addDays(from, 1);
  return events.filter((e) =>
    (includeHidden || isShown(e)) &&
    e.start < to && (e.end > from || (e.end.getTime() === e.start.getTime() && e.start >= from))
  );
}

function card(e, now, extra) {
  const past = e.end <= now;
  const live = e.start <= now && now < e.end && !e.cancelled;
  const badge = badgeFor(e);
  const link = placeLink(e.location);
  const note = prefs.notes[e.key];
  return el('article', {
    class: `card${past ? ' past' : ''}${live ? ' now' : ''}${e.cancelled ? ' cancelled' : ''}`,
    style: `--h:${moduleHue(e.module)}`,
    role: 'button',
    tabindex: '0',
    onclick: () => openSession(e),
    onkeydown: (ev) => {
      if (ev.target === ev.currentTarget && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openSession(e); }
    },
  },
    el('div', { class: 'time' },
      e.allDay ? el('span', {}, 'All day') : [el('span', {}, fmtTime(e.start)), el('span', {}, fmtTime(e.end))]
    ),
    el('div', { class: 'body' },
      el('div', { class: 'title' }, el('span', { class: 'title-text' }, nameOf(e)), badge && el('span', { class: 'badge' }, badge)),
      e.location && (link
        ? el('a', { class: 'meta', href: link, target: '_blank', rel: 'noopener', onclick: (ev) => ev.stopPropagation() },
            icon('pin'), el('span', {}, placeLabel(e.location)))
        : el('div', { class: 'meta' }, icon('pin'), el('span', {}, placeLabel(e.location)))),
      note && el('div', { class: 'meta note' }, icon('note'), el('span', {}, note.split('\n')[0])),
      live && el('div', { class: 'pill' }, `Now · until ${fmtTime(e.end)}`),
      extra
    )
  );
}

function hiddenNote(count) {
  if (!count) return null;
  return el('button', { type: 'button', class: 'link-btn hidden-note', onclick: openModules },
    `${count} hidden session${count > 1 ? 's' : ''} · Manage modules`);
}

/* ---------- rendering ---------- */

function render() {
  const hasData = store.get(K.ics) != null;
  const showSetup = !hasData || forceSetup;
  $('#setup-view').hidden = !showSetup;
  $('#main-view').hidden = showSetup;
  $('#cancel-setup').hidden = !hasData;
  $('#refresh-btn').hidden = showSetup || !store.get(K.url);
  $('#cal-name').textContent = !showSetup && calName ? calName : 'Timetable';
  renderStatus();
  tickReminders();
  if (showSetup) return;

  for (const b of document.querySelectorAll('.seg button')) b.setAttribute('aria-selected', String(b.dataset.view === view));
  for (const v of VIEWS) $(`#${v}-view`).hidden = v !== view;
  if (view === 'day') renderDay();
  else if (view === 'week') renderWeek();
  else renderAgenda();
}

function renderDay() {
  const now = new Date();
  const today = startOfDay(now);
  const week = startOfWeek(selected);

  const strip = $('#week-days');
  strip.replaceChildren();
  for (let i = 0; i < 7; i++) {
    const d = addDays(week, i);
    const isSel = sameDay(d, selected);
    const has = eventsOn(d).some((e) => !e.cancelled);
    strip.append(el('button', {
      type: 'button',
      class: `daybtn${isSel ? ' sel' : ''}${sameDay(d, today) ? ' today' : ''}${has ? ' has' : ''}`,
      'aria-label': d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }),
      'aria-pressed': String(isSel),
      onclick: () => { selected = d; render(); },
    },
      el('span', {}, d.toLocaleDateString([], { weekday: 'short' })),
      el('b', {}, d.getDate()),
      el('i', { class: 'dot' })
    ));
  }

  $('#day-title').replaceChildren(dayLabel(selected), ' ', el('span', {}, fmtDate(selected)));
  $('#today-btn').hidden = sameDay(selected, today);

  const list = $('#day-list');
  const all = eventsOn(selected, true);
  const items = all.filter(isShown);
  const hidden = hiddenNote(all.length - items.length);
  if (!items.length) {
    const weekend = selected.getDay() === 0 || selected.getDay() === 6;
    list.replaceChildren(...[
      el('div', { class: 'empty' },
        el('b', {}, weekend ? 'Nothing scheduled' : 'No classes'),
        el('div', {}, 'Swipe or use the arrows to see other days.')
      ),
      hidden,
    ].filter(Boolean));
    return;
  }
  const next = sameDay(selected, today) ? items.find((e) => e.start > now && !e.cancelled) : null;
  list.replaceChildren(...items.map((e) =>
    card(e, now, e === next && el('div', { class: 'pill next' }, `Next · ${inTime(e.start - now)}`))
  ), ...[hidden].filter(Boolean));
}

// Places overlapping sessions side by side: each block gets a lane and a lane count.
function layoutLanes(blocks) {
  blocks.sort((a, b) => a.top - b.top || b.bottom - a.bottom);
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds = [];
    for (const b of cluster) {
      let lane = laneEnds.findIndex((end) => end <= b.top);
      if (lane < 0) { lane = laneEnds.length; laneEnds.push(0); }
      laneEnds[lane] = b.bottom;
      b.lane = lane;
    }
    for (const b of cluster) b.lanes = laneEnds.length;
    cluster = [];
  };
  for (const b of blocks) {
    if (cluster.length && b.top >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.bottom);
  }
  if (cluster.length) flush();
  return blocks;
}

function renderWeek() {
  const now = new Date();
  const today = startOfDay(now);
  const week = startOfWeek(selected);
  $('#week-label').textContent = `${fmtDate(week, 'short')} – ${fmtDate(addDays(week, 6), 'short')}`;
  $('#this-week-btn').hidden = sameDay(week, startOfWeek(today));

  // Weekdays always; Saturday and Sunday only when something's on.
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(week, i);
    const items = eventsOn(d);
    if (i < 5 || items.length) days.push({ d, items });
  }

  // Minutes from the start of `day`, clamped to that day.
  const mins = (t, day) => (t >= addDays(day, 1) ? 1440 : t <= day ? 0 : t.getHours() * 60 + t.getMinutes());

  let startH = 9;
  let endH = 17;
  let anyTimed = false;
  for (const { d, items } of days) {
    for (const e of items) {
      if (e.allDay) continue;
      anyTimed = true;
      startH = Math.min(startH, Math.floor(mins(e.start, d) / 60));
      endH = Math.max(endH, Math.ceil(mins(e.end, d) / 60));
    }
  }
  const hours = endH - startH;
  const px = (m) => ((m - startH * 60) / 60) * HOUR_PX;

  const head = el('div', { class: 'wk-row wk-head' }, el('span'), days.map(({ d }) =>
    el('button', {
      type: 'button',
      class: `wk-day${sameDay(d, today) ? ' today' : ''}`,
      'aria-label': `Open ${d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}`,
      onclick: () => { selected = d; view = 'day'; store.set(K.view, view); render(); },
    }, el('span', {}, d.toLocaleDateString([], { weekday: 'short' })), el('b', {}, d.getDate()))
  ));

  const anyAllDay = days.some(({ items }) => items.some((e) => e.allDay));
  const allDayRow = anyAllDay && el('div', { class: 'wk-row wk-allday' },
    el('span', { class: 'wk-gutter' }, 'all day'),
    days.map(({ items }) => el('div', { class: 'wk-cell' }, items.filter((e) => e.allDay).map((e) =>
      el('button', { type: 'button', class: 'wk-chip', style: `--h:${moduleHue(e.module)}`, onclick: () => openSession(e) }, shortName(e))
    )))
  );

  const hourLabels = el('div', { class: 'wk-hours' }, Array.from({ length: hours }, (_, i) =>
    el('span', { style: `top:${i * HOUR_PX}px` }, new Date(2000, 0, 1, startH + i).toLocaleTimeString([], { hour: 'numeric' }))
  ));

  const columns = days.map(({ d, items }) => {
    const blocks = layoutLanes(items.filter((e) => !e.allDay).map((e) => {
      const top = mins(e.start, d);
      return { e, top, bottom: Math.max(mins(e.end, d), top + 20) };
    }));
    const col = el('div', { class: `wk-col${sameDay(d, today) ? ' today' : ''}` }, blocks.map(({ e, top, bottom, lane, lanes }) => {
      const kind = kindOf(e);
      return el('button', {
        type: 'button',
        class: `blk${e.cancelled ? ' cancelled' : ''}${e.end <= now ? ' past' : ''}`,
        style: `--h:${moduleHue(e.module)};--lane:${lane};--lanes:${lanes};top:${px(top)}px;height:${Math.max(18, px(bottom) - px(top) - 2)}px`,
        'aria-label': `${nameOf(e)}, ${timeRange(e)}${e.location ? `, ${e.location}` : ''}`,
        onclick: () => openSession(e),
      }, el('b', {}, shortName(e)), kind && el('small', {}, kind), e.location && el('small', {}, e.location));
    }));
    if (sameDay(d, today)) {
      const m = now.getHours() * 60 + now.getMinutes();
      if (m >= startH * 60 && m <= endH * 60) col.append(el('div', { class: 'now-line', style: `top:${px(m)}px` }));
    }
    return col;
  });

  const body = el('div', { class: 'wk-row wk-body', style: `height:${hours * HOUR_PX}px` }, hourLabels, columns);
  const grid = el('div', { class: 'wk', style: `--cols:${days.length}` }, head, allDayRow, body);
  const empty = !anyTimed && !anyAllDay && el('div', { class: 'empty' }, el('b', {}, 'Nothing scheduled this week'));
  $('#week-grid').replaceChildren(...[empty, grid].filter(Boolean));
}

function renderAgenda() {
  const now = new Date();
  const today = startOfDay(now);
  const box = $('#agenda-list');
  const out = [];
  for (let i = 0; i < 28; i++) {
    const d = addDays(today, i);
    const items = eventsOn(d).filter((e) => e.end > now);
    if (!items.length) continue;
    out.push(
      el('h3', { class: 'agenda-day' }, `${dayLabel(d)} · ${fmtDate(d, 'short')}`),
      el('div', { class: 'list' }, items.map((e) => card(e, now)))
    );
  }
  if (!out.length) {
    out.push(el('div', { class: 'empty' },
      el('b', {}, 'Nothing in the next four weeks'),
      el('div', {}, 'If that looks wrong, tap refresh or check your export link in Settings.')
    ));
  }
  box.replaceChildren(...out);
}

function renderStatus() {
  const updated = +store.get(K.updated) || 0;
  const parts = [];
  if (store.get(K.ics) != null && updated) {
    parts.push(store.get(K.source) === 'file' ? `Imported ${ago(updated)}` : `Updated ${ago(updated)}`);
  }
  if (!navigator.onLine) parts.push('offline');
  else if (lastRefreshFailed) parts.push("couldn't refresh");
  $('#status').textContent = parts.join(' · ');
}

function setBusy(on) {
  busy = on;
  $('#refresh-btn').classList.toggle('spin', on);
  for (const id of ['#load-btn', '#set-save']) $(id).disabled = on;
  $('#load-btn').textContent = on ? 'Loading…' : 'Load timetable';
}

/* ---------- session details, notes & module editing ---------- */

function openSession(e) {
  currentSession = e;
  fillSession();
  $('#ses-note').value = prefs.notes[e.key] || '';
  $('#ses-place-name').value = placeName(e.location);
  $('#ses-place-name').placeholder = isPhysical(e.location) ? buildingOf(e.location) : '';
  $('#ses-place-edit').open = false;
  $('#ses-remind-wrap').hidden = e.allDay || e.cancelled || e.start <= new Date();
  $('#ses-remind').value = String(prefs.reminders.sessions[e.key] ?? 'default');
  $('#session-dialog').showModal();
}

function fillSession() {
  const e = currentSession;
  if (!e) return;
  $('#session-dialog').style.setProperty('--h', moduleHue(e.module));
  $('#ses-title').textContent = nameOf(e);
  const original = $('#ses-original');
  original.textContent = e.title;
  original.hidden = !prefs.names[e.module];
  $('#ses-when').textContent = `${e.start.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} · ${timeRange(e)}${e.cancelled ? ' · Cancelled' : ''}`;
  $('#ses-place').hidden = !e.location;
  $('#ses-place-text').textContent = placeLabel(e.location);
  $('#ses-place-edit').hidden = !isPhysical(e.location);
  const typed = placeName(e.location);
  const known = knownPlace(e.location);
  const detail = $('#ses-place-detail');
  detail.textContent = known && !typed
    ? [known.room, `${known.building}, ${known.address}`].filter(Boolean).join(' · ')
    : '';
  detail.hidden = !detail.textContent;
  showMap(known && !typed ? known : null);
  $('#ses-place-summary').textContent = typed
    ? `Building: ${typed} (change)`
    : known ? 'Wrong building? Type the right one' : 'Unknown building? Type its full name';
  const link = placeLink(e.location);
  const directions = $('#ses-directions');
  directions.hidden = !link;
  if (link) {
    directions.href = link;
    directions.textContent = link.startsWith('https://www.google.com/maps') ? 'Directions' : 'Open link';
  }
  $('#ses-desc').textContent = e.description;
  $('#ses-desc').hidden = !e.description;
}

// Small OpenStreetMap preview with a pin on the building. Needs internet; collapses when offline.
function showMap(place) {
  const frame = $('#ses-map');
  if (!place || !navigator.onLine) {
    frame.hidden = true;
    frame.removeAttribute('src');
    return;
  }
  const { lat, lng } = place;
  const bbox = [lng - 0.0013, lat - 0.0005, lng + 0.0013, lat + 0.0005].map((n) => n.toFixed(5)).join(',');
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  if (frame.getAttribute('src') !== src) frame.src = src;
  frame.title = `Map showing ${place.building}`;
  frame.hidden = false;
}

function saveNote() {
  clearTimeout(noteTimer);
  if (!currentSession) return;
  const text = $('#ses-note').value.trim();
  const key = currentSession.key;
  if ((prefs.notes[key] || '') === text) return;
  if (text) prefs.notes[key] = text;
  else delete prefs.notes[key];
  savePrefs();
}

function openModules() {
  renderModules();
  $('#modules-dialog').showModal();
}

function renderModules() {
  const now = new Date();
  const mods = new Map();
  for (const e of events) {
    let m = mods.get(e.module);
    if (!m) mods.set(e.module, (m = { key: e.module, upcoming: 0 }));
    if (e.start > now && !e.cancelled) m.upcoming++;
  }
  const label = (key) => prefs.names[key] || key;
  const sorted = [...mods.values()].sort((a, b) => label(a.key).localeCompare(label(b.key)));
  const box = $('#modules-list');
  if (!sorted.length) {
    box.replaceChildren(el('p', { class: 'hint' }, 'No modules yet.'));
    return;
  }
  box.replaceChildren(...sorted.map(({ key, upcoming }) => {
    const shown = !prefs.hidden[key];
    return el('div', { class: `mod-row${shown ? '' : ' off'}` },
      el('button', { type: 'button', class: 'mod-main', onclick: () => openModule(key) },
        el('span', { class: 'mod-swatch', style: `--h:${moduleHue(key)}`, 'aria-hidden': 'true' }),
        el('span', { class: 'mod-text' },
          el('b', {}, label(key)),
          el('small', {}, [prefs.names[key] ? key : '', `${upcoming} upcoming`].filter(Boolean).join(' · '))
        )
      ),
      el('label', { class: 'switch' },
        el('input', {
          type: 'checkbox',
          checked: shown,
          'aria-label': `Show ${label(key)}`,
          onchange: (ev) => {
            if (ev.target.checked) delete prefs.hidden[key];
            else prefs.hidden[key] = true;
            savePrefs();
            afterModuleChange();
          },
        }),
        el('span', { class: 'slider', 'aria-hidden': 'true' })
      )
    );
  }));
}

function openModule(key) {
  editingModule = key;
  const sample = events.find((e) => e.module === key);
  const example = $('#mod-example');
  example.textContent = sample && sample.title !== key ? `For sessions like “${sample.title}”.` : '';
  example.hidden = !example.textContent;
  $('#mod-name').value = prefs.names[key] || '';
  $('#mod-name').placeholder = key;
  $('#mod-show').checked = !prefs.hidden[key];
  renderSwatches();
  $('#module-dialog').showModal();
}

function renderSwatches() {
  const key = editingModule;
  const current = prefs.colours[key];
  const options = [{ hue: hueFor(key), auto: true }, ...PALETTE.map((hue) => ({ hue }))];
  $('#mod-swatches').replaceChildren(...options.map((o) => el('button', {
    type: 'button',
    class: 'swatch',
    style: `--h:${o.hue}`,
    role: 'radio',
    'aria-checked': String(o.auto ? current == null : current === o.hue),
    'aria-label': o.auto ? 'Automatic colour' : `Colour ${PALETTE.indexOf(o.hue) + 1}`,
    onclick: () => {
      if (o.auto) delete prefs.colours[key];
      else prefs.colours[key] = o.hue;
      savePrefs();
      renderSwatches();
      afterModuleChange();
    },
  }, o.auto ? 'A' : '')));
}

function afterModuleChange() {
  render();
  if ($('#modules-dialog').open) renderModules();
  if ($('#session-dialog').open) fillSession();
}

/* ---------- reminders ---------- */

const LEADS = [
  [0, 'Off'], [5, '5 minutes before'], [10, '10 minutes before'], [15, '15 minutes before'],
  [30, '30 minutes before'], [60, '1 hour before'], [120, '2 hours before'],
];
const MAX_SCHEDULED = 60; // Android keeps the next reminders only; the list is rebuilt as time passes.
// Only present in the Android app. The web version can remind you only while it's open.
const Notifier = window.Capacitor?.Plugins?.LocalNotifications;
let syncChain = Promise.resolve();
let syncedSig = '';
let channelMade = false;
const firedWeb = new Set();

// Minutes before a session that its reminder goes off (0 = none): its own setting, else the general one.
const leadFor = (e) => prefs.reminders.sessions[e.key] ?? prefs.reminders.lead;

// Every reminder due after `from`, soonest first: class reminders, then the user's own.
function reminderList(from) {
  const out = [];
  for (const e of events) {
    if (!isShown(e) || e.cancelled || e.allDay) continue;
    const lead = leadFor(e);
    const at = new Date(e.start.getTime() - lead * 60000);
    if (!lead || at <= from) continue;
    out.push({
      id: `s:${e.key}`,
      at,
      title: nameOf(e),
      body: [`Starts at ${fmtTime(e.start)}`, e.location && placeLabel(e.location)].filter(Boolean).join(' · '),
    });
  }
  for (const r of prefs.reminders.custom) {
    const at = new Date(r.at);
    if (at > from) out.push({ id: `c:${r.id}`, at, title: r.title, body: 'Reminder' });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX_SCHEDULED);
}

function notificationId(str) {
  let h = 7;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 2147483646) + 1;
}

// Replaces the phone's scheduled notifications with the current list (Android app only).
async function doSync() {
  if (!Notifier) return;
  try {
    const granted = (await Notifier.checkPermissions()).display === 'granted';
    const list = granted ? reminderList(new Date()) : [];
    const sig = list.map((r) => `${r.id}@${+r.at}|${r.title}|${r.body}`).join('\n');
    if (sig === syncedSig) return;
    if (!channelMade) {
      await Notifier.createChannel({ id: 'reminders', name: 'Reminders', description: 'Class and personal reminders', importance: 4, visibility: 1 }).catch(() => {});
      channelMade = true;
    }
    const { notifications } = await Notifier.getPending();
    if (notifications.length) await Notifier.cancel({ notifications: notifications.map(({ id }) => ({ id })) });
    if (list.length) {
      await Notifier.schedule({
        notifications: list.map((r) => ({
          id: notificationId(r.id),
          title: r.title,
          body: r.body,
          channelId: 'reminders',
          schedule: { at: r.at, allowWhileIdle: true },
        })),
      });
    }
    syncedSig = sig;
  } catch { /* try again on the next render */ }
}

function syncReminders() {
  syncChain = syncChain.then(doSync);
}

function showReminderWeb(r) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(r.title, { body: r.body, icon: 'icons/icon-192.png' }); return; } catch { /* use the toast */ }
  }
  toast(`${r.title} · ${r.body}`);
}

// Web version: show reminders that came due in the last few minutes while the app was open.
function checkWebReminders() {
  if (Notifier) return;
  const now = Date.now();
  for (const r of reminderList(new Date(now - 3 * 60000))) {
    const id = `${r.id}@${+r.at}`;
    if (+r.at > now || firedWeb.has(id)) continue;
    firedWeb.add(id);
    showReminderWeb(r);
  }
}

function tickReminders() {
  syncReminders();
  checkWebReminders();
}

async function allowNotifications() {
  if (Notifier) {
    try {
      let p = await Notifier.checkPermissions();
      if (p.display !== 'granted') p = await Notifier.requestPermissions();
      if (p.display === 'granted') { syncReminders(); return true; }
    } catch { /* fall through to the message */ }
    toast('Notifications are blocked. Turn them on in Android Settings → Apps → Timetable → Notifications.');
    return false;
  }
  if ('Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch { /* the toast fallback still works */ }
  }
  return true;
}

function saveReminders() {
  savePrefs();
  syncReminders();
}

function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function openReminders() {
  const now = Date.now();
  const kept = prefs.reminders.custom.filter((r) => r.at > now);
  if (kept.length !== prefs.reminders.custom.length) { prefs.reminders.custom = kept; saveReminders(); }
  $('#rem-lead').value = String(prefs.reminders.lead);
  $('#rem-title').value = '';
  $('#rem-when').value = toLocalInput(new Date(Math.ceil((now + 3600000) / 3600000) * 3600000));
  showError('#rem-error', null);
  renderReminders();
  $('#reminders-dialog').showModal();
}

function renderReminders() {
  const list = [...prefs.reminders.custom].sort((a, b) => a.at - b.at);
  $('#rem-list').replaceChildren(...(list.length
    ? list.map((r) => el('div', { class: 'rem-row' },
        el('div', { class: 'rem-text' },
          el('b', {}, r.title),
          el('small', {}, new Date(r.at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))),
        el('button', {
          type: 'button',
          class: 'icon-btn ghost',
          'aria-label': `Delete reminder ${r.title}`,
          onclick: () => {
            prefs.reminders.custom = prefs.reminders.custom.filter((x) => x.id !== r.id);
            saveReminders();
            renderReminders();
          },
        }, icon('trash'))))
    : [el('p', { class: 'hint small' }, 'No personal reminders yet.')]));
}

async function addReminder() {
  const title = $('#rem-title').value.trim();
  const at = new Date($('#rem-when').value);
  if (!title) return showError('#rem-error', 'Type what you want to be reminded about.');
  if (Number.isNaN(+at)) return showError('#rem-error', 'Pick a date and time.');
  if (at <= new Date()) return showError('#rem-error', 'That time has already passed.');
  showError('#rem-error', null);
  prefs.reminders.custom.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title, at: +at });
  saveReminders();
  $('#rem-title').value = '';
  renderReminders();
  await allowNotifications();
  toast(`Reminder set for ${at.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`);
}

/* ---------- campus card ---------- */

let replacingCard = false;
let scan = null; // { stream, timer } while the camera is looking for a barcode
let wakeLock = null;
let detector; // the browser's BarcodeDetector, or null once we know to use the ZXing fallback
let zxing = null;

// Barcodes found in a video frame, image or canvas: [{ value, format }].
async function readCodes(source) {
  if (detector === undefined) {
    try { detector = 'BarcodeDetector' in window ? new window.BarcodeDetector() : null; } catch { detector = null; }
  }
  if (detector) {
    try {
      return (await detector.detect(source)).map((b) => ({ value: b.rawValue, format: b.format }));
    } catch { detector = null; }
  }
  if (!window.ZXing) await loadScript(ZXING_LIB);
  const Z = window.ZXing;
  if (!zxing) {
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
      Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.CODABAR,
      Z.BarcodeFormat.ITF, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.QR_CODE,
    ]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    zxing = { reader: new Z.MultiFormatReader(), hints, canvas: document.createElement('canvas') };
  }
  const w = source.videoWidth || source.width;
  const h = source.videoHeight || source.height;
  const scale = Math.min(1, 1280 / w);
  zxing.canvas.width = Math.round(w * scale);
  zxing.canvas.height = Math.round(h * scale);
  zxing.canvas.getContext('2d').drawImage(source, 0, 0, zxing.canvas.width, zxing.canvas.height);
  try {
    const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(zxing.canvas)));
    const r = zxing.reader.decode(bitmap, zxing.hints);
    return [{ value: r.getText(), format: Z.BarcodeFormat[r.getBarcodeFormat()] }];
  } catch {
    return []; // nothing readable in this frame
  }
}

// Saves the first barcode we can redraw. Returns true if one was saved.
function acceptCodes(codes) {
  for (const c of codes) {
    const format = drawableFormat(c.format);
    if (!format || !c.value) continue;
    try {
      checkBarcode(format, c.value);
    } catch (e) {
      showError('#card-error', e.message);
      continue;
    }
    saveCard(format, c.value);
    return true;
  }
  if (codes.length) {
    const name = String(codes[0].format).replace(/_/g, ' ').toLowerCase();
    showError('#card-error', `That's a ${name} barcode, which this app can't redraw. Keep looking for the long thin barcode, or type the number instead.`);
  }
  return false;
}

function saveCard(format, value) {
  // Code 39 and Codabar only have capital letters; lower case typed in means the same thing.
  prefs.card = { format, value: format === 'code_128' ? value : value.toUpperCase() };
  savePrefs();
  stopScan();
  replacingCard = false;
  showError('#card-error', null);
  renderCard();
  toast('Campus card saved');
}

async function startScan() {
  showError('#card-error', null);
  if (!navigator.mediaDevices?.getUserMedia) {
    showError('#card-error', "This device can't open the camera here. Choose a photo of the card instead.");
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch {
    showError('#card-error', "Couldn't open the camera. Allow camera access for this app, or choose a photo of the card instead.");
    return;
  }
  const video = $('#card-video');
  video.srcObject = stream;
  await video.play().catch(() => {});
  $('#card-scan').hidden = false;
  const s = { stream, timer: 0 };
  scan = s;
  const tick = async () => {
    if (scan !== s) return;
    if (video.readyState >= 2) {
      try {
        if (acceptCodes(await readCodes(video))) return;
      } catch {
        if (scan === s) {
          stopScan();
          showError('#card-error', "Couldn't start the barcode reader. It needs an internet connection the first time. You can also choose a photo or type the number.");
        }
        return;
      }
    }
    if (scan === s) s.timer = setTimeout(tick, 250);
  };
  tick();
}

function stopScan() {
  if (scan) {
    clearTimeout(scan.timer);
    for (const t of scan.stream.getTracks()) t.stop();
    scan = null;
  }
  const video = $('#card-video');
  video.srcObject = null;
  $('#card-scan').hidden = true;
}

async function readPhoto(file) {
  showError('#card-error', null);
  try {
    const bitmap = await createImageBitmap(file);
    const codes = await readCodes(bitmap);
    bitmap.close?.();
    if (!acceptCodes(codes) && !codes.length) {
      showError('#card-error', "Couldn't find a barcode in that photo. Take it closer, in good light, with the barcode filling most of the picture. Or type the number instead.");
    }
  } catch {
    showError('#card-error', "Couldn't read barcodes on this device. Check your internet connection and try again, or type the number instead.");
  }
}

function saveTypedCard() {
  const format = $('#card-format').value;
  const value = $('#card-manual').value.trim();
  try {
    checkBarcode(format, value);
  } catch (e) {
    showError('#card-error', e.message);
    return;
  }
  saveCard(format, value);
}

async function keepAwake(on) {
  try {
    if (on && !wakeLock) wakeLock = await navigator.wakeLock?.request('screen');
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}

function renderCard() {
  const c = prefs.card;
  const showing = !!c && !replacingCard;
  $('#card-show').hidden = !showing;
  $('#card-add').hidden = showing;
  $('#card-back').hidden = !c;
  if (!showing) return;
  const box = $('#card-code');
  try {
    box.replaceChildren(barcodeSVG(c.format, c.value));
  } catch {
    box.replaceChildren(el('p', { class: 'hint' }, "This barcode can't be drawn. Scan the card again."));
  }
  // Codabar's start/stop letters (A–D) aren't part of the printed number.
  $('#card-number').textContent = c.format === 'codabar' ? c.value.replace(/^[A-D](.+)[A-D]$/, '$1') : c.value;
  $('#card-type').textContent = FORMATS[c.format] || '';
}

function openCard() {
  replacingCard = false;
  showError('#card-error', null);
  renderCard();
  $('#card-dialog').showModal();
  keepAwake(true);
}

/* ---------- loading data ---------- */

class AppError extends Error {
  constructor(code, extra = {}) { super(code); this.code = code; Object.assign(this, extra); }
}

function normaliseLink(raw) {
  const m = (raw || '').trim().match(/(?:webcals?|https?):\/\/[^\s"'<>]+/i);
  if (!m) return null;
  try {
    return new URL(m[0].replace(/^webcals?:\/\//i, 'https://')).href;
  } catch {
    return null;
  }
}

function applyCalendar(text) {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new AppError('not-calendar');
  const cal = parseICS(text);
  const now = new Date();
  events = expandEvents(cal.events, addDays(now, -200), addDays(now, 400));
  for (const e of events) e.module = moduleKey(e.title);
  calName = cal.name || '';
}

function saveCalendar(text, link) {
  applyCalendar(text); // throws before anything is stored if the text isn't a calendar
  if (!store.set(K.ics, text)) toast("Loaded, but couldn't save it for offline use on this device.");
  store.set(K.updated, Date.now());
  store.set(K.url, link);
  store.set(K.source, link ? 'link' : 'file');
  lastRefreshFailed = false;
}

async function getText(url, init = {}) {
  const res = await fetch(url, { cache: 'no-store', ...init });
  if (!res.ok) throw new AppError('http', { status: res.status });
  return res.text();
}

async function fetchCalendar(link) {
  try {
    return await getText(link);
  } catch (e) {
    // An HTTP error came from the university itself – a relay won't change that.
    if (e.status) throw e;
    const relay = store.get(K.relay);
    if (!relay) throw e;
    // Send the link in the body, not the URL, so it doesn't end up in request logs.
    return await getText(relay, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: link });
  }
}

function explain(e) {
  if (e.code === 'bad-link') return "That doesn't look like a link. It should start with webcal://, https:// or http://.";
  if (e.code === 'not-calendar') {
    return 'That link opened a web page, not a calendar. Check that you copied the export or subscribe link (it often ends in .ics or starts with webcal://), not the address of the timetable page.';
  }
  if (e.status === 401 || e.status === 403) {
    return `The university's server refused the link (error ${e.status}). It may have expired or been reset. Create a new export link and paste it again.`;
  }
  if (e.status === 404 || e.status === 410) {
    return `The link wasn't found (error ${e.status}). It may have been revoked. Create a new export link.`;
  }
  if (e.status) return `The university's server returned error ${e.status}. Try again in a few minutes.`;
  if (!navigator.onLine) return "You're offline. Connect to the internet and try again.";
  if (NATIVE) return "Couldn't reach your university's timetable server. Check the link and your internet connection, then try again.";
  if (store.get(K.relay)) return "Couldn't reach your timetable, even through your relay. Check the relay address in Settings → Advanced.";
  return "Your university's server stopped this app from reading the link directly (a browser security rule). Either import the .ics file instead, or set up the free personal relay and add it under Settings → Advanced.";
}

async function connect(raw) {
  const link = normaliseLink(raw);
  if (!link) throw new AppError('bad-link');
  if (busy) return;
  setBusy(true);
  try {
    const text = await fetchCalendar(link);
    saveCalendar(text, link);
  } finally {
    setBusy(false);
  }
  forceSetup = false;
  $('#received').hidden = true;
  selected = startOfDay(new Date());
  render();
  const upcoming = events.filter((e) => e.start > new Date() && !e.cancelled).length;
  toast(upcoming ? `Timetable loaded with ${upcoming} upcoming sessions` : 'Loaded, but the timetable has no upcoming sessions yet');
}

async function refresh({ silent = false } = {}) {
  const link = store.get(K.url);
  if (!link || busy) return;
  if (!navigator.onLine) {
    renderStatus();
    if (!silent) toast("You're offline, so this is your saved timetable.");
    return;
  }
  setBusy(true);
  try {
    saveCalendar(await fetchCalendar(link), link);
    if (!silent) toast('Timetable updated');
  } catch (e) {
    lastRefreshFailed = true;
    if (!silent) toast(explain(e));
  } finally {
    setBusy(false);
    render();
  }
}

function isStale() {
  return Date.now() - (+store.get(K.updated) || 0) > STALE_MS;
}

function showError(id, msg) {
  const box = $(id);
  box.textContent = msg || '';
  box.hidden = !msg;
}

/* ---------- getting the link in from elsewhere ---------- */

// Links arrive via the QR code (#setup=…) or Android's share sheet (?url=… / ?text=…).
function takeIncoming() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  let link = hash.get('setup');
  const relay = hash.get('relay');
  if (!link) {
    const shared = ['url', 'text', 'title'].map((k) => query.get(k)).filter(Boolean).join(' ');
    link = normaliseLink(shared);
  }
  if (location.hash || location.search) history.replaceState(null, '', location.pathname);
  return { link, relay };
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });
}

async function showQR(raw) {
  const link = normaliseLink(raw);
  if (!link) {
    toast('Paste your timetable link first.');
    return;
  }
  const box = $('#qr');
  const dialog = $('#qr-dialog');
  if (location.protocol === 'file:') {
    box.textContent = 'The QR code only works once the app is online at a web address. See README.md for how to put it online.';
    dialog.showModal();
    return;
  }
  const target = new URL(location.pathname, location.origin);
  const params = new URLSearchParams({ setup: link });
  const relay = store.get(K.relay);
  if (relay) params.set('relay', relay);
  target.hash = params.toString();

  box.textContent = 'Making code…';
  dialog.showModal();
  try {
    if (!window.QRCode) await loadScript(QR_LIB);
    box.textContent = '';
    new window.QRCode(box, { text: target.href, width: 240, height: 240, correctLevel: window.QRCode.CorrectLevel.L });
  } catch {
    box.textContent = "Couldn't create the QR code (are you offline?). Email the link to yourself instead.";
  }
}

/* ---------- wiring ---------- */

function openSettings() {
  $('#set-link').value = store.get(K.url) || '';
  $('#set-relay').value = store.get(K.relay) || '';
  $('#set-area').value = prefs.mapsArea;
  $('#set-clear').hidden = store.get(K.ics) == null;
  $('#set-modules').hidden = !events.length;
  showError('#settings-error', null);
  $('#settings').showModal();
}

function saveRelay() {
  const raw = $('#set-relay').value.trim();
  if (!raw) { store.set(K.relay, null); return true; }
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) throw new Error();
    store.set(K.relay, u.href);
    return true;
  } catch {
    showError('#settings-error', 'The relay address should start with https://');
    return false;
  }
}

function onSwipe(target, fn) {
  let sx = 0;
  let sy = 0;
  target.addEventListener('touchstart', (e) => { sx = e.changedTouches[0].clientX; sy = e.changedTouches[0].clientY; }, { passive: true });
  target.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 45) fn(dx < 0 ? 1 : -1);
  }, { passive: true });
}

function wire() {
  $('#settings-btn').addEventListener('click', openSettings);
  $('#refresh-btn').addEventListener('click', () => refresh());

  for (const b of document.querySelectorAll('.seg button')) {
    b.addEventListener('click', () => {
      view = b.dataset.view;
      store.set(K.view, view);
      render();
    });
  }
  const move = (days) => { selected = addDays(selected, days); render(); };
  $('#prev-week').addEventListener('click', () => move(-7));
  $('#next-week').addEventListener('click', () => move(7));
  $('#wk-prev').addEventListener('click', () => move(-7));
  $('#wk-next').addEventListener('click', () => move(7));
  $('#today-btn').addEventListener('click', () => { selected = startOfDay(new Date()); render(); });
  $('#this-week-btn').addEventListener('click', () => { selected = startOfDay(new Date()); render(); });

  onSwipe($('#day-view'), (dir) => move(dir));
  onSwipe($('#week-view'), (dir) => move(dir * 7));
  document.addEventListener('keydown', (e) => {
    if ($('#main-view').hidden || view === 'agenda' || document.querySelector('dialog[open]')) return;
    if (e.target.matches?.('input, textarea')) return;
    const step = view === 'week' ? 7 : 1;
    if (e.key === 'ArrowLeft') move(-step);
    if (e.key === 'ArrowRight') move(step);
  });

  // Setup screen
  const pasteBtn = $('#paste-btn');
  if (!navigator.clipboard?.readText) pasteBtn.hidden = true;
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { toast('Your clipboard is empty.'); return; }
      $('#link-input').value = text.trim();
      showError('#setup-error', null);
    } catch {
      toast('Press and hold the box, then choose Paste.');
      $('#link-input').focus();
    }
  });
  const load = async () => {
    showError('#setup-error', null);
    if (pendingRelay) { store.set(K.relay, pendingRelay); pendingRelay = null; }
    try {
      await connect($('#link-input').value);
    } catch (e) {
      showError('#setup-error', explain(e));
    }
  };
  $('#load-btn').addEventListener('click', load);
  $('#link-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
  $('#send-btn').addEventListener('click', () => showQR($('#link-input').value));
  $('#import-btn-setup').addEventListener('click', () => $('#file-input').click());
  $('#cancel-setup').addEventListener('click', () => { forceSetup = false; render(); });

  // Settings
  $('#set-save').addEventListener('click', async () => {
    showError('#settings-error', null);
    if (!saveRelay()) return;
    try {
      await connect($('#set-link').value);
      $('#settings').close();
    } catch (e) {
      showError('#settings-error', explain(e));
    }
  });
  $('#set-qr').addEventListener('click', () => {
    saveRelay();
    showQR($('#set-link').value || store.get(K.url));
  });
  $('#set-import').addEventListener('click', () => $('#file-input').click());
  $('#set-modules').addEventListener('click', openModules);
  $('#set-area').addEventListener('input', (e) => { prefs.mapsArea = e.target.value.trim(); savePrefs(); });
  $('#set-relay').addEventListener('change', saveRelay);
  $('#set-clear').addEventListener('click', () => {
    if (!confirm('Remove your timetable, link, notes and module settings from this device? Your campus card stays.')) return;
    for (const k of [K.url, K.ics, K.updated, K.source, K.prefs]) store.set(k, null);
    events = [];
    calName = '';
    prefs = { ...emptyPrefs(), card: prefs.card };
    if (prefs.card) savePrefs();
    $('#link-input').value = '';
    $('#settings').close();
    render();
  });

  $('#file-input').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      saveCalendar(await file.text(), null);
      forceSetup = false;
      if ($('#settings').open) $('#settings').close();
      selected = startOfDay(new Date());
      render();
      toast('Timetable imported');
    } catch (e) {
      toast(e.code === 'not-calendar' ? "That file isn't a calendar (.ics) file." : "Couldn't read that file.");
    }
  });

  // Session details
  $('#ses-note').addEventListener('input', () => { clearTimeout(noteTimer); noteTimer = setTimeout(saveNote, 400); });
  $('#session-dialog').addEventListener('close', () => { saveNote(); currentSession = null; showMap(null); render(); });
  $('#ses-module').addEventListener('click', () => { if (currentSession) openModule(currentSession.module); });
  $('#ses-place-name').addEventListener('input', (ev) => {
    if (!currentSession || !isPhysical(currentSession.location)) return;
    const building = buildingOf(currentSession.location);
    const name = ev.target.value.trim();
    if (name) prefs.places[building] = name;
    else delete prefs.places[building];
    savePrefs();
    fillSession();
    render();
  });

  // Module editor
  $('#mod-name').addEventListener('input', (e) => {
    const name = e.target.value.trim();
    if (name) prefs.names[editingModule] = name;
    else delete prefs.names[editingModule];
    savePrefs();
    afterModuleChange();
  });
  $('#mod-show').addEventListener('change', (e) => {
    if (e.target.checked) delete prefs.hidden[editingModule];
    else prefs.hidden[editingModule] = true;
    savePrefs();
    afterModuleChange();
  });
  $('#mod-reset').addEventListener('click', () => {
    delete prefs.names[editingModule];
    delete prefs.colours[editingModule];
    delete prefs.hidden[editingModule];
    savePrefs();
    $('#mod-name').value = '';
    $('#mod-show').checked = true;
    renderSwatches();
    afterModuleChange();
  });
  $('#module-dialog').addEventListener('close', () => { editingModule = null; });

  // Reminders
  const fillOptions = (select, options) => select.replaceChildren(...options.map(([v, label]) => el('option', { value: v }, label)));
  fillOptions($('#rem-lead'), LEADS);
  fillOptions($('#ses-remind'), [['default', 'Same as my other classes'], ...LEADS.map(([v, label]) => [v, v ? label : 'No reminder'])]);
  $('#reminders-btn').addEventListener('click', openReminders);
  $('#rem-lead').addEventListener('change', async (e) => {
    prefs.reminders.lead = +e.target.value;
    saveReminders();
    if (prefs.reminders.lead) await allowNotifications();
  });
  $('#rem-add').addEventListener('click', addReminder);
  $('#rem-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') addReminder(); });
  $('#ses-remind').addEventListener('change', async (e) => {
    if (!currentSession) return;
    const key = currentSession.key;
    if (e.target.value === 'default') delete prefs.reminders.sessions[key];
    else prefs.reminders.sessions[key] = +e.target.value;
    saveReminders();
    if (+e.target.value) await allowNotifications();
  });

  // Campus card
  $('#card-btn').addEventListener('click', openCard);
  $('#card-camera').addEventListener('click', startScan);
  $('#card-stop').addEventListener('click', stopScan);
  $('#card-photo').addEventListener('click', () => $('#card-photo-input').click());
  $('#card-photo-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) readPhoto(file);
  });
  $('#card-save').addEventListener('click', saveTypedCard);
  $('#card-manual').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveTypedCard(); });
  $('#card-replace').addEventListener('click', () => {
    replacingCard = true;
    showError('#card-error', null);
    renderCard();
  });
  $('#card-back').addEventListener('click', () => {
    stopScan();
    replacingCard = false;
    showError('#card-error', null);
    renderCard();
  });
  $('#card-remove').addEventListener('click', () => {
    if (!confirm('Remove the campus card from this phone?')) return;
    prefs.card = null;
    savePrefs();
    replacingCard = false;
    renderCard();
  });
  $('#card-dialog').addEventListener('close', () => {
    stopScan();
    keepAwake(false);
    replacingCard = false;
  });
  for (const [v, label] of Object.entries(FORMATS)) $('#card-format').append(el('option', { value: v }, label));

  for (const btn of document.querySelectorAll('[data-close]')) {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  }
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // tap outside to close
  }

  // Keep "now / next" current and refresh when the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    render();
    if (isStale()) refresh({ silent: true });
  });
  setInterval(() => { if (document.visibilityState === 'visible') render(); }, 60000);
  window.addEventListener('online', () => { renderStatus(); if (isStale()) refresh({ silent: true }); });
  window.addEventListener('offline', renderStatus);
}

function init() {
  for (const n of document.querySelectorAll(NATIVE ? '[data-web-only]' : '[data-native-only]')) n.hidden = true;
  wire();
  const incoming = takeIncoming();

  const cached = store.get(K.ics);
  if (cached != null) {
    try { applyCalendar(cached); } catch { store.set(K.ics, null); }
  }

  if (incoming.link) {
    forceSetup = true;
    pendingRelay = incoming.relay;
    $('#link-input').value = incoming.link;
    $('#received').hidden = false;
  }

  render();
  if (!forceSetup && isStale()) refresh({ silent: true });

  if (!NATIVE && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
