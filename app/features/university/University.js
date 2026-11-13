// University: which university the app is set up for, and what it knows about it. The facts
// themselves come from university packs (folders like uni-durham, marked "kind": "pack"), which
// add one item each to the 'university.packs' slot. Everything else asks this feature, so no
// feature needs to know about Durham, and each copes when there's no answer (no pack, or a pack
// without, say, a library).
//
// Slot 'university.packs': { id, name, short, town, order?, timetableHosts?, guide?, rooms?,
//   libraries?, photo?, yearStart? } (see README.md for each).
//
// Service 'university':
//   pack()          the chosen pack, or null
//   packs()         every pack
//   name()          'Durham University', or null
//   short()         'Durham', or null
//   town()          'Durham', or null (the town Spots are in)
//   townId()        'durham', or null: which town's Spots to show (the database's `town` field)
//   uniId()         'durham', or null: which university's Societies to show (the `uni` field)
//   guide()         the timetable setup guide { intro, steps, pictures, private }, or null
//   libraries()     [{ id, name, page }], or []
//   photo()         the address of Home's photo, or null
//   yearStart()     the academic year's first month (0–11), September unless the pack says
//   lookupRoom(t)   { code, room, building, address, lat, lng } for a room as written, or null
//   packForLink(l)  the pack whose timetable server a link points at, or null
//   choose(id)      switches pack and sends 'university:changed'
//
// Service 'places': { lookup(location) }, the same as lookupRoom, for Maps.
//
// Choosing a university only appears once there are two packs or more (for now there's only
// Durham, so nobody sees it):
//   - after someone new picks "I'm a student" on the Welcome screen, a window asks which one
//   - Settings → University
//   - a pasted timetable link from a university's own server picks it, if nobody has chosen
// People who were already using the app keep the university they had (Durham): it's saved for
// them the first time this runs.
//
// Saved data: 'choice' → the chosen pack's id (once someone chooses, or for people already using
//             the app; until then the first pack)

import { Feature, ui } from 'folio';
import { choosePack, yearStart, packForLink, shouldAsk } from './rules.js';

const { el } = ui;

export default class University extends Feature {
  start() {
    this.defineSlot('university.packs', "One university's facts, from its pack. Item: { id, name, short, town, townId, uniId, order?, timetableHosts?, guide?: { intro, steps, pictures, private }, rooms?: { lookup(location) }, libraries?: [{ id, name, page }], photo?, yearStart? }.");
    this.provide('university', this);
    this.provide('places', { lookup: (location) => this.lookupRoom(location) });
    this.add('settings', { id: 'university', title: 'University', order: 15, render: () => this.settingsSection() });

    // People already using the app (they've chosen student or business, or been given it)
    // keep the university they have now, whatever packs come later.
    this.on('app:ready', () => this.storage.once('keep-current', () => {
      if (!this.storage.get('choice', null) && this.use('audience')?.kind && this.pack()) this.storage.set('choice', this.pack().id);
    }));
    // Someone new: once they say they're a student, ask which university (only with two or more).
    // With only one, they're at that one, and it's saved so a pack added later doesn't move them.
    this.on('audience:changed', ({ kind, first } = {}) => {
      if (!first || kind !== 'student' || this.storage.get('choice', null)) return;
      if (shouldAsk({ packs: this.packs().length, chosen: false, kind })) this.ask();
      else if (this.pack()) this.storage.set('choice', this.pack().id);
    });
    // A timetable link from a university's own server picks that university, if nobody has.
    this.on('timetable:loaded', () => {
      if (this.storage.get('choice', null)) return;
      const pack = this.packForLink(this.use('timetable')?.url || '');
      if (pack) this.choose(pack.id);
    });
  }

  // ---- Choosing (only offered with two packs or more) ----

  // Buttons, one per university, the chosen one marked (none when asking someone new).
  choices(onPick, { mark = true } = {}) {
    const current = mark ? this.pack()?.id : null;
    return el('div', { class: 'uni-choices', role: 'radiogroup', 'aria-label': 'University' },
      ...[...this.packs()].sort((a, b) => String(a.name).localeCompare(String(b.name))).map((p) => el('button', {
        type: 'button', class: 'uni-choice', role: 'radio', 'aria-checked': String(p.id === current),
        onclick: () => { this.choose(p.id, { saveSame: true }); onPick?.(); },
      }, el('b', {}, p.name), p.town && el('span', {}, p.town))));
  }

  ask() {
    if (!this.window) this.window = ui.dialog({ title: 'Which university?' });
    this.window.setContent(el('div', { class: 'uni-ask' },
      ui.hint('So the app shows your library, rooms, societies and places around you. You can change it later in Settings.'),
      this.choices(() => this.window.close(), { mark: !!this.storage.get('choice', null) })));
    this.window.open();
  }

  settingsSection() {
    if (this.packs().length < 2) return null;
    return el('div', { class: 'uni-setting' },
      this.choices(() => this.app.shell.refreshSettings()),
      ui.hint('Changes the library, rooms, setup guide, societies and Spots. Your timetable, to-dos and friends stay as they are.', { small: true }));
  }

  packs() {
    return this.slot('university.packs').items;
  }

  pack() {
    return choosePack(this.packs(), this.storage.get('choice', null));
  }

  name() { return this.pack()?.name || null; }
  short() { return this.pack()?.short || null; }
  town() { return this.pack()?.town || null; }
  townId() { return this.pack()?.townId || null; }
  uniId() { return this.pack()?.uniId || null; }
  guide() { return this.pack()?.guide || null; }
  libraries() { return this.pack()?.libraries || []; }
  photo() { return this.pack()?.photo || null; }
  yearStart() { return yearStart(this.pack()); }

  lookupRoom(location) {
    const rooms = this.pack()?.rooms;
    if (!rooms || !location) return null;
    try {
      return rooms.lookup(location) || null;
    } catch {
      return null;
    }
  }

  packForLink(link) {
    return packForLink(this.packs(), link);
  }

  choose(id, { saveSame = false } = {}) {
    if (!this.packs().some((p) => p.id === id)) return;
    if (id === this.pack()?.id) {
      if (saveSame) this.storage.set('choice', id);
      return;
    }
    this.storage.set('choice', id);
    this.emit('university:changed', { id });
    this.refresh();
  }
}
