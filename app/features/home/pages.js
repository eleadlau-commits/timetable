// The pages at the top of Home, side by side: swipe left or right to move between them, or
// tap a dot. The pages follow the finger and settle on the next one; the dots under them show
// which page is open. The rules are in pager.js.

import { ui } from 'folio';
import { dragOffset, settle } from './pager.js';

const { el } = ui;
const DECIDE = 8; // px before a touch counts as sideways or not

export class Pages {
  constructor() {
    this.track = el('div', { class: 'home-track' });
    this.viewport = el('div', { class: 'home-pages' }, this.track);
    this.dots = el('div', { class: 'home-dots', role: 'tablist', 'aria-label': 'Pages' });
    this.element = el('div', { class: 'home-pager' }, this.viewport, this.dots);
    this.index = 0;
    this.count = 0;
    this.drag = null;
    this.swallowClick = false;
    this.followSwipes();
  }

  // Puts in the pages (elements), keeping the open one if it's still there.
  setPages(pages) {
    this.count = pages.length;
    this.index = Math.min(this.index, Math.max(0, this.count - 1));
    this.track.replaceChildren(...pages.map((page, i) => el('div', {
      class: 'home-page', 'aria-hidden': String(i !== this.index), inert: i !== this.index,
    }, page)));
    this.dots.hidden = this.count < 2;
    this.dots.replaceChildren(...pages.map((_, i) => el('button', {
      type: 'button',
      class: 'home-dot',
      role: 'tab',
      'aria-label': `Page ${i + 1} of ${this.count}`,
      'aria-selected': String(i === this.index),
      onclick: () => this.go(i),
    })));
    if (!this.drag?.sideways) this.place(0);
  }

  go(index) {
    this.index = Math.max(0, Math.min(this.count - 1, index));
    [...this.track.children].forEach((page, i) => {
      page.setAttribute('aria-hidden', String(i !== this.index));
      page.inert = i !== this.index;
    });
    [...this.dots.children].forEach((dot, i) => dot.setAttribute('aria-selected', String(i === this.index)));
    this.place(0);
  }

  // Moves the track to the open page, plus dx pixels while a finger drags it.
  place(dx) {
    this.track.style.transform = `translateX(calc(${-100 * this.index}% + ${dx}px))`;
  }

  followSwipes() {
    const v = this.viewport;
    v.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this.drag = { x: t.clientX, y: t.clientY, dx: 0, at: Date.now(), sideways: null };
    }, { passive: true });
    v.addEventListener('touchmove', (e) => {
      const d = this.drag;
      if (!d || this.count < 2) return;
      const t = e.changedTouches[0];
      d.dx = t.clientX - d.x;
      if (d.sideways === null && Math.hypot(d.dx, t.clientY - d.y) > DECIDE) d.sideways = Math.abs(d.dx) > Math.abs(t.clientY - d.y);
      if (!d.sideways) return;
      this.element.classList.add('dragging');
      this.place(dragOffset(this.index, d.dx, this.count));
    }, { passive: true });
    const end = () => {
      const d = this.drag;
      this.drag = null;
      this.element.classList.remove('dragging');
      if (!d?.sideways) return;
      this.swallowClick = true;
      setTimeout(() => { this.swallowClick = false; }, 400);
      this.go(settle(this.index, d.dx, v.offsetWidth, this.count, { fast: Date.now() - d.at < 250 }));
    };
    v.addEventListener('touchend', end, { passive: true });
    v.addEventListener('touchcancel', end, { passive: true });
    // A swipe that ends over a button isn't a tap on it.
    v.addEventListener('click', (e) => {
      if (!this.swallowClick) return;
      this.swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    }, true);
  }
}
