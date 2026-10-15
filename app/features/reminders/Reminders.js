// Reminders: a notification a set time before every class (changeable per session), plus the
// person's own one-off reminders. The Android app schedules real notifications, which arrive
// even when it's closed. The web version can only show them while it's open.
//
// Saved data: 'lead' → minutes before each class (0 = off), 'sessions' → { [session key]: minutes },
// 'custom' → [{ id, title, at }]

import { Feature, ui, time } from 'folio';

const { el } = ui;
const LEADS = [
  [0, 'Off'], [5, '5 minutes before'], [10, '10 minutes before'], [15, '15 minutes before'],
  [30, '30 minutes before'], [60, '1 hour before'], [120, '2 hours before'],
];
const MAX_SCHEDULED = 60; // Android keeps the next ones only; the list is rebuilt as time passes.

function notificationId(text) {
  let h = 7;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 2147483646) + 1;
}

export default class Reminders extends Feature {
  start() {
    this.sessions = this.use('sessions');
    this.notifier = this.plugin('LocalNotifications'); // only in the Android app
    this.lead = this.storage.get('lead', 0);
    this.perSession = this.storage.get('sessions', {});
    this.custom = this.storage.get('custom', []);
    this.importOldData();
    this.syncChain = Promise.resolve();
    this.syncedSignature = '';
    this.channelMade = false;
    this.shownOnWeb = new Set();

    this.add('header.buttons', { id: 'reminders', label: 'Reminders', icon: 'bell', order: 20, onClick: () => this.openWindow() });
    this.add('session.details', { order: 40, render: (s) => this.sessionChoice(s) });
    this.on('timetable:changed', () => this.sync());
    this.on('sessions:changed', () => this.sync()); // e.g. a module was hidden
    this.on('app:ready', () => {
      this.sync();
      this.showDueOnWeb();
    });
    this.on('app:tick', () => {
      this.sync();
      this.showDueOnWeb();
    });
    this.on('timetable:cleared', () => {
      this.lead = 0;
      this.perSession = {};
      this.custom = [];
      this.storage.clear();
      this.sync();
    });
  }

  // Before this app used Folio, these were saved in "tt.prefs".
  importOldData() {
    this.storage.once('import-from-v1', () => {
      const old = this.app.storage.rawJSON('tt.prefs', {})?.reminders;
      if (!old) return;
      this.lead = old.lead || 0;
      this.perSession = old.sessions || {};
      this.custom = old.custom || [];
      this.save();
    });
  }

  save() {
    this.storage.set('lead', this.lead);
    this.storage.set('sessions', this.perSession);
    this.storage.set('custom', this.custom);
    this.sync();
  }

  // Minutes before a session that its reminder goes off (0 = none).
  leadFor(s) {
    return this.perSession[s.key] ?? this.lead;
  }

  // Every reminder due after `from`, soonest first.
  upcoming(from) {
    const out = [];
    for (const s of this.sessions.all) {
      if (s.cancelled || s.allDay || !this.sessions.isShown(s)) continue;
      const lead = this.leadFor(s);
      const at = new Date(s.start.getTime() - lead * time.MINUTE);
      if (!lead || at <= from) continue;
      out.push({
        id: `s:${s.key}`,
        at,
        title: this.sessions.name(s),
        body: [`Starts at ${time.formatTime(s.start)}`, s.location && this.sessions.placeLabel(s.location)].filter(Boolean).join(' · '),
      });
    }
    for (const r of this.custom) {
      const at = new Date(r.at);
      if (at > from) out.push({ id: `c:${r.id}`, at, title: r.title, body: 'Reminder' });
    }
    return out.sort((a, b) => a.at - b.at).slice(0, MAX_SCHEDULED);
  }

  // ---- Android: schedule real notifications ----

  sync() {
    if (!this.notifier) return;
    this.syncChain = this.syncChain.then(() => this.syncNow());
  }

  async syncNow() {
    const n = this.notifier;
    try {
      const granted = (await n.checkPermissions()).display === 'granted';
      const list = granted ? this.upcoming(new Date()) : [];
      const signature = list.map((r) => `${r.id}@${+r.at}|${r.title}|${r.body}`).join('\n');
      if (signature === this.syncedSignature) return;
      if (!this.channelMade) {
        await n.createChannel({ id: 'reminders', name: 'Reminders', description: 'Class and personal reminders', importance: 4, visibility: 1 }).catch(() => {});
        this.channelMade = true;
      }
      const { notifications } = await n.getPending();
      if (notifications.length) await n.cancel({ notifications: notifications.map(({ id }) => ({ id })) });
      if (list.length) {
        await n.schedule({
          notifications: list.map((r) => ({
            id: notificationId(r.id),
            title: r.title,
            body: r.body,
            channelId: 'reminders',
            schedule: { at: r.at, allowWhileIdle: true },
          })),
        });
      }
      this.syncedSignature = signature;
    } catch { /* try again next time */ }
  }

  // ---- Web: show reminders that came due while the app was open ----

  showDueOnWeb() {
    if (this.notifier) return;
    const now = Date.now();
    for (const r of this.upcoming(new Date(now - 3 * time.MINUTE))) {
      const id = `${r.id}@${+r.at}`;
      if (+r.at > now || this.shownOnWeb.has(id)) continue;
      this.shownOnWeb.add(id);
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(r.title, { body: r.body, icon: 'icons/icon-192.png' });
          continue;
        } catch { /* fall back to a message */ }
      }
      this.toast(`${r.title} · ${r.body}`);
    }
  }

  async allowNotifications() {
    if (this.notifier) {
      try {
        let p = await this.notifier.checkPermissions();
        if (p.display !== 'granted') p = await this.notifier.requestPermissions();
        if (p.display === 'granted') {
          this.sync();
          return true;
        }
      } catch { /* fall through to the message */ }
      this.toast('Notifications are blocked. Turn them on in Android Settings → Apps → Timetable → Notifications.');
      return false;
    }
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch { /* the message fallback still works */ }
    }
    return true;
  }

  // ---- Session details: this session's reminder ----

  sessionChoice(s) {
    if (s.allDay || s.cancelled || s.start <= new Date()) return null;
    const choice = ui.select([['default', 'Same as my other classes'], ...LEADS.map(([v, label]) => [v, v ? label : 'No reminder'])], {
      id: 'reminders-session',
      value: this.perSession[s.key] ?? 'default',
      onChange: async (value) => {
        if (value === 'default') delete this.perSession[s.key];
        else this.perSession[s.key] = +value;
        this.save();
        if (+value) await this.allowNotifications();
      },
    });
    return el('div', { class: 'group' }, el('label', { class: 'label', for: 'reminders-session' }, 'Reminder for this session'), choice);
  }

  // ---- The Reminders window ----

  openWindow() {
    if (!this.window) this.buildWindow();
    const now = Date.now();
    const kept = this.custom.filter((r) => r.at > now);
    if (kept.length !== this.custom.length) {
      this.custom = kept;
      this.save();
    }
    this.leadChoice.value = String(this.lead);
    this.titleInput.value = '';
    this.whenInput.value = time.toLocalInput(new Date(Math.ceil((now + time.HOUR) / time.HOUR) * time.HOUR));
    this.error.show(null);
    this.renderList();
    this.window.open();
  }

  buildWindow() {
    this.window = ui.dialog({ title: 'Reminders' });
    this.leadChoice = ui.select(LEADS, {
      id: 'reminders-lead',
      onChange: async (value) => {
        this.lead = +value;
        this.save();
        if (this.lead) await this.allowNotifications();
      },
    });
    this.list = el('div', { class: 'rem-list' });
    this.titleInput = el('input', { id: 'reminders-title', type: 'text', autocomplete: 'off', placeholder: 'e.g. Hand in economics essay' });
    this.titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addCustom(); });
    this.whenInput = el('input', { id: 'reminders-when', type: 'datetime-local' });
    this.error = ui.errorBox();
    this.window.setContent(
      el('label', { class: 'label', for: 'reminders-lead' }, 'Remind me before every class'),
      this.leadChoice,
      ui.hint('To change one session only, tap it in your timetable. Hidden modules and cancelled sessions don\'t send reminders.', { small: true }),
      el('h3', { class: 'sub-head' }, 'Your own reminders'),
      this.list,
      el('label', { class: 'label', for: 'reminders-title' }, 'What'),
      this.titleInput,
      el('label', { class: 'label', for: 'reminders-when' }, 'When'),
      this.whenInput,
      this.error,
      el('button', { type: 'button', class: 'btn primary', onclick: () => this.addCustom() }, 'Add reminder'),
      !this.notifier && ui.hint('In the web version, reminders only appear while the app is open. The Android app sends them as notifications even when it\'s closed.', { small: true }));
  }

  renderList() {
    const list = [...this.custom].sort((a, b) => a.at - b.at);
    this.list.replaceChildren(...(list.length
      ? list.map((r) => el('div', { class: 'rem-row' },
        el('div', { class: 'rem-text' }, el('b', {}, r.title), el('small', {}, time.formatDateTime(new Date(r.at)))),
        el('button', {
          type: 'button',
          class: 'icon-btn ghost',
          'aria-label': `Delete reminder ${r.title}`,
          onclick: () => {
            this.custom = this.custom.filter((x) => x.id !== r.id);
            this.save();
            this.renderList();
          },
        }, ui.icon('trash'))))
      : [ui.hint('No personal reminders yet.', { small: true })]));
  }

  async addCustom() {
    const title = this.titleInput.value.trim();
    const at = new Date(this.whenInput.value);
    if (!title) return this.error.show('Type what you want to be reminded about.');
    if (Number.isNaN(+at)) return this.error.show('Pick a date and time.');
    if (at <= new Date()) return this.error.show('That time has already passed.');
    this.error.show(null);
    this.custom.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title, at: +at });
    this.save();
    this.titleInput.value = '';
    this.renderList();
    await this.allowNotifications();
    this.toast(`Reminder set for ${time.formatDateTime(at)}`);
  }
}
