// Planner: one tab holding the timetable views (Day, Week, Upcoming…), with a switch at the top
// to move between them. Each of those views stays its own feature and adds itself to the slot
// 'planner.views' (or to the app's own tabs, if this feature isn't installed).
//
// Service 'planner' (this object): select(id) opens the Planner on that view.
// Saved data: 'view' → the id of the view last shown in the Planner.

import { Feature, ui } from 'folio';

const { el } = ui;

export default class Planner extends Feature {
  start() {
    this.defineSlot('planner.views',
      'Views inside the Planner tab. Item: { id, label, order, mount(container), render(), step?(direction), visible?() }, the same as the app\'s views.');
    this.provide('planner', this);
    this.sections = new Map(); // view → { container, mounted }
    this.add('views', {
      id: 'planner',
      label: 'Planner',
      icon: 'calendar',
      order: 10,
      visible: () => this.views.length > 0,
      open: (id) => this.open(id),
      mount: (container) => this.mount(container),
      render: () => this.render(),
      step: (direction) => this.step(direction),
    });
  }

  get views() {
    const slot = this.slot('planner.views');
    return slot.items.filter((v) => slot.run(v, (x) => (x.visible ? x.visible() : true), false));
  }

  get current() {
    const views = this.views;
    return views.find((v) => v.id === this.storage.get('view')) || views[0] || null;
  }

  // Shows the view `id` inside the Planner, if there is one. Used by app.shell.selectView(id).
  open(id) {
    if (!this.views.some((v) => v.id === id)) return false;
    this.storage.set('view', id);
    return true;
  }

  // Opens the Planner on view `id`.
  select(id) {
    return this.app.shell.selectView(id);
  }

  step(direction) {
    const view = this.current;
    if (view?.step) this.slot('planner.views').run(view, (v) => v.step(direction));
  }

  mount(container) {
    this.switcher = el('div', { class: 'planner-seg', role: 'tablist', 'aria-label': 'Planner view' });
    this.host = el('div', { class: 'planner-host' });
    container.append(this.switcher, this.host);
  }

  render() {
    const slot = this.slot('planner.views');
    const views = this.views;
    const current = this.current;

    this.switcher.hidden = views.length < 2;
    this.switcher.style.setProperty('--tabs', views.length);
    this.switcher.replaceChildren(...views.map((v) => el('button', {
      type: 'button',
      role: 'tab',
      'aria-selected': String(v === current),
      onclick: () => {
        this.storage.set('view', v.id);
        this.refresh();
      },
    }, v.label)));

    for (const v of views) {
      let section = this.sections.get(v);
      if (!section) {
        section = { container: el('section', { class: `subview view-${v.id}` }), mounted: false };
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
  }
}
