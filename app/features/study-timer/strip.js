// The pattern strip: a row of blocks whose widths show their lengths, study blocks in the
// accent colour (or the module's) and rest blocks pale. While building, drag a block's right
// edge to change its length in 5-minute steps; tap a block to type a length or delete it.
// While running, it shows every block (repeats written out) and a marker moving along it.

import { ui } from 'folio';
import { snapMinutes, formatMinutes } from './rules.js';

const { el } = ui;

// blocks: [{ kind, min }]. onChange(index, min) after a drag; onTap(index) for a tap.
export function editStrip(blocks, { onChange, onTap }) {
  const strip = el('div', { class: 'stt-strip', 'data-own-swipe': '' });
  if (!blocks.length) {
    strip.append(el('span', { class: 'stt-empty' }, 'Add a study block to start.'));
    return strip;
  }
  blocks.forEach((b, i) => {
    const label = el('span', { class: 'stt-min' }, formatMinutes(b.min));
    const handle = el('span', { class: 'stt-handle', 'aria-hidden': 'true' });
    const block = el('button', {
      type: 'button',
      class: `stt-block ${b.kind}`,
      style: `flex-grow:${b.min}`,
      'aria-label': `${b.kind === 'study' ? 'Study' : 'Rest'}, ${formatMinutes(b.min)}. Change`,
      onclick: (e) => { if (!block.dragged) onTap(i); e.preventDefault(); },
    }, label, handle);
    dragEdge(strip, block, handle, label, b, (min) => onChange(i, min));
    strip.append(block);
  });
  return strip;
}

// Dragging a block's edge: minutes follow the finger at the scale the strip had when it began.
function dragEdge(strip, block, handle, label, b, done) {
  handle.addEventListener('pointerdown', (down) => {
    down.preventDefault();
    down.stopPropagation();
    const total = [...strip.children].reduce((n, c) => n + Number(c.style.flexGrow || 0), 0);
    const perMinute = strip.getBoundingClientRect().width / total;
    let min = b.min;
    block.dragged = false;
    block.classList.add('dragging');
    handle.setPointerCapture(down.pointerId);
    const move = (e) => {
      const next = snapMinutes(b.min + (e.clientX - down.clientX) / perMinute);
      if (next === min) return;
      min = next;
      block.dragged = true;
      block.style.flexGrow = min;
      label.textContent = formatMinutes(min);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      block.classList.remove('dragging');
      if (min !== b.min) done(min);
      setTimeout(() => { block.dragged = false; }, 0);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
  handle.addEventListener('click', (e) => e.stopPropagation());
}

// The strip while running: every block, the ones done faded, and a marker at `elapsed / total`.
// Returns { element, update(position) }.
export function runStrip(blocks) {
  const parts = blocks.map((b) => el('span', { class: `stt-block ${b.kind}`, style: `flex-grow:${b.min}` }));
  const marker = el('span', { class: 'stt-marker' });
  const element = el('div', { class: 'stt-strip running', role: 'img', 'data-own-swipe': '' }, ...parts, marker);
  return {
    element,
    update(p) {
      const share = p.total ? p.elapsed / p.total : 1;
      marker.style.left = `${(share * 100).toFixed(2)}%`;
      parts.forEach((part, i) => part.classList.toggle('past', i < p.index || p.done));
      element.setAttribute('aria-label', `Block ${Math.min(p.index + 1, blocks.length)} of ${blocks.length}, ${Math.round(share * 100)}% of the session done`);
    },
  };
}
