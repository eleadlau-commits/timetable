// Customise Home: choose Home's widgets and photo. A pencil on Home (at the right of the dots
// under the clock), or Settings → Home, opens a pop-up with:
//   - the photo behind the clock: Home's Durham photo, or one from your phone
//   - a small picture of Home's grid, showing how much room is left
//   - the widgets on Home: change their size (wide, tall, large), move them, remove them
//   - the other widgets, in each of their sizes: tap one to add it. If it won't fit, it says so.
//   - Back to the original
// Home asks for the choices through its 'home.layout' slot, so without this feature Home shows
// its usual widgets and photo. The list rules are in rules.js; the grid rules are Home's.
//
// The business version of the app (the welcome feature) has its own widgets, so its choice is
// kept apart from the student one.
//
// Saved data (on this phone only):
//   'widgets'   → [{ id, size }] in order, or nothing for Home's usual ones
//   'business-widgets' → the same, for the business version
//   'photo'     → 'durham' (Home's own, the default) or 'own'
//   'own-photo' → the photo chosen from the phone, shrunk, as a data: address (a JPEG)

import { Feature, ui } from 'folio';
import { PHOTOS, cleanWidgets, putWidget, removeWidget, moveWidget, isOriginal, fitSize } from './rules.js';

const { el } = ui;
const UP = '<path d="M6 15l6-6 6 6"/>';
const DOWN = '<path d="M6 9l6 6 6-6"/>';
const SIZE_NAMES = { wide: 'Wide', tall: 'Tall', large: 'Large' };
const NO_ROOM = 'No room for this. Remove a widget or pick a smaller size.';
const PHOTO_SIZES = [[1400, 0.8], [1000, 0.72], [700, 0.65]]; // tried in turn until one fits in storage

export default class CustomiseHome extends Feature {
  start() {
    this.addHelp();
    this.home = this.use('home');
    this.widgets = cleanWidgets(this.storage.get(this.widgetsKey, null));
    this.on('audience:changed', () => { this.widgets = cleanWidgets(this.storage.get(this.widgetsKey, null)); });
    this.photo = PHOTOS.includes(this.storage.get('photo')) ? this.storage.get('photo') : 'durham';
    this.ownPhoto = this.storage.get('own-photo', null);
    this.picker = ui.filePicker('image/*');

    this.add('home.layout', {
      widgets: () => this.widgets ?? undefined,
      photo: () => (this.photo === 'own' && this.ownPhoto ? this.ownPhoto : undefined),
    });
    this.add('home.tools', { id: 'customise', label: 'Customise Home', icon: 'note', order: 10, onClick: () => this.open() });
    this.add('settings', {
      id: 'customise-home',
      title: 'Home',
      order: 25,
      render: () => el('div', { class: 'ch-setting' },
        el('span', {}, "Choose Home's widgets and photo"),
        el('button', { type: 'button', class: 'btn small', onclick: () => this.open() }, 'Customise')),
    });
  }

  // Where the choice of widgets is saved: one for students, one for the business version.
  get widgetsKey() {
    return this.use('audience')?.isBusiness() ? 'business-widgets' : 'widgets';
  }

  // The widgets on Home now: the person's choice, or Home's usual ones.
  get current() {
    const known = new Set((this.home?.widgets() || []).map((w) => w.id));
    return (this.widgets ?? this.home?.usual() ?? []).filter((w) => known.has(w.id));
  }

  save(message = null) {
    if (this.widgets) this.storage.set(this.widgetsKey, this.widgets);
    else this.storage.remove(this.widgetsKey);
    this.storage.set('photo', this.photo);
    this.refresh();
    if (this.window?.isOpen) this.draw(message);
  }

  open() {
    if (!this.window) this.window = ui.dialog({ title: 'Customise Home', className: 'ch-dialog' });
    this.draw();
    this.window.open();
  }

  draw(message = null) {
    if (!this.home) {
      this.window.setContent(ui.missing('Home is switched off'));
      return;
    }
    this.message = el('p', { class: 'ch-message', role: 'status' }, message || '');
    this.window.setContent(
      this.photoSection(),
      this.gridSection(),
      this.addSection(),
      el('button', {
        type: 'button', class: 'btn block', disabled: isOriginal(this.widgets, this.photo),
        onclick: () => this.reset(),
      }, 'Back to the original'),
    );
  }

  reset() {
    this.widgets = null;
    this.photo = 'durham';
    this.save('Home is back to how it came.');
  }

  // Changes the widgets, if they fit; otherwise says there's no room.
  change(list) {
    if (!this.home.fits(list)) {
      this.message.textContent = NO_ROOM;
      this.message.scrollIntoView({ block: 'center', behavior: 'smooth' }); // next to the picture of the grid
      return;
    }
    this.widgets = list;
    this.save();
  }

  // ---- The photo ----

  photoSection() {
    const picture = (url) => el('span', { class: 'ch-photo-pic', style: `background-image: url("${url}")` });
    const tile = (id, label, preview, onclick) => el('button', {
      type: 'button', class: 'ch-photo', 'aria-pressed': String(this.photo === id), onclick,
    }, preview, el('span', {}, label));
    this.error = ui.errorBox();
    return el('section', { class: 'ch-section' },
      el('h3', { class: 'sub-head' }, 'Photo'),
      el('div', { class: 'ch-photos' },
        tile('durham', 'Durham', picture(this.home.photo), () => this.choosePhoto('durham')),
        tile('own', this.ownPhoto ? 'Yours' : 'Choose your own',
          this.ownPhoto ? picture(this.ownPhoto) : el('span', { class: 'ch-photo-pic ch-photo-add' }, ui.icon('plus')),
          () => (this.ownPhoto ? this.choosePhoto('own') : this.pickPhoto()))),
      this.ownPhoto && el('button', { type: 'button', class: 'link-btn ch-other', onclick: () => this.pickPhoto() }, 'Choose a different photo'),
      this.error,
      ui.hint('Your own photo stays on this phone. Wide photos work best, with the interesting part on the right.', { small: true }));
  }

  choosePhoto(id) {
    this.photo = id;
    this.save();
  }

  async pickPhoto() {
    const file = await this.picker.pick();
    if (!file) return;
    this.error.show(null);
    let image;
    try {
      image = await loadImage(file);
    } catch {
      this.error.show("That file couldn't be opened as a photo. Try a JPEG or PNG.");
      return;
    }
    for (const [max, quality] of PHOTO_SIZES) {
      const url = shrink(image, max, quality);
      if (this.storage.set('own-photo', url)) {
        this.ownPhoto = url;
        this.choosePhoto('own');
        return;
      }
    }
    this.error.show("There isn't room on this phone to save that photo.");
  }

  // ---- The widgets ----

  // A small picture of Home's grid: each widget where it goes, and the free space.
  preview() {
    const rows = this.home.rows();
    const labels = new Map(this.home.widgets().map((w) => [w.id, w.label]));
    const { placed } = this.home.pack(this.current);
    const used = placed.reduce((most, p) => Math.max(most, p.row + p.rows), 0);
    return el('div', { class: 'ch-grid', style: `grid-template-rows: repeat(${rows}, 1fr)`, 'aria-hidden': 'true' },
      placed.map((p) => el('span', {
        class: 'ch-block',
        style: `grid-area: ${p.row + 1} / ${p.col + 1} / span ${p.rows} / span ${p.cols}`,
      }, labels.get(p.id) || p.id)),
      used < rows && el('span', { class: 'ch-free', style: `grid-area: ${used + 1} / 1 / ${rows + 1} / 4` }, 'Free space'));
  }

  // Buttons for a widget's sizes, each with a little drawing of its shape. `on` is the size it
  // has on Home now, if it's there.
  sizeButtons(widget, on) {
    return el('span', { class: 'ch-sizes' }, widget.sizes.map((size) => {
      const list = putWidget(this.current, widget.id, size);
      const fits = size === on || this.home.fits(list);
      return el('button', {
        type: 'button',
        class: `ch-size${fits ? '' : ' no-room'}`,
        'aria-pressed': String(size === on),
        'aria-label': `${widget.label}, ${SIZE_NAMES[size] || size}${fits ? '' : ', no room'}`,
        onclick: () => (size === on ? null : this.change(list)),
      }, el('i', { class: `ch-shape ch-${size}` }), SIZE_NAMES[size] || size);
    }));
  }

  gridSection() {
    const list = this.current;
    const widgets = new Map(this.home.widgets().map((w) => [w.id, w]));
    const shown = list;
    const { left } = this.home.pack(list);
    const arrow = (w, direction, drawing, label, disabled) => el('button', {
      type: 'button', class: 'icon-btn ghost', 'aria-label': `${label}: ${widgets.get(w.id).label}`, disabled,
      onclick: () => this.change(moveWidget(list, w.id, direction)),
    }, ui.icon(drawing));
    return el('section', { class: 'ch-section' },
      el('h3', { class: 'sub-head' }, 'Your Home'),
      this.preview(),
      this.message,
      shown.length
        ? el('ul', { class: 'ch-list' }, shown.map((w, i) => el('li', { class: 'ch-row' },
          el('div', { class: 'ch-row-top' },
            el('span', { class: 'ch-name' }, widgets.get(w.id).label,
              left.some((l) => l.id === w.id) && el('small', {}, " Doesn't fit on this phone")),
            arrow(w, -1, UP, 'Move up', i === 0),
            arrow(w, 1, DOWN, 'Move down', i === shown.length - 1),
            el('button', {
              type: 'button', class: 'icon-btn ghost', 'aria-label': `Remove ${widgets.get(w.id).label}`,
              onclick: () => this.change(removeWidget(list, w.id)),
            }, ui.icon('close'))),
          this.sizeButtons(widgets.get(w.id), w.size))))
        : ui.hint('No widgets on Home. Add one below.', { small: true }));
  }

  addSection() {
    const on = new Set(this.current.map((w) => w.id));
    const others = this.home.widgets().filter((w) => !on.has(w.id) && w.sizes.length);
    if (!others.length) return null;
    return el('section', { class: 'ch-section' },
      el('h3', { class: 'sub-head' }, 'Add a widget'),
      ui.hint('Tap a size to add it to Home.', { small: true }),
      el('ul', { class: 'ch-list' }, others.map((w) => el('li', { class: 'ch-row' },
        el('div', { class: 'ch-row-top' }, el('span', { class: 'ch-name' }, w.label)),
        this.sizeButtons(w, null)))));
  }

  // Questions and answers for the Help page.
  addHelp() {
    for (const item of [
      { group: 'home', order: 10, question: 'How do I change what\'s on Home?', answer: () => [
        'Tap the pencil under the clock on Home, or Settings → Home → Customise. You can add, remove, move and resize widgets, and choose your own photo.',
      ] },
    ]) this.add('help.questions', item);
  }
}

// ---- Photos (screen code: needs the browser) ----

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
}

// The photo, no bigger than `max` pixels across, as a JPEG data: address.
function shrink(img, max, quality) {
  const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, max);
  const canvas = el('canvas', { width, height });
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}
