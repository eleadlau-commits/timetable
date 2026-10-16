// Planner: a tab that holds views of the timetable (Day, Week, Upcoming), with a switch between
// them under the title. Each of those views is its own feature, added to the
// 'planner.views' slot. Without Planner they show up as tabs of their own.
// Other features can put small buttons on the right of the title ('planner.actions'), such as
// the timetable's refresh button.
//
// Service 'planner': present while Planner is running, so views know to add themselves here.
//
// Saved data: 'view' → the id of the view last open in the Planner

import { Feature, ui } from 'folio';

const { el } = ui;

export default class Planner extends Feature {
  start() {
    this.defineSlot('planner.views',
      'Views inside the Planner tab. Item: { id, label, order, mount(container), render(), step?(direction), visible?() }, as for the \'views\' slot.');
    this.defineSlot('planner.actions',
      'Small round buttons on the right of the Planner\'s title, for every view in it. Item: { order, render() → element or null }.');
    this.provide('planner', this);
    this.sections = new Map(); // view → { container, mounted }
    this.current = this.storage.get('view', null);
    // Before the Planner, the open view (day, week or agenda) was saved by the app itself.
    this.storage.once('import-open-view', () => {
      const old = this.app.storage.area('folio').get('view');
      if (old && !this.current) this.choose(old);
    });

    this.add('views', {
      id: 'planner',
      label: 'Planner',
      icon: 'calendar',
      order: 10,
      visible: () => this.views.length > 0,
      mount: (container, { head, actions }) => this.mount(container, head, actions),
      render: () => this.render(),
      step: (direction) => this.step(direction),
      contains: (id) => this.views.some((v) => v.id === id),
      open: (id) => this.choose(id),
      subviews: () => this.views.map((v) => v.id),
    });
  }

  get views() {
    const slot = this.slot('planner.views');
    return slot.items.filter((v) => slot.run(v, (x) => (x.visible ? x.visible() : true), false));
  }

  get view() {
    const views = this.views;
    return views.find((v) => v.id === this.current) || views[0] || null;
  }

  choose(id) {
    this.current = id;
    this.storage.set('view', id);
    this.refresh();
  }

  step(direction) {
    const view = this.view;
    if (view?.step) this.slot('planner.views').run(view, (v) => v.step(direction));
  }

  mount(container, head, actions) {
    this.actions = actions || null; // frameworks before Folio 1.4 have no place for them
    this.switcher = el('div', { class: 'seg', role: 'tablist', 'aria-label': 'Planner view' });
    head.append(this.switcher);
    this.host = container;
  }

  render() {
    const slot = this.slot('planner.views');
    const views = this.views;
    const current = this.view;

    this.actions?.replaceChildren(...this.slot('planner.actions').map((a) => a.render()).filter(Boolean));
    this.switcher.hidden = views.length < 2;
    this.switcher.style.setProperty('--tabs', views.length);
    this.switcher.replaceChildren(...views.map((v) => el('button', {
      type: 'button',
      role: 'tab',
      'aria-selected': String(v === current),
      onclick: () => this.choose(v.id),
    }, v.label)));

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
  }
}
