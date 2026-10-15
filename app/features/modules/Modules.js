// Modules: sessions are grouped into modules by their code (e.g. ECON1011). For each module
// you can choose a display name ("Microeconomics"), a colour, or hide it altogether.
//
// Saved data: 'names' → { [module]: text }, 'colours' → { [module]: hue }, 'hidden' → { [module]: true }

import { Feature, ui } from 'folio';

const { el } = ui;
const PALETTE = [0, 22, 42, 95, 140, 172, 198, 222, 255, 285, 320];

export default class Modules extends Feature {
  start() {
    this.sessions = this.use('sessions');
    this.names = this.storage.get('names', {});
    this.colours = this.storage.get('colours', {});
    this.hidden = this.storage.get('hidden', {});
    this.importOldData();

    const moduleOf = (s) => this.sessions.moduleOf(s);
    this.add('session.name', { name: (s) => this.names[moduleOf(s)], short: (s) => this.names[moduleOf(s)] });
    this.add('session.colour', { hue: (s) => this.colours[moduleOf(s)] });
    this.add('session.filter', { hides: (s) => !!this.hidden[moduleOf(s)], manageLabel: 'Manage modules', manage: () => this.openList() });
    this.add('session.details', {
      order: 90,
      render: (s) => el('button', { type: 'button', class: 'btn', onclick: () => this.openEditor(moduleOf(s)) }, 'Colour, name or hide this module'),
    });
    this.add('settings', {
      id: 'modules',
      order: 20,
      render: () => this.sessions.all.length > 0
        && el('button', { type: 'button', class: 'btn', onclick: () => this.openList() }, 'Modules: colours, names and hiding'),
    });
    this.on('timetable:cleared', () => {
      this.names = {};
      this.colours = {};
      this.hidden = {};
      this.storage.clear();
    });
  }

  // Before this app used Folio, these were saved in "tt.prefs".
  importOldData() {
    this.storage.once('import-from-v1', () => {
      const old = this.app.storage.rawJSON('tt.prefs', {}) || {};
      if (old.names) this.names = { ...old.names, ...this.names };
      if (old.colours) this.colours = { ...old.colours, ...this.colours };
      if (old.hidden) this.hidden = { ...old.hidden, ...this.hidden };
      this.save();
    });
  }

  save() {
    this.storage.set('names', this.names);
    this.storage.set('colours', this.colours);
    this.storage.set('hidden', this.hidden);
  }

  changed() {
    this.save();
    this.sessions.changed();
    if (this.list?.isOpen) this.renderList();
  }

  // ---- The list of all modules ----

  openList() {
    if (!this.list) this.list = ui.dialog({ title: 'Modules' });
    this.renderList();
    this.list.open();
  }

  renderList() {
    const now = new Date();
    const modules = new Map();
    for (const s of this.sessions.all) {
      const key = this.sessions.moduleOf(s);
      let m = modules.get(key);
      if (!m) modules.set(key, (m = { key, upcoming: 0 }));
      if (s.start > now && !s.cancelled) m.upcoming++;
    }
    const label = (key) => this.names[key] || key;
    const sorted = [...modules.values()].sort((a, b) => label(a.key).localeCompare(label(b.key)));
    this.list.setContent(
      ui.hint('Tap a module to rename it or change its colour. Switch one off to hide its sessions.'),
      el('div', { class: 'mod-list' }, sorted.length
        ? sorted.map(({ key, upcoming }) => {
          const shown = !this.hidden[key];
          return el('div', { class: `mod-row${shown ? '' : ' off'}` },
            el('button', { type: 'button', class: 'mod-main', onclick: () => this.openEditor(key) },
              el('span', { class: 'mod-swatch', style: `--h:${this.hueOf(key)}`, 'aria-hidden': 'true' }),
              el('span', { class: 'mod-text' },
                el('b', {}, label(key)),
                el('small', {}, [this.names[key] ? key : '', `${upcoming} upcoming`].filter(Boolean).join(' · ')))),
            ui.toggle({
              checked: shown,
              label: `Show ${label(key)}`,
              onChange: (on) => {
                if (on) delete this.hidden[key];
                else this.hidden[key] = true;
                this.changed();
              },
            }));
        })
        : ui.hint('No modules yet.')));
  }

  hueOf(key) {
    return this.colours[key] ?? this.sessions.defaultHue(key);
  }

  // ---- Editing one module ----

  openEditor(key) {
    this.editing = key;
    if (!this.editor) this.buildEditor();
    const sample = this.sessions.all.find((s) => this.sessions.moduleOf(s) === key);
    this.example.textContent = sample && sample.title !== key ? `For sessions like “${sample.title}”.` : '';
    this.example.hidden = !this.example.textContent;
    this.nameInput.value = this.names[key] || '';
    this.nameInput.placeholder = key;
    this.showBox.checked = !this.hidden[key];
    this.renderSwatches();
    this.editor.open();
  }

  buildEditor() {
    this.editor = ui.dialog({ title: 'Edit module', onClose: () => { this.editing = null; } });
    this.example = ui.hint('');
    this.nameInput = el('input', { id: 'module-name', type: 'text', autocomplete: 'off' });
    this.nameInput.addEventListener('input', () => {
      const name = this.nameInput.value.trim();
      if (name) this.names[this.editing] = name;
      else delete this.names[this.editing];
      this.changed();
    });
    this.swatches = el('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Colour' });
    this.showBox = el('input', { type: 'checkbox', id: 'module-show' });
    this.showBox.addEventListener('change', () => {
      if (this.showBox.checked) delete this.hidden[this.editing];
      else this.hidden[this.editing] = true;
      this.changed();
    });
    const reset = el('button', {
      type: 'button',
      class: 'btn danger',
      onclick: () => {
        delete this.names[this.editing];
        delete this.colours[this.editing];
        delete this.hidden[this.editing];
        this.nameInput.value = '';
        this.showBox.checked = true;
        this.renderSwatches();
        this.changed();
      },
    }, 'Reset to default');
    this.editor.setContent(
      this.example,
      el('label', { class: 'label', for: 'module-name' }, 'Display name'),
      this.nameInput,
      el('div', { class: 'label' }, 'Colour'),
      this.swatches,
      el('label', { class: 'check' }, this.showBox, ' Show in my timetable'),
      reset);
  }

  renderSwatches() {
    const key = this.editing;
    const current = this.colours[key];
    const options = [{ hue: this.sessions.defaultHue(key), auto: true }, ...PALETTE.map((hue) => ({ hue }))];
    this.swatches.replaceChildren(...options.map((o) => el('button', {
      type: 'button',
      class: 'swatch',
      style: `--h:${o.hue}`,
      role: 'radio',
      'aria-checked': String(o.auto ? current == null : current === o.hue),
      'aria-label': o.auto ? 'Automatic colour' : `Colour ${PALETTE.indexOf(o.hue) + 1}`,
      onclick: () => {
        if (o.auto) delete this.colours[key];
        else this.colours[key] = o.hue;
        this.renderSwatches();
        this.changed();
      },
    }, o.auto ? 'A' : '')));
  }
}
