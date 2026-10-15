// The app's frame: the top bar, the tabs between views, full-screen pages (such as a setup
// screen), and the Settings window. Features fill it through the framework's own slots:
//
//   'header.buttons'  { id, label, icon, order, onClick(), visible?(), busy?() }
//   'header.status'   { order, text() }               short text under the app's name
//   'views'           { id, label, order, mount(container), render(), step?(direction), visible?() }
//   'settings'        { id, title?, order, render() }   a section in the Settings window
//
// See folio/README.md for details and examples.

import { el, icon, dialog, toggle, hint, onSwipe } from './ui.js';

export class Shell {
  constructor(app) {
    this.app = app;
    this.prefs = app.storage.area('folio');
    this.sections = new Map(); // view id → { container, mounted }
    this.screens = []; // [{ owner, node }], the last one is shown
    this.restartNeeded = false;

    this.title = el('h1', {}, app.config.name);
    this.status = el('div', { class: 'sub' });
    this.actions = el('div', { class: 'actions' });
    this.tabs = el('div', { class: 'seg', role: 'tablist', 'aria-label': 'View' });
    this.viewHost = el('div', { class: 'view-host' });
    this.empty = el('div', { class: 'empty', hidden: true });
    this.screenHost = el('div', { class: 'screen-host', hidden: true });
    this.main = el('main', {}, this.tabs, this.viewHost, this.empty);

    const root = document.getElementById('folio-root') || document.body.appendChild(el('div', { id: 'folio-root' }));
    root.replaceChildren(el('div', { class: 'app' },
      el('header', { class: 'topbar' }, el('div', { class: 'titles' }, this.title, this.status), this.actions),
      this.screenHost,
      this.main));

    app.slot('header.buttons').add({ id: 'settings', label: 'Settings', icon: 'gear', order: 1000, onClick: () => this.openSettings() }, 'folio');

    onSwipe(this.viewHost, (dir) => this.step(dir));
    document.addEventListener('keydown', (e) => {
      if (this.main.hidden || document.querySelector('dialog[open]')) return;
      if (e.target.matches?.('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') this.step(-1);
      if (e.key === 'ArrowRight') this.step(1);
    });
  }

  // ---- Title ----

  setTitle(text) {
    this.title.textContent = text || this.app.config.name;
  }

  // ---- Full-screen pages, e.g. a setup screen shown before there's anything to see ----

  showScreen(owner, node) {
    this.screens = this.screens.filter((s) => s.owner !== owner);
    this.screens.push({ owner, node });
    this.render();
  }

  hideScreen(owner) {
    const before = this.screens.length;
    this.screens = this.screens.filter((s) => s.owner !== owner);
    if (this.screens.length !== before) this.render();
  }

  // ---- Views ----

  get views() {
    const slot = this.app.slot('views');
    return slot.items.filter((v) => slot.run(v, (x) => (x.visible ? x.visible() : true), false));
  }

  get currentView() {
    const views = this.views;
    const saved = this.prefs.get('view');
    return views.find((v) => v.id === saved) || views[0] || null;
  }

  // Switches to a view. Returns false if no view with that id is installed.
  selectView(id) {
    if (!this.views.some((v) => v.id === id)) return false;
    this.prefs.set('view', id);
    this.render();
    return true;
  }

  step(direction) {
    const view = this.currentView;
    if (view?.step) this.app.slot('views').run(view, (v) => v.step(direction));
  }

  // ---- Drawing ----

  render() {
    this.renderButtons();
    this.renderStatus();
    const screen = this.screens.at(-1);
    this.screenHost.hidden = !screen;
    this.main.hidden = !!screen;
    if (screen) {
      if (this.screenHost.firstChild !== screen.node) this.screenHost.replaceChildren(screen.node);
      return;
    }
    this.screenHost.replaceChildren();
    this.renderViews();
  }

  renderButtons() {
    const slot = this.app.slot('header.buttons');
    this.actions.replaceChildren(...slot.map((b) => {
      if (b.visible && !b.visible()) return null;
      return el('button', {
        type: 'button',
        class: `icon-btn${b.busy?.() ? ' spin' : ''}`,
        'aria-label': b.label,
        title: b.label,
        onclick: () => slot.run(b, (x) => x.onClick()),
      }, icon(b.icon || 'plus'));
    }));
  }

  renderStatus() {
    const parts = this.app.slot('header.status').map((s) => s.text());
    if (!navigator.onLine) parts.push('offline');
    this.status.textContent = parts.filter(Boolean).join(' · ');
  }

  renderViews() {
    const slot = this.app.slot('views');
    const views = this.views;
    const current = this.currentView;

    this.tabs.hidden = views.length < 2;
    this.tabs.style.setProperty('--tabs', views.length);
    this.tabs.replaceChildren(...views.map((v) => el('button', {
      type: 'button',
      role: 'tab',
      'aria-selected': String(v === current),
      onclick: () => this.selectView(v.id),
    }, v.label)));

    for (const v of views) {
      let section = this.sections.get(v);
      if (!section) {
        section = { container: el('section', { class: `view view-${v.id}` }), mounted: false };
        this.sections.set(v, section);
        this.viewHost.append(section.container);
      }
      if (!section.mounted && v === current) {
        section.mounted = true;
        slot.run(v, (x) => x.mount?.(section.container));
      }
      section.container.hidden = v !== current;
    }
    for (const [v, section] of this.sections) if (!views.includes(v)) section.container.hidden = true;

    this.empty.hidden = !!current;
    if (!current) {
      this.empty.replaceChildren(el('b', {}, 'Nothing to show yet'),
        el('div', {}, 'This app has no views installed. Add a view feature to the app/features folder.'));
      return;
    }
    slot.run(current, (v) => v.render?.());
  }

  // ---- Settings ----

  openSettings() {
    if (!this.settings) this.settings = dialog({ title: 'Settings', className: 'settings-dialog' });
    this.renderSettings();
    this.settings.open();
  }

  // Redraws the Settings window if it's open, e.g. after a section's data changed.
  refreshSettings() {
    if (this.settings?.isOpen) this.renderSettings();
  }

  closeSettings() {
    this.settings?.close();
  }

  renderSettings() {
    const slot = this.app.slot('settings');
    const sections = slot.map((s) => {
      const body = s.render();
      if (!body) return null;
      return el('section', { class: 'settings-section' }, s.title && el('h3', { class: 'sub-head' }, s.title), body);
    });
    this.settings.setContent(...sections, this.featuresSection(), this.aboutSection());
  }

  featuresSection() {
    const disabled = new Set(this.prefs.get('disabled', []));
    const rows = [...this.app.features.values()]
      .filter((f) => f.status !== 'not-for-platform')
      .map((f) => {
        const on = !disabled.has(f.manifest.id);
        const note = {
          active: f.problem ? `Had a problem: ${f.problem}` : f.manifest.description,
          failed: `Couldn't start: ${f.reason}`,
          disabled: 'Switched off',
          skipped: f.reason,
        }[f.status] || f.manifest.description;
        return el('div', { class: `feature-row${f.status === 'active' ? '' : ' off'}` },
          el('div', { class: 'feature-text' }, el('b', {}, f.manifest.name), el('small', {}, note)),
          toggle({
            checked: on,
            label: `Use ${f.manifest.name}`,
            onChange: (checked) => {
              if (checked) disabled.delete(f.manifest.id);
              else disabled.add(f.manifest.id);
              this.prefs.set('disabled', [...disabled]);
              this.restartNeeded = true;
              this.renderSettings();
            },
          }));
      });
    return el('section', { class: 'settings-section' },
      el('h3', { class: 'sub-head' }, 'Features'),
      hint('Switch off anything you don\'t use. Features that need a switched-off feature are switched off too.', { small: true }),
      el('div', { class: 'feature-list' }, rows),
      this.restartNeeded && el('button', { type: 'button', class: 'btn primary', onclick: () => location.reload() }, 'Restart the app to apply'));
  }

  aboutSection() {
    const { name, version, build, framework } = this.app.config;
    const problems = this.app.problems;
    return el('section', { class: 'settings-section about' },
      el('h3', { class: 'sub-head' }, 'About'),
      hint(`${name} ${version}${build ? ` (build ${build})` : ''} · Made with Folio ${framework}`, { small: true }),
      problems.length > 0 && el('details', { class: 'advanced' },
        el('summary', {}, `${problems.length} problem${problems.length > 1 ? 's' : ''} since the app opened`),
        el('ul', { class: 'problems' }, problems.slice(-20).map((p) => el('li', {}, `${p.feature || 'app'}: ${p.message}${p.where ? ` (${p.where})` : ''}`)))));
  }
}
