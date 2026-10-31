// Planner: a tab that holds views of the timetable, as one calendar you zoom in and out of, like
// the iPhone's Calendar: Year → Month → Week → Day. Each of those is its own feature, added to the
// 'planner.views' slot with a `zoom` number (bigger is closer). Tapping something in a view zooms
// in (the view calls planner.zoomIn()); the label at the top left, or pinching, zooms out. Views
// without a `zoom` (such as Upcoming) are buttons next to the level switch instead.
// Without Planner the views show up as tabs of their own.
// Other features can put small buttons on the right of the title ('planner.actions'), such as
// the timetable's refresh button, and small buttons next to the level switch ('planner.buttons'),
// such as Modules.
//
// Service 'planner': present while Planner is running, so views know to add themselves here and
// can zoom in: zoomIn(), zoomOut(), show(id).
//
// The app opens the Planner on its closest level (Day) on today; while the app stays open it
// remembers the level when you switch tabs and come back. Nothing is saved any more: the 'view'
// key from earlier versions is left alone.

import { Feature, ui } from 'folio';

const { el } = ui;
const LIST_ICON = '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>';
const PINCH = 1.25; // how far two fingers move apart (or together, 1/PINCH) to zoom

export default class Planner extends Feature {
  start() {
    this.defineSlot('planner.views',
      'Views inside the Planner tab. Item: { id, label, order, mount(container), render(), step?(direction), visible?() } as for the \'views\' slot, '
      + 'plus zoom? (a number, bigger is closer: Year 10, Month 20, Week 30, Day 40), short? (a letter for the level switch), '
      + 'crumb?(date) (the text of the zoom-out label when a closer level is open), buttonIcon? (an icon name or drawing for the button of a view without zoom; a list by default).');
    this.defineSlot('planner.actions',
      'Small round buttons on the right of the Planner\'s title, for every view in it. Item: { order, render() → element or null }.');
    this.defineSlot('planner.buttons',
      'Small buttons next to the Planner\'s level switch, for every view in it. Item: { order, render() → element or null }.');
    this.provide('planner', this);
    this.sessions = this.use('sessions');
    this.sections = new Map(); // view → { container, mounted }
    this.current = null; // the open view's id; null means the closest level
    this.lastLevel = null; // the zoom level to go back to from a view without zoom
    this.motion = null; // 'in' or 'out' while a zoom is drawn
    this.tap = null; // { x, y, at } of the last tap, so a zoom grows from where you tapped

    this.add('views', {
      id: 'planner',
      label: 'Planner',
      icon: 'calendar',
      order: 10,
      visible: () => this.views.length > 0 && !this.use('audience')?.isBusiness(), // not in the business version
      mount: (container, { head, actions }) => this.mount(container, head, actions),
      render: () => this.render(),
      step: (direction) => this.step(direction),
      contains: (id) => this.views.some((v) => v.id === id),
      open: (id) => this.show(id),
      subviews: () => this.views.map((v) => v.id),
    });
  }

  get views() {
    const slot = this.slot('planner.views');
    return slot.items.filter((v) => slot.run(v, (x) => (x.visible ? x.visible() : true), false));
  }

  // The views you zoom between, widest first.
  get levels() {
    return this.views.filter((v) => typeof v.zoom === 'number').sort((a, b) => a.zoom - b.zoom);
  }

  get view() {
    const views = this.views;
    const levels = this.levels;
    return views.find((v) => v.id === this.current) || levels[levels.length - 1] || views[0] || null;
  }

  show(id, motion = null) {
    const before = this.view;
    this.current = id;
    const after = this.view;
    if (typeof after?.zoom === 'number') this.lastLevel = after.id;
    this.motion = before && after && before !== after ? motion : null;
    this.refresh();
  }

  // One level closer (e.g. Month → Week), on the day the sessions service has selected.
  zoomIn() {
    const levels = this.levels;
    const i = levels.indexOf(this.view);
    if (i >= 0 && i < levels.length - 1) this.show(levels[i + 1].id, 'in');
  }

  zoomOut() {
    const levels = this.levels;
    const i = levels.indexOf(this.view);
    if (i > 0) this.show(levels[i - 1].id, 'out');
  }

  step(direction) {
    const view = this.view;
    if (view?.step) this.slot('planner.views').run(view, (v) => v.step(direction));
  }

  mount(container, head, actions) {
    this.actions = actions || null; // frameworks before Folio 1.4 have no place for them
    this.crumb = el('button', { type: 'button', class: 'zoom-crumb', onclick: () => this.zoomOut() });
    this.switcher = el('div', { class: 'seg zoom-levels', role: 'tablist', 'aria-label': 'Zoom level' });
    this.extras = el('div', { class: 'zoom-extras' });
    this.buttons = el('div', { class: 'planner-buttons' });
    head.append(el('div', { class: 'zoombar' }, this.crumb, this.switcher, this.extras, this.buttons));
    this.host = el('div', { class: 'planner-host' });
    container.append(this.host);
    this.watchTaps();
    this.watchPinch();
  }

  // Remembers where the last tap was, so the next level grows out of the thing you tapped.
  watchTaps() {
    this.host.addEventListener('pointerdown', (e) => {
      this.tap = { x: e.clientX, y: e.clientY, at: Date.now() };
    }, { capture: true, passive: true });
  }

  // Two fingers moving apart zoom in; moving together zoom out.
  watchPinch() {
    let start = 0;
    let done = false;
    const gap = (e) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    this.host.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 2) return;
      start = gap(e);
      done = false;
      // A pinch isn't a swipe: stop the page changing tab when the fingers lift.
      this.host.setAttribute('data-own-swipe', '');
      const x = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      this.tap = { x, y, at: Date.now() };
    }, { passive: true });
    this.host.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2 || !start || done) return;
      e.preventDefault(); // the calendar zooms, not the page
      const ratio = gap(e) / start;
      if (ratio > PINCH) {
        done = true;
        this.zoomIn();
      } else if (ratio < 1 / PINCH) {
        done = true;
        this.zoomOut();
      }
    }, { passive: false });
    const end = (e) => {
      if (e.touches.length) return;
      start = 0;
      setTimeout(() => this.host.removeAttribute('data-own-swipe'), 0);
    };
    this.host.addEventListener('touchend', end, { passive: true });
    this.host.addEventListener('touchcancel', end, { passive: true });
  }

  render() {
    const slot = this.slot('planner.views');
    const views = this.views;
    const levels = this.levels;
    const current = this.view;
    const zoomed = levels.includes(current);

    this.actions?.replaceChildren(...this.slot('planner.actions').map((a) => a.render()).filter(Boolean));
    this.buttons.replaceChildren(...this.slot('planner.buttons').map((b) => b.render()).filter(Boolean));
    this.buttons.hidden = !this.buttons.childElementCount;

    // The zoom-out label: the next level out, named for the selected day ("‹ October").
    const i = levels.indexOf(current);
    const parent = i > 0 ? levels[i - 1] : null;
    const day = this.sessions?.selected || new Date();
    this.crumb.hidden = !parent;
    if (parent) {
      const text = slot.run(parent, (v) => v.crumb?.(day), null) || parent.label;
      this.crumb.replaceChildren(ui.icon('left'), el('span', {}, text));
      this.crumb.setAttribute('aria-label', `Zoom out to ${parent.label}: ${text}`);
    }

    this.switcher.hidden = levels.length < 2;
    this.switcher.style.setProperty('--tabs', levels.length);
    this.switcher.replaceChildren(...levels.map((v) => el('button', {
      type: 'button',
      role: 'tab',
      title: v.label,
      'aria-label': v.label,
      'aria-selected': String(v === current),
      onclick: () => this.show(v.id, levels.indexOf(v) > levels.indexOf(current) ? 'in' : 'out'),
    }, v.short || v.label[0])));

    // Views that aren't zoom levels (Upcoming) are buttons that switch them on and off.
    const others = views.filter((v) => !levels.includes(v));
    this.extras.replaceChildren(...others.map((v) => {
      const on = v === current;
      return el('button', {
        type: 'button',
        class: `icon-btn zoom-other${on ? ' on' : ''}`,
        title: v.label,
        'aria-label': v.label,
        'aria-pressed': String(on),
        onclick: () => (on ? this.show(this.lastLevel || levels[levels.length - 1]?.id || null) : this.show(v.id)),
      }, ui.icon(v.buttonIcon || LIST_ICON));
    }));
    this.extras.hidden = !others.length;
    if (!zoomed && levels.length) this.switcher.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', 'false'));

    for (const v of views) {
      let section = this.sections.get(v);
      if (!section) {
        section = { container: el('div', { class: `planner-view planner-${v.id}` }), mounted: false };
        this.sections.set(v, section);
        this.host.append(section.container);
      }
      if (!section.mounted && v === current) {
        section.mounted = true;
        slot.run(v, (x) => x.mount?.(section.container));
      }
      section.container.hidden = v !== current;
    }
    for (const [v, section] of this.sections) if (!views.includes(v)) section.container.hidden = true;
    if (current) slot.run(current, (v) => v.render?.());
    if (current && this.motion) this.animate(this.sections.get(current).container, this.motion);
    this.motion = null;
  }

  // The new level grows out of (or shrinks back into) the place you tapped.
  animate(node, motion) {
    const box = this.host.getBoundingClientRect();
    const recent = this.tap && Date.now() - this.tap.at < 1500;
    const x = recent ? this.tap.x - box.left : box.width / 2;
    const y = recent ? this.tap.y - box.top : box.height / 3;
    node.style.transformOrigin = `${Math.round(x)}px ${Math.round(y)}px`;
    node.classList.remove('zoom-in', 'zoom-out');
    void node.offsetWidth; // start the animation again
    node.classList.add(`zoom-${motion}`);
    node.addEventListener('animationend', () => node.classList.remove(`zoom-${motion}`), { once: true });
  }
}
