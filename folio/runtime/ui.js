// Helpers for building screens. They give every feature the same look and behaviour.
//
// Build elements with el() rather than innerHTML: text from outside the app (a calendar,
// a barcode, a web page) can contain code, and el() always treats it as plain text.

// el('button', { class: 'btn', onclick: fn }, 'Save') → <button class="btn">Save</button>
// Attributes starting with "on" become event listeners; true/false/null control presence.
export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false || kid === '') continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

// Line icons, drawn with the current text colour.
export const ICONS = {
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M6 9v6M8.5 9v6M11.5 9v6M13.5 9v6M16.5 9v6M18 9v6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  note: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

// An icon by name (see ICONS), or your own SVG drawing on a 24×24 grid.
export function icon(nameOrDrawing) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[nameOrDrawing] ?? nameOrDrawing;
  return svg;
}

// A short message at the bottom of the screen that disappears after a few seconds.
let toastTimer;
export function toast(message) {
  let box = document.getElementById('folio-toast');
  if (!box) {
    box = el('div', { id: 'folio-toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), 4000);
}

// A pop-up window with a title and a close button. Create it once, then open() it as often as
// you like. Put your content in it with setContent(...nodes) or append to `.content`.
export function dialog({ title = '', className = '', onClose } = {}) {
  const heading = el('h2', {}, title);
  const content = el('div', { class: 'dialog-content' });
  const element = el('dialog', { class: className },
    el('div', { class: 'dialog-body' },
      el('div', { class: 'dialog-head' },
        heading,
        el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Close', onclick: () => element.close() }, icon('close'))),
      content));
  element.addEventListener('click', (e) => { if (e.target === element) element.close(); }); // tap outside to close
  if (onClose) element.addEventListener('close', onClose);
  document.body.append(element);
  return {
    element,
    content,
    get isOpen() { return element.open; },
    open() { if (!element.open) element.showModal(); },
    close() { if (element.open) element.close(); },
    setTitle(text) { heading.textContent = text; },
    setContent(...nodes) { content.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false)); },
  };
}

// A red message box, hidden until show(message) is called. show(null) hides it again.
export function errorBox() {
  const box = el('div', { class: 'error', role: 'alert', hidden: true });
  box.show = (message) => {
    box.textContent = message || '';
    box.hidden = !message;
  };
  return box;
}

// A small grey explanation.
export const hint = (text, { small = false } = {}) => el('p', { class: small ? 'hint small' : 'hint' }, text);

// A <select> from [[value, label], ...].
export function select(options, { value, id, onChange } = {}) {
  const node = el('select', { id, onchange: onChange && ((e) => onChange(e.target.value)) },
    options.map(([v, label]) => el('option', { value: v }, label)));
  if (value != null) node.value = String(value);
  return node;
}

// An on/off switch.
export function toggle({ checked = false, label = '', disabled = false, onChange } = {}) {
  return el('label', { class: 'switch' },
    el('input', { type: 'checkbox', checked, disabled, 'aria-label': label, onchange: onChange && ((e) => onChange(e.target.checked)) }),
    el('span', { class: 'slider', 'aria-hidden': 'true' }));
}

// A hidden file picker. pick() opens it and resolves with the chosen File, or null.
export function filePicker(accept) {
  const input = el('input', { type: 'file', accept, hidden: true });
  document.body.append(input);
  return {
    pick() {
      return new Promise((resolve) => {
        input.onchange = () => {
          const file = input.files[0] || null;
          input.value = '';
          resolve(file);
        };
        input.click();
      });
    },
  };
}

// Calls fn(+1) for a swipe to the left (next) and fn(-1) for a swipe to the right (previous).
export function onSwipe(target, fn) {
  let x = 0;
  let y = 0;
  target.addEventListener('touchstart', (e) => { x = e.changedTouches[0].clientX; y = e.changedTouches[0].clientY; }, { passive: true });
  target.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - x;
    const dy = e.changedTouches[0].clientY - y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 45) fn(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// Loads an outside script (e.g. a library from a CDN) once.
const scripts = new Map();
export function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { scripts.delete(src); reject(new Error(`Couldn't load ${src}`)); };
      document.head.append(s);
    }));
  }
  return scripts.get(src);
}
