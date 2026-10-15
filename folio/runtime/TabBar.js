// The tabs between views: a bar at the bottom of the screen with an icon and a label for each
// view. The current tab is filled in the accent colour, and a soft line along the top of the
// bar glows above it and slides along when another tab is chosen.

import { el, icon } from './ui.js';

// Where the glow is strongest: the middle of tab `index` of `count`, as a percentage.
export function glowAt(index, count) {
  return count > 0 && index >= 0 ? ((index + 0.5) / count) * 100 : 50;
}

export class TabBar {
  // onSelect(id) is called when a tab is tapped.
  constructor(onSelect) {
    this.onSelect = onSelect;
    this.list = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Screens' });
    this.element = el('nav', { class: 'tabbar', 'aria-label': 'Main', hidden: true },
      el('div', { class: 'tab-glow', 'aria-hidden': 'true' }), this.list);
  }

  // views: [{ id, label, icon? }]; current: the view being shown.
  render(views, current) {
    this.element.hidden = views.length < 2;
    document.body.classList.toggle('has-tabbar', !this.element.hidden);
    const index = views.indexOf(current);
    this.element.style.setProperty('--glow-x', `${glowAt(index, views.length)}%`);
    this.list.replaceChildren(...views.map((v) => el('button', {
      type: 'button',
      role: 'tab',
      class: 'tab',
      'aria-selected': String(v === current),
      onclick: () => this.onSelect(v.id),
    }, icon(v.icon || 'dots'), el('span', {}, v.label))));
  }
}
