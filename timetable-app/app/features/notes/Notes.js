// Notes: a note on any session, written in the session details window. The first line shows
// on the session's card. Notes are saved as you type.
//
// Saved data: 'notes' → { [session key]: text }

import { Feature, ui } from 'folio';

const { el } = ui;

export default class Notes extends Feature {
  start() {
    this.notes = this.storage.get('notes', {});
    this.importOldData();

    this.add('session.card', {
      order: 10,
      render: (s) => {
        const note = this.notes[s.key];
        return note ? el('div', { class: 'meta note' }, ui.icon('note'), el('span', {}, note.split('\n')[0])) : null;
      },
    });
    this.add('session.details', { order: 30, render: (s) => this.editor(s), close: () => this.saveNow() });
    this.on('timetable:cleared', () => {
      this.notes = {};
      this.storage.remove('notes');
    });
  }

  // Before this app used Folio, notes were saved in "tt.prefs".
  importOldData() {
    this.storage.once('import-from-v1', () => {
      const old = this.app.storage.rawJSON('tt.prefs', {})?.notes;
      if (old && Object.keys(old).length) {
        this.notes = { ...old, ...this.notes };
        this.storage.set('notes', this.notes);
      }
    });
  }

  editor(s) {
    this.editing = s.key;
    this.box = el('textarea', { id: 'notes-text', rows: '3', placeholder: 'e.g. bring laptop, problem set 2 due' });
    this.box.value = this.notes[s.key] || '';
    this.box.addEventListener('input', () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.saveNow(), 400);
    });
    return el('div', { class: 'group' },
      el('label', { class: 'label', for: 'notes-text' }, 'Your notes'),
      this.box,
      ui.hint('Saved on this device as you type.', { small: true }));
  }

  saveNow() {
    clearTimeout(this.timer);
    if (!this.box || !this.editing) return;
    const text = this.box.value.trim();
    if ((this.notes[this.editing] || '') === text) return;
    if (text) this.notes[this.editing] = text;
    else delete this.notes[this.editing];
    this.storage.set('notes', this.notes);
  }
}
