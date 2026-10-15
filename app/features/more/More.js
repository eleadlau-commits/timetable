// More: the tab with everything else. Other features add rows, in groups such as
// "On the go" or "Your timetable". Tapping a row does what the feature says.
//
// Slot 'more.items': rows on the More tab.
//   Item: { id, label, icon, order, group?, detail?() → short text, onClick(), visible?() }
//
// Saved data: none.

import { Feature, ui } from 'folio';

const { el } = ui;

export default class More extends Feature {
  start() {
    this.defineSlot('more.items',
      'Rows on the More tab. Item: { id, label, icon, order, group?, detail?() → short text, onClick(), visible?() }.');
    this.add('views', {
      id: 'more',
      label: 'More',
      icon: 'dots',
      order: 50,
      subtitle: () => 'Everything else',
      mount: (container) => {
        this.box = el('div', { class: 'more-groups' });
        container.append(this.box);
      },
      render: () => this.render(),
    });
  }

  render() {
    const slot = this.slot('more.items');
    const groups = new Map(); // group name → rows, in the order of the first row of each group
    for (const item of slot.items) {
      if (!slot.run(item, (x) => (x.visible ? x.visible() : true), false)) continue;
      const name = item.group || 'Other';
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(el('li', {},
        el('button', { type: 'button', class: 'more-row', onclick: () => slot.run(item, (x) => x.onClick()) },
          el('span', { class: 'more-icon' }, ui.icon(item.icon || 'plus')),
          el('span', { class: 'more-text' },
            el('b', {}, item.label),
            el('span', {}, slot.run(item, (x) => x.detail?.(), '') || '')),
          el('span', { class: 'more-chevron' }, ui.icon('right')))));
    }
    if (!groups.size) {
      this.box.replaceChildren(ui.missing('Nothing to show here yet.'));
      return;
    }
    this.box.replaceChildren(...[...groups].map(([name, rows]) =>
      el('section', { class: 'more-group' }, el('h2', {}, name), el('ul', {}, rows))));
  }
}
