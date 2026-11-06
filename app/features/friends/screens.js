// The pieces of the Friends screens: a person's row, the tint choice, what you share, a friend's
// timetable, and the Home widget.

import { ui, time } from 'folio';
import { initials, nowStatus, byDay, freeTogether, SHARE_DAYS } from './rules.js';

const { el } = ui;

// Tints for a friend's timetable: grey to start with, or one of these hues.
export const TINTS = [null, 0, 30, 140, 200, 260, 320];

const clock = (ms) => time.formatTime(new Date(ms));

export function avatar(name, hue = null) {
  return el('span', { class: 'fr-avatar', style: hue == null ? null : `--h:${hue}`, 'data-tinted': hue == null ? null : '' }, initials(name));
}

// "In MATH2031 Lecture until 11:00", "Busy until 11:00" (for friends who share only that),
// "Free until 14:00", "Free for the rest of today". shared: { classes, paused } or null.
export function statusLine(shared) {
  if (!shared) return { busy: null, text: 'Hasn\'t shared a timetable yet' };
  if (shared.paused) return { busy: null, text: 'Has paused sharing' };
  const now = nowStatus(shared.classes);
  if (now.busy) return { busy: true, text: now.title ? `In ${now.title} until ${clock(now.until)}` : `Busy until ${clock(now.until)}` };
  return { busy: false, text: now.until ? `Free until ${clock(now.until)}` : 'Free for the rest of today' };
}

export function statusTag(status) {
  if (status.busy == null) return null;
  return el('span', { class: `fr-tag ${status.busy ? 'busy' : 'free'}` }, status.busy ? 'Busy' : 'Free');
}

// A row in the Friends list: avatar, name, a line under it, and whatever goes on the right.
export function personRow({ name, hue, line, right, onOpen }) {
  const main = el('span', { class: 'fr-who' }, el('b', {}, name), line && el('small', {}, line));
  return el('li', { class: 'fr-row' },
    onOpen
      ? el('button', { type: 'button', class: 'fr-open', onclick: onOpen }, avatar(name, hue), main)
      : el('span', { class: 'fr-open' }, avatar(name, hue), main),
    right);
}

export function tintChoice(current, onPick) {
  return el('div', { class: 'fr-tints', role: 'radiogroup', 'aria-label': 'Colour of this friend\'s timetable' },
    TINTS.map((hue) => el('button', {
      type: 'button',
      class: 'fr-tint',
      role: 'radio',
      'aria-checked': String(hue === current),
      'aria-label': hue == null ? 'Grey' : `Colour ${hue}`,
      style: hue == null ? null : `--h:${hue}`,
      'data-tinted': hue == null ? null : '',
      onclick: () => onPick(hue),
    })));
}

// What you share with one person: everything, or only when you're free or busy.
export function shareChoice(name, busyOnly, onPick) {
  const option = (value, label) => el('button', {
    type: 'button', role: 'radio', 'aria-selected': String(busyOnly === value), 'aria-checked': String(busyOnly === value),
    onclick: () => busyOnly !== value && onPick(value),
  }, label);
  return el('div', { class: 'fr-share' },
    el('span', { class: 'label' }, `What ${name} sees of yours`),
    el('div', { class: 'seg', style: '--tabs:2', role: 'radiogroup', 'aria-label': `What ${name} sees of yours` },
      option(false, 'Everything'), option(true, 'Only free or busy')),
    ui.hint(busyOnly
      ? `${name} sees only when you're busy, not what or where.`
      : `${name} sees your classes, their times and rooms.`, { small: true }));
}

// A friend's classes, day by day, in their tint, with the times you're both free today.
export function timetableView({ name, shared, hue, mine }) {
  if (!shared) {
    return ui.missing(`${name} hasn't shared a timetable yet. It appears once they've opened Friends with a timetable on their phone.`);
  }
  if (shared.paused) return ui.missing(`${name} has paused sharing for now.`);
  const days = byDay(shared.classes);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const together = freeTogether(mine, shared.classes, today).filter((f) => f.e > Date.now());
  return el('div', { class: 'fr-timetable', style: hue == null ? null : `--h:${hue}`, 'data-tinted': hue == null ? null : '' },
    ui.hint(shared.busyOnly
      ? `When ${name} is busy in the next ${SHARE_DAYS / 7} weeks${shared.updatedAt ? `, updated ${time.ago(shared.updatedAt)}` : ''}. ${name} shares only that with you.`
      : `${name}'s classes for the next ${SHARE_DAYS / 7} weeks${shared.updatedAt ? `, updated ${time.ago(shared.updatedAt)}` : ''}. Modules they've hidden aren't shared.`, { small: true }),
    together.length > 0 && el('p', { class: 'fr-together' },
      el('b', {}, 'Free together today: '), together.map((f) => `${clock(f.s)}–${clock(f.e)}`).join(', ')),
    days.length === 0 && ui.hint(`No classes in the next ${SHARE_DAYS / 7} weeks.`),
    days.map(({ day, classes }) => el('section', { class: 'fr-day' },
      el('h3', {}, `${time.dayLabel(day)} · ${day.toLocaleDateString([], { day: 'numeric', month: 'short' })}`),
      classes.map((c) => el('div', { class: 'fr-class' },
        el('b', {}, c.t || 'Busy'), el('small', {}, `${clock(c.s)}–${clock(c.e)}${c.l ? ` · ${c.l}` : ''}`))))));
}

// A few words for the Home widget: "Free till 14:00", "Busy till 11:00", "Free", "Paused".
export function shortStatus(person) {
  if (person.paused) return 'Paused';
  if (!person.now) return 'Not shared';
  if (person.now.busy) return `Busy till ${clock(person.now.until)}`;
  return person.now.until ? `Free till ${clock(person.now.until)}` : 'Free';
}

// The Home widget. people: from whoIsFree (or null when there's nothing to show yet), with
// `message` saying why. wide: a strip with the faces; tall: a list.
export function friendsWidget({ size, list, free, message, onOpen }) {
  const head = el('span', { class: 'fr-widget-head' }, el('b', {}, 'Friends'),
    list && el('span', {}, free === 1 ? '1 free now' : `${free} free now`));
  const label = list ? `Friends, ${free} of ${list.length} free now. Open Friends` : `Friends. ${message}`;
  let body;
  if (!list) body = el('span', { class: 'fr-widget-empty' }, message);
  else if (size === 'wide') {
    body = el('span', { class: 'fr-widget-faces' }, list.slice(0, 6).map((p) => el('span', {
      class: `fr-face ${p.now ? (p.now.busy ? 'busy' : 'free') : 'unknown'}`, title: `${p.name}: ${shortStatus(p)}`,
    }, avatar(p.name, p.hue))), list.length > 6 && el('span', { class: 'fr-face-more' }, `+${list.length - 6}`));
  } else {
    body = el('ul', { class: 'fr-widget-list' }, list.slice(0, 8).map((p) => el('li', { class: p.now ? (p.now.busy ? 'busy' : 'free') : 'unknown' },
      el('b', {}, p.name), el('small', {}, shortStatus(p)))));
  }
  return el('button', { type: 'button', class: `fr-widget fr-widget-${size}`, 'aria-label': label, onclick: onOpen }, head, body);
}
