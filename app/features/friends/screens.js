// The pieces of the Friends screens: a person's row, the tint choice, and a friend's timetable.

import { ui, time } from 'folio';
import { initials, nowStatus, byDay, freeTogether, SHARE_DAYS } from './rules.js';

const { el } = ui;

// Tints for a friend's timetable: grey to start with, or one of these hues.
export const TINTS = [null, 0, 30, 140, 200, 260, 320];

const clock = (ms) => time.formatTime(new Date(ms));

export function avatar(name, hue = null) {
  return el('span', { class: 'fr-avatar', style: hue == null ? null : `--h:${hue}`, 'data-tinted': hue == null ? null : '' }, initials(name));
}

// "In MATH2031 Lecture until 11:00", "Free until 14:00", "Free for the rest of today".
export function statusLine(classes) {
  if (!classes) return { busy: null, text: 'Hasn\'t shared a timetable yet' };
  const now = nowStatus(classes);
  if (now.busy) return { busy: true, text: `In ${now.title} until ${clock(now.until)}` };
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

// A friend's classes, day by day, in their tint, with the times you're both free today.
export function timetableView({ name, shared, hue, mine }) {
  if (!shared) {
    return ui.missing(`${name} hasn't shared a timetable yet. It appears once they've opened Friends with a timetable on their phone.`);
  }
  const days = byDay(shared.classes);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const together = freeTogether(mine, shared.classes, today).filter((f) => f.e > Date.now());
  return el('div', { class: 'fr-timetable', style: hue == null ? null : `--h:${hue}`, 'data-tinted': hue == null ? null : '' },
    ui.hint(`${name}'s classes for the next ${SHARE_DAYS / 7} weeks${shared.updatedAt ? `, updated ${time.ago(shared.updatedAt)}` : ''}. Modules they've hidden aren't shared.`, { small: true }),
    together.length > 0 && el('p', { class: 'fr-together' },
      el('b', {}, 'Free together today: '), together.map((f) => `${clock(f.s)}–${clock(f.e)}`).join(', ')),
    days.length === 0 && ui.hint(`No classes in the next ${SHARE_DAYS / 7} weeks.`),
    days.map(({ day, classes }) => el('section', { class: 'fr-day' },
      el('h3', {}, `${time.dayLabel(day)} · ${day.toLocaleDateString([], { day: 'numeric', month: 'short' })}`),
      classes.map((c) => el('div', { class: 'fr-class' },
        el('b', {}, c.t), el('small', {}, `${clock(c.s)}–${clock(c.e)}${c.l ? ` · ${c.l}` : ''}`))))));
}
