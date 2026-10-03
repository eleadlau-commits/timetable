import { parseICS, expandEvents } from './ics.js';

const K = {
  url: 'tt.url',
  relay: 'tt.relay',
  ics: 'tt.ics',
  updated: 'tt.updated',
  source: 'tt.source',
  view: 'tt.view',
};
const DAY = 86400000;
const STALE_MS = 30 * 60 * 1000;
const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
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
let view = store.get(K.view) === 'agenda' ? 'agenda' : 'day';
let busy = false;
let forceSetup = false;
let pendingRelay = null;
let lastRefreshFailed = false;

/* ---------- dates & formatting ---------- */

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d) { const x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); }
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const fmtTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d, month = 'long') => d.toLocaleDateString([], { day: 'numeric', month });

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
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

function pinIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>';
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

/* ---------- event presentation ---------- */

// Same module code → same colour, e.g. "ECON1011 Lecture" and "ECON1011 Seminar".
function hueFor(title) {
  const m = title.match(/\b[A-Z]{2,5}\s?\d{3,5}[A-Z]?\b/);
  const key = (m ? m[0] : title).replace(/\s/g, '');
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}

const KINDS = ['Lecture', 'Seminar', 'Tutorial', 'Practical', 'Workshop', 'Lab', 'Exam', 'Drop-in', 'Fieldwork'];
function kindOf(e) {
  const inTitle = KINDS.find((k) => new RegExp(`\\b${k}`, 'i').test(e.title));
  if (inTitle) return ''; // already visible in the title
  return KINDS.find((k) => new RegExp(`\\b${k}`, 'i').test(e.description.slice(0, 300))) || '';
}

function eventsOn(d) {
  const from = startOfDay(d);
  const to = addDays(from, 1);
  return events.filter((e) =>
    e.start < to && (e.end > from || (e.end.getTime() === e.start.getTime() && e.start >= from))
  );
}

function card(e, now, openKeys, extra) {
  const past = e.end <= now;
  const live = e.start <= now && now < e.end && !e.cancelled;
  const kind = e.cancelled ? 'Cancelled' : kindOf(e);
  return el('article', {
    class: `card${past ? ' past' : ''}${live ? ' now' : ''}${e.cancelled ? ' cancelled' : ''}`,
    style: `--h:${hueFor(e.title)}`,
  },
    el('div', { class: 'time' },
      e.allDay ? el('span', {}, 'All day') : [el('span', {}, fmtTime(e.start)), el('span', {}, fmtTime(e.end))]
    ),
    el('div', { class: 'body' },
      el('div', { class: 'title' }, el('span', { class: 'title-text' }, e.title), kind && el('span', { class: 'badge' }, kind)),
      e.location && el('div', { class: 'meta' }, pinIcon(), el('span', {}, e.location)),
      live && el('div', { class: 'pill' }, `Now · until ${fmtTime(e.end)}`),
      extra,
      e.description && el('details', { class: 'more', 'data-key': e.key, open: openKeys.has(e.key) },
        el('summary', {}, 'Details'),
        el('p', {}, e.description)
      )
    )
  );
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
  if (showSetup) return;

  const openKeys = new Set([...document.querySelectorAll('details.more[open]')].map((d) => d.dataset.key));
  for (const b of document.querySelectorAll('.seg button')) b.setAttribute('aria-selected', String(b.dataset.view === view));
  $('#day-view').hidden = view !== 'day';
  $('#agenda-view').hidden = view !== 'agenda';
  if (view === 'day') renderDay(openKeys);
  else renderAgenda(openKeys);
}

function renderDay(openKeys) {
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
  const items = eventsOn(selected);
  if (!items.length) {
    const weekend = selected.getDay() === 0 || selected.getDay() === 6;
    list.replaceChildren(el('div', { class: 'empty' },
      el('b', {}, weekend ? 'Nothing scheduled' : 'No classes'),
      el('div', {}, 'Swipe or use the arrows to see other days.')
    ));
    return;
  }
  const next = sameDay(selected, today) ? items.find((e) => e.start > now && !e.cancelled) : null;
  list.replaceChildren(...items.map((e) =>
    card(e, now, openKeys, e === next && el('div', { class: 'pill next' }, `Next · ${inTime(e.start - now)}`))
  ));
}

function renderAgenda(openKeys) {
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
      el('div', { class: 'list' }, items.map((e) => card(e, now, openKeys)))
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
  $('#set-clear').hidden = store.get(K.ics) == null;
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
  $('#prev-week').addEventListener('click', () => { selected = addDays(selected, -7); render(); });
  $('#next-week').addEventListener('click', () => { selected = addDays(selected, 7); render(); });
  $('#today-btn').addEventListener('click', () => { selected = startOfDay(new Date()); render(); });

  // Swipe left/right on the day view to change day.
  const dayView = $('#day-view');
  let sx = 0;
  let sy = 0;
  dayView.addEventListener('touchstart', (e) => { sx = e.changedTouches[0].clientX; sy = e.changedTouches[0].clientY; }, { passive: true });
  dayView.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 45) { selected = addDays(selected, dx < 0 ? 1 : -1); render(); }
  }, { passive: true });
  document.addEventListener('keydown', (e) => {
    if ($('#main-view').hidden || view !== 'day' || document.querySelector('dialog[open]')) return;
    if (e.target.matches?.('input, textarea')) return;
    if (e.key === 'ArrowLeft') { selected = addDays(selected, -1); render(); }
    if (e.key === 'ArrowRight') { selected = addDays(selected, 1); render(); }
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
  $('#set-relay').addEventListener('change', saveRelay);
  $('#set-clear').addEventListener('click', () => {
    if (!confirm('Remove your timetable and link from this device?')) return;
    for (const k of [K.url, K.ics, K.updated, K.source]) store.set(k, null);
    events = [];
    calName = '';
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
