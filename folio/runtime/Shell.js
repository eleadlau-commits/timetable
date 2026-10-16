// The app's frame: one top bar (menu on the left; buttons and account on the right), a title for each
// view, the tab bar along the bottom, full-screen pages (such as a setup screen), the menu and
// the Settings window. Features fill it through the framework's own slots:
//
//   'header.buttons'  { id, label, icon, order, onClick(), visible?(), busy?() }   rows in the menu
//   'header.status'   { order, text() }               short text in the menu and under view titles
//   'header.actions'  { id, label, icon, order, onClick(), visible?() }   icon buttons in the top bar,
//                       left of the account button
//   'views'           { id, label, icon?, order, mount(container, { head }), render(), step?(direction),
//                       visible?(), start?, darkHead?, hideTitle?, subtitle?(), contains?(id), open?(id), subviews?() }
//   'settings'        { id, title?, order, render() }   a section in the Settings window
//
// See folio/README.md for details and examples.

import { el, icon, dialog, toggle, hint, onSwipe } from './ui.js';
import { Menu } from './Menu.js';

export class Shell {
  constructor(app) {
    this.app = app;
    this.prefs = app.storage.area('folio');
    this.sections = new Map(); // view → { section, head, title, subtitle, extra, body, mounted }
    this.screens = []; // [{ owner, node }], the last one is shown
    this.restartNeeded = false;
    this.currentId = null; // the open view; the app always opens on the start view
    this.ready = false; // set by the app once every feature has started (and added its views)
    // A view asked for in the address (#view=week), read now because features may tidy the address.
    this.wanted = new URLSearchParams(location.hash.slice(1)).get('view');

    this.menuButton = el('button', { type: 'button', class: 'top-btn', 'aria-label': 'Menu', onclick: () => this.openMenu() }, icon('menu'));
    this.accountButton = el('button', { type: 'button', class: 'top-btn account', 'aria-label': 'Account and settings', onclick: () => this.openSettings() }, icon('account'));
    this.actions = el('div', { class: 'top-actions' });
    this.viewHost = el('div', { class: 'view-host' });
    this.empty = el('div', { class: 'empty', hidden: true });
    this.screenHost = el('div', { class: 'screen-host', hidden: true });
    this.main = el('main', {}, this.viewHost, this.empty);
    this.tabs = el('nav', { class: 'tabbar', 'aria-label': 'Main', hidden: true });

    const root = document.getElementById('folio-root') || document.body.appendChild(el('div', { id: 'folio-root' }));
    this.frame = el('div', { class: 'app' },
      el('header', { class: 'topbar' }, this.menuButton, el('div', { class: 'top-right' }, this.actions, this.accountButton)),
      this.screenHost,
      this.main,
      this.tabs);
    root.replaceChildren(this.frame);

    onSwipe(this.viewHost, (dir) => this.step(dir));
    document.addEventListener('keydown', (e) => {
      if (this.main.hidden || document.querySelector('dialog[open]')) return;
      if (e.target.matches?.('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') this.step(-1);
      if (e.key === 'ArrowRight') this.step(1);
    });
  }

  // ---- Title ----

  // The name in the browser tab (the top bar itself has no title).
  setTitle(text) {
    document.title = text || this.app.config.name;
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
    // Wait until every feature has started before choosing, or an early redraw could pick a
    // view that happens to be there already instead of the start view.
    if (this.currentId === null && this.ready) {
      this.currentId = (views.find((v) => v.start) || views[0])?.id ?? null;
      if (this.wanted) this.selectView(this.wanted, { quiet: true });
    }
    return views.find((v) => v.id === this.currentId) || views.find((v) => v.start) || views[0] || null;
  }

  // Switches to a view, or to a view inside another (such as Day inside Planner). Returns false
  // if no view with that id is installed.
  selectView(id, { quiet = false } = {}) {
    const slot = this.app.slot('views');
    const views = this.views;
    let view = views.find((v) => v.id === id);
    if (!view) {
      view = views.find((v) => slot.run(v, (x) => !!x.contains?.(id), false));
      if (!view) return false;
      slot.run(view, (x) => x.open?.(id));
    }
    const changed = this.currentId !== view.id;
    this.currentId = view.id;
    if (!quiet) {
      if (changed) window.scrollTo(0, 0);
      this.render();
    }
    return true;
  }

  step(direction) {
    const view = this.currentView;
    if (view?.step) this.app.slot('views').run(view, (v) => v.step(direction));
  }

  // ---- Drawing ----

  render() {
    this.renderStatus();
    this.renderActions();
    if (this.menu?.isOpen) this.renderMenu();
    const screen = this.screens.at(-1);
    this.screenHost.hidden = !screen;
    this.main.hidden = !!screen;
    // Only a view that asks for it (darkHead) has the dark area under its title too.
    this.frame.classList.toggle('dark-head', !screen && !!this.currentView?.darkHead);
    if (screen) {
      this.tabs.hidden = true;
      if (this.screenHost.firstChild !== screen.node) this.screenHost.replaceChildren(screen.node);
      return;
    }
    this.screenHost.replaceChildren();
    this.renderViews();
  }

  renderStatus() {
    const parts = this.app.slot('header.status').map((s) => s.text());
    if (!navigator.onLine) parts.push('offline');
    this.statusText = parts.filter(Boolean).join(' · ');
  }

  // Buttons other features put in the top bar ('header.actions'), left of the account button.
  renderActions() {
    const slot = this.app.slot('header.actions');
    this.actions.replaceChildren(...slot.items
      .filter((a) => slot.run(a, (x) => (x.visible ? x.visible() : true), false))
      .map((a) => el('button', {
        type: 'button',
        class: 'top-btn top-action',
        'aria-label': a.label,
        title: a.label,
        onclick: () => slot.run(a, (x) => x.onClick()),
      }, icon(a.icon || 'plus'))));
  }

  renderViews() {
    const slot = this.app.slot('views');
    const views = this.views;
    const current = this.currentView;

    this.tabs.hidden = views.length < 2;
    const index = Math.max(0, views.indexOf(current));
    this.tabs.style.setProperty('--glow-x', `${((index + 0.5) / Math.max(views.length, 1)) * 100}%`);
    this.tabs.replaceChildren(...views.map((v) => el('button', {
      type: 'button',
      class: 'tab',
      'aria-current': v === current ? 'page' : null,
      onclick: () => this.selectView(v.id),
    }, icon(v.icon || 'dots'), el('span', {}, v.label))));

    for (const v of views) {
      let part = this.sections.get(v);
      if (!part) {
        part = { title: el('h1'), subtitle: el('p', { class: 'page-sub' }), extra: el('div', { class: 'page-extra' }), body: el('div', { class: 'page-body' }), mounted: false };
        part.head = el('div', { class: 'page-head' }, el('div', { class: 'page-title' }, part.title, part.subtitle), part.extra);
        part.section = el('section', { class: `view view-${v.id}` }, part.head, part.body);
        this.sections.set(v, part);
        this.viewHost.append(part.section);
      }
      if (!part.mounted && v === current) {
        part.mounted = true;
        slot.run(v, (x) => x.mount?.(part.body, { head: part.extra }));
      }
      part.section.hidden = v !== current;
    }
    for (const [v, part] of this.sections) if (!views.includes(v)) part.section.hidden = true;

    this.empty.hidden = !!current;
    if (!current) {
      this.empty.replaceChildren(el('b', {}, 'Nothing to show yet'),
        el('div', {}, 'This app has no views installed. Add a view feature to the app/features folder.'));
      return;
    }
    const part = this.sections.get(current);
    part.title.parentNode.hidden = !!current.hideTitle;
    part.title.textContent = current.label;
    part.subtitle.textContent = slot.run(current, (v) => v.subtitle?.(), null) ?? this.statusText;
    slot.run(current, (v) => v.render?.());
  }

  // ---- Menu: the 'header.buttons' items, with the status line ----

  openMenu() {
    if (!this.menu) this.menu = new Menu();
    this.renderMenu();
    this.menu.open();
  }

  closeMenu() {
    this.menu?.close();
  }

  renderMenu() {
    const slot = this.app.slot('header.buttons');
    const row = (label, name, onClick, busy = false) => el('button', {
      type: 'button',
      class: `menu-row${busy ? ' spin' : ''}`,
      onclick: () => {
        this.closeMenu();
        onClick();
      },
    }, icon(name), el('span', {}, label));
    const rows = slot.map((b) => {
      if (b.visible && !b.visible()) return null;
      return row(b.label, b.icon || 'plus', () => slot.run(b, (x) => x.onClick()), !!b.busy?.());
    });
    this.menu.setContent(
      el('div', { class: 'menu-top' }, el('div', { class: 'menu-who' }, el('b', {}, this.app.config.name), this.statusText && el('small', {}, this.statusText))),
      el('div', { class: 'menu-list' }, rows, row('Settings', 'gear', () => this.openSettings())));
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
