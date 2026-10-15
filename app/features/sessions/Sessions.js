// Sessions: how a session looks. It draws session cards and the session details window, and
// gives other features places to change them (rename, recolour, hide, add lines and sections).
//
// Service 'sessions' (this object):
//   all                     every session
//   onDay(date, { includeHidden })   the sessions on one day, in time order
//   hiddenNote(date)        "2 hidden sessions · Manage modules", or null
//   isShown(s), name(s), shortName(s), hue(s), kind(s), badge(s), moduleOf(s), defaultHue(module)
//   placeLabel(location), placeLink(location)
//   card(s, { now, extra }) a session card element
//   open(s)                 opens the session details window
//   selected, select(date)  the day the views are showing
//   changed()               call after changing how sessions look (names, colours, hiding, places)
//
// Events it sends: 'sessions:changed' after changed().

import { Feature, ui, time } from 'folio';
import { moduleKey, hueFor, kindOf, webLink } from './format.js';

const { el } = ui;
const timeRange = (s) => (s.allDay ? 'All day' : `${time.formatTime(s.start)}–${time.formatTime(s.end)}`);

export default class Sessions extends Feature {
  start() {
    this.timetable = this.use('timetable');
    this.selected = time.startOfDay(new Date());
    this.current = null;

    this.defineSlot('session.filter',
      'Hides sessions. Item: { hides(session) → true to hide, manageLabel?, manage?() opens a place to change it }.');
    this.defineSlot('session.name',
      'Renames sessions. Item: { name(session) → text or undefined, short?(session) → short text or undefined }.');
    this.defineSlot('session.colour', 'Colours sessions. Item: { hue(session) → 0–360, or undefined }.');
    this.defineSlot('session.location',
      'Explains locations. Item: { label?(location) → text, link?(location) → URL, linkLabel?(location) → button text }.');
    this.defineSlot('session.card', 'Extra lines on session cards. Item: { order, render(session) → element or null }.');
    this.defineSlot('session.details',
      'Sections in the session details window. Item: { order, render(session, window) → element or null, close?(session) }. '
      + 'window.refresh() redraws the heading and location; window.close() closes it.');
    this.provide('sessions', this);

    this.add('session.details', {
      order: 20,
      render: (s) => (s.description ? el('p', { class: 'ses-desc' }, s.description) : null),
    });
    this.buildWindow();
    this.on('timetable:loaded', () => this.select(new Date()));
    this.on('timetable:cleared', () => this.window.close());
  }

  // ---- Which sessions ----

  get all() {
    return this.timetable.events;
  }

  moduleOf(s) {
    return (s.module ??= moduleKey(s.title));
  }

  isShown(s) {
    return !this.slot('session.filter').some((f) => f.hides(s));
  }

  onDay(date, { includeHidden = false } = {}) {
    const from = time.startOfDay(date);
    const to = time.addDays(from, 1);
    return this.all.filter((s) =>
      s.start < to
      && (s.end > from || (s.end.getTime() === s.start.getTime() && s.start >= from))
      && (includeHidden || this.isShown(s)));
  }

  hiddenNote(date) {
    const count = this.onDay(date, { includeHidden: true }).length - this.onDay(date).length;
    if (!count) return null;
    const text = `${count} hidden session${count > 1 ? 's' : ''}`;
    const filters = this.slot('session.filter');
    const manager = filters.items.find((f) => f.manage);
    if (!manager) return el('p', { class: 'hidden-note' }, text);
    return el('button', {
      type: 'button',
      class: 'link-btn hidden-note',
      onclick: () => filters.run(manager, (f) => f.manage()),
    }, `${text} · ${manager.manageLabel || 'Change'}`);
  }

  // ---- How they look ----

  name(s) {
    return this.slot('session.name').first((r) => r.name(s)) || s.title;
  }

  shortName(s) {
    return this.slot('session.name').first((r) => r.short?.(s)) || this.moduleOf(s);
  }

  defaultHue(module) {
    return hueFor(module);
  }

  hue(s) {
    return this.slot('session.colour').first((c) => c.hue(s)) ?? hueFor(this.moduleOf(s));
  }

  kind(s) {
    return kindOf(s);
  }

  // The label on a card: the session type, unless the name already says it.
  badge(s) {
    if (s.cancelled) return 'Cancelled';
    const kind = kindOf(s);
    return kind && !new RegExp(`\\b${kind}`, 'i').test(this.name(s)) ? kind : '';
  }

  placeLabel(location) {
    if (!location) return '';
    return this.slot('session.location').first((p) => p.label?.(location)) || location;
  }

  placeLink(location) {
    if (!location) return null;
    return this.slot('session.location').first((p) => p.link?.(location)) || webLink(location);
  }

  placeLinkLabel(location) {
    return this.slot('session.location').first((p) => p.linkLabel?.(location)) || 'Open link';
  }

  // ---- The selected day ----

  select(date) {
    this.selected = time.startOfDay(date);
    this.refresh();
  }

  // Call after changing how sessions look, so cards, the details window and others update.
  changed() {
    this.emit('sessions:changed');
    this.refreshWindow();
    this.refresh();
  }

  // ---- Cards ----

  card(s, { now = new Date(), extra = null } = {}) {
    const past = s.end <= now;
    const live = s.start <= now && now < s.end && !s.cancelled;
    const badge = this.badge(s);
    const link = this.placeLink(s.location);
    const label = this.placeLabel(s.location);
    return el('article', {
      class: `card${past ? ' past' : ''}${live ? ' now' : ''}${s.cancelled ? ' cancelled' : ''}`,
      style: `--h:${this.hue(s)}`,
      role: 'button',
      tabindex: '0',
      onclick: () => this.open(s),
      onkeydown: (e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          this.open(s);
        }
      },
    },
      el('div', { class: 'time' },
        s.allDay ? el('span', {}, 'All day') : [el('span', {}, time.formatTime(s.start)), el('span', {}, time.formatTime(s.end))]),
      el('div', { class: 'body' },
        el('div', { class: 'title' }, el('span', { class: 'title-text' }, this.name(s)), badge && el('span', { class: 'badge' }, badge)),
        s.location && (link
          ? el('a', { class: 'meta', href: link, target: '_blank', rel: 'noopener', onclick: (e) => e.stopPropagation() },
            ui.icon('pin'), el('span', {}, label))
          : el('div', { class: 'meta' }, ui.icon('pin'), el('span', {}, label))),
        this.slot('session.card').map((line) => line.render(s)),
        live && el('div', { class: 'pill' }, `Now · until ${time.formatTime(s.end)}`),
        extra));
  }

  // ---- Details window ----

  buildWindow() {
    this.window = ui.dialog({ className: 'session-dialog', onClose: () => this.windowClosed() });
    this.original = el('p', { class: 'ses-original', hidden: true });
    this.when = el('span');
    this.placeText = el('span');
    this.directions = el('a', { class: 'btn small', target: '_blank', rel: 'noopener' }, 'Open link');
    this.placeRow = el('div', { class: 'ses-row' }, ui.icon('pin'), this.placeText, this.directions);
    this.sections = el('div', { class: 'ses-sections' });
    this.window.setContent(this.original, el('div', { class: 'ses-row' }, ui.icon('clock'), this.when), this.placeRow, this.sections);
  }

  open(s) {
    this.current = s;
    this.refreshWindow();
    const windowControls = { refresh: () => this.refreshWindow(), close: () => this.window.close() };
    this.sections.replaceChildren(...this.slot('session.details').map((section) => section.render(s, windowControls)));
    this.window.open();
  }

  refreshWindow() {
    const s = this.current;
    if (!s) return;
    this.window.element.style.setProperty('--h', this.hue(s));
    this.window.setTitle(this.name(s));
    this.original.textContent = s.title;
    this.original.hidden = this.name(s) === s.title;
    this.when.textContent = `${time.formatLongDate(s.start)} · ${timeRange(s)}${s.cancelled ? ' · Cancelled' : ''}`;
    this.placeRow.hidden = !s.location;
    this.placeText.textContent = this.placeLabel(s.location);
    const link = this.placeLink(s.location);
    this.directions.hidden = !link;
    if (link) {
      this.directions.href = link;
      this.directions.textContent = this.placeLinkLabel(s.location);
    }
  }

  windowClosed() {
    const s = this.current;
    if (s) this.slot('session.details').each((section) => section.close?.(s));
    this.current = null;
    this.refresh();
  }
}
