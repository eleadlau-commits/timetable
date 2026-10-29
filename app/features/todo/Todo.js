// To-do list: a list of things to do, with tags and due dates. The Plan Today page at the top
// of Home (second, after the clock), with how many things are due today, has an Open button
// that opens it in a pop-up:
//   - at the top, the to-dos due today that aren't ticked yet
//   - tags along the top to filter by (All, Academic, Society, and any you add), which can be
//     added, renamed and deleted; deleting a tag keeps its to-dos, just without a tag
//   - the list, soonest due first, those without a date last, overdue ones marked in red
//   - a form to add a to-do with an optional tag and due date
// The rules (sorting, overdue, due today, tags) are in rules.js, with tests.
//
// Saved data (on this phone only):
//   'items' → [{ id, text, tag, due: 'YYYY-MM-DD' or null, done, added }]
//   'tags'  → [{ id, name }]   (until changed, the starting tags: Academic and Society)

import { Feature, ui } from 'folio';
import { DEFAULT_TAGS, isOverdue, sortItems, filterItems, addTag, renameTag, deleteTag, dueLabel, dueToday, dueTodayText } from './rules.js';

const { el } = ui;

export default class Todo extends Feature {
  start() {
    this.addHelp();
    this.items = this.storage.get('items', []);
    this.tags = this.storage.get('tags', DEFAULT_TAGS);
    this.filter = 'all'; // 'all' or a tag id
    this.editing = null; // null, 'add-tag' or 'rename'
    this.adding = false; // the add-a-to-do form is open

    this.add('home.pages', {
      id: 'plan-today',
      order: 5,
      render: () => el('section', { class: 'home-page-row', 'aria-label': 'Plan Today' },
        el('div', {},
          el('h2', { class: 'home-page-title' }, 'Plan Today'),
          el('p', { class: 'home-page-line' }, dueTodayText(dueToday(this.items).length))),
        el('button', { type: 'button', class: 'home-button', onclick: () => this.open() }, el('b', {}, 'Open'), ui.icon('right'))),
    });
    // On Home, if someone adds it there (Customise Home): off until then.
    this.add('home.widgets', {
      id: 'todo', label: 'To-do list', order: 50, sizes: ['tall', 'wide'], start: false,
      render: (size) => this.widget(size),
    });
  }

  // The Home widget: how many are due today, then the to-dos still to do, soonest first.
  // Tap it to open the list.
  widget(size) {
    const today = new Date();
    const due = dueToday(this.items, today).length;
    const open = sortItems(this.items.filter((item) => !item.done)).slice(0, 6);
    return el('button', { type: 'button', class: `todo-widget todo-${size}`, 'aria-label': `To-do list, ${dueTodayText(due).toLowerCase()}. Open`, onclick: () => this.open() },
      el('span', { class: 'todo-widget-head' }, el('b', {}, 'To-do'), el('span', {}, dueTodayText(due))),
      open.length
        ? el('ul', { class: 'todo-widget-list' }, open.map((item) => el('li', { class: isOverdue(item, today) ? 'overdue' : '' }, item.text)))
        : el('span', { class: 'todo-widget-empty' }, 'Nothing to do. Tap to add something.'));
  }

  save() {
    this.storage.set('items', this.items);
    this.storage.set('tags', this.tags);
    this.refresh();
  }

  open() {
    if (!this.window) {
      this.window = ui.dialog({ title: 'To-do list', className: 'todo-dialog', onClose: () => { this.editing = null; this.adding = false; } });
    }
    this.render();
    this.window.open();
  }

  render(focus = null) {
    if (!this.tags.some((t) => t.id === this.filter)) this.filter = 'all';
    this.error = ui.errorBox();
    this.window.setContent(this.todaySection(), this.tagBar(), this.tagTools(), this.error, this.list(), this.addArea());
    if (focus) this.window.element.querySelector(focus)?.focus();
  }

  tagName(id) {
    return this.tags.find((t) => t.id === id)?.name || null;
  }

  // ---- Due today ----

  // At the top: the to-dos due today that aren't ticked yet, whichever tag is chosen below.
  todaySection() {
    const today = new Date();
    const items = sortItems(dueToday(this.items, today));
    return el('section', { class: 'todo-today' },
      el('h3', { class: 'todo-head' }, 'Due today'),
      items.length
        ? el('ul', { class: 'todo-list' }, items.map((item) => this.row(item, today)))
        : ui.hint('Nothing due today.', { small: true }));
  }

  // ---- Tags ----

  tagBar() {
    const chip = (id, label) => el('button', {
      type: 'button',
      class: 'todo-tag',
      'aria-pressed': String(this.filter === id),
      onclick: () => {
        this.filter = id;
        this.editing = null;
        this.render();
      },
    }, label);
    return el('div', { class: 'todo-tags', role: 'group', 'aria-label': 'Show to-dos tagged' },
      chip('all', 'All'),
      this.tags.map((t) => chip(t.id, t.name)),
      el('button', {
        type: 'button',
        class: 'todo-tag add',
        onclick: () => {
          this.editing = 'add-tag';
          this.render('.todo-tag-form input');
        },
      }, '+ Add tag'));
  }

  // Under the tags: the form for a new tag or a new name, or Rename / Delete for the chosen tag.
  tagTools() {
    if (this.editing === 'add-tag') {
      return this.nameForm('New tag', '', 'Add tag', (name) => {
        const result = addTag(this.tags, name);
        if (!result) return false;
        this.tags = result.tags;
        this.filter = result.tag.id;
        return true;
      });
    }
    if (this.filter === 'all') return null;
    const name = this.tagName(this.filter);
    if (this.editing === 'rename') {
      return this.nameForm('Tag name', name, 'Save', (value) => {
        const tags = renameTag(this.tags, this.filter, value);
        if (!tags) return false;
        this.tags = tags;
        return true;
      });
    }
    return el('div', { class: 'todo-tag-tools' },
      el('button', { type: 'button', class: 'link-btn', onclick: () => { this.editing = 'rename'; this.render('.todo-tag-form input'); } }, 'Rename tag'),
      el('button', {
        type: 'button',
        class: 'link-btn todo-danger',
        onclick: () => {
          const result = deleteTag(this.tags, this.items, this.filter);
          this.tags = result.tags;
          this.items = result.items;
          this.filter = 'all';
          this.save();
          this.render();
          ui.toast(`Deleted the tag ${name}. Its to-dos are still here.`);
        },
      }, 'Delete tag'));
  }

  // A one-line form for a tag's name. apply(name) returns false if the name can't be used.
  nameForm(label, value, button, apply) {
    const input = el('input', { type: 'text', value, 'aria-label': label, placeholder: label, maxlength: 30 });
    return el('form', {
      class: 'todo-tag-form',
      onsubmit: (e) => {
        e.preventDefault();
        if (!apply(input.value)) {
          this.error.show('Give the tag a name that no other tag has.');
          return;
        }
        this.editing = null;
        this.save();
        this.render();
      },
    }, input,
    el('button', { type: 'submit', class: 'btn primary small' }, button),
    el('button', { type: 'button', class: 'btn small', onclick: () => { this.editing = null; this.render(); } }, 'Cancel'));
  }

  // ---- The list ----

  list() {
    const items = filterItems(sortItems(this.items), this.filter);
    if (!items.length) {
      return ui.missing(this.filter === 'all'
        ? 'Nothing on your list yet. Add a to-do below.'
        : `No to-dos tagged ${this.tagName(this.filter)}.`);
    }
    const today = new Date();
    return el('ul', { class: 'todo-list' }, items.map((item) => this.row(item, today)));
  }

  row(item, today) {
    const overdue = isOverdue(item, today);
    const tag = this.tagName(item.tag);
    const update = (change) => {
      this.items = this.items.map((x) => (x.id === item.id ? { ...x, ...change } : x));
      this.save();
      this.render();
    };
    return el('li', { class: `todo-item${item.done ? ' done' : ''}` },
      el('button', {
        type: 'button',
        class: 'todo-tick',
        role: 'checkbox',
        'aria-checked': String(!!item.done),
        'aria-label': `Done: ${item.text}`,
        onclick: () => update({ done: !item.done }),
      }, ui.icon('check')),
      el('div', { class: 'todo-main' },
        el('span', { class: 'todo-text' }, item.text),
        (tag || item.due) && el('div', { class: 'todo-meta' },
          tag && el('span', { class: 'todo-pill' }, tag),
          item.due && el('span', { class: `todo-due${overdue ? ' overdue' : ''}` },
            overdue ? `Overdue · ${dueLabel(item.due, today)}` : dueLabel(item.due, today)))),
      el('button', {
        type: 'button',
        class: 'icon-btn ghost todo-delete',
        'aria-label': `Delete: ${item.text}`,
        onclick: () => {
          this.items = this.items.filter((x) => x.id !== item.id);
          this.save();
          this.render();
        },
      }, ui.icon('trash')));
  }

  // ---- Adding a to-do ----

  addArea() {
    if (!this.adding) {
      return el('button', {
        type: 'button',
        class: 'btn block todo-new',
        onclick: () => {
          this.adding = true;
          this.render('.todo-form input[type="text"]');
        },
      }, '+ Add a to-do');
    }
    const text = el('input', { type: 'text', placeholder: 'What needs doing?', 'aria-label': 'To-do', maxlength: 200 });
    const tag = ui.select([['', 'No tag'], ...this.tags.map((t) => [t.id, t.name])],
      { value: this.filter === 'all' ? '' : this.filter });
    tag.setAttribute('aria-label', 'Tag');
    const due = el('input', { type: 'date', 'aria-label': 'Due date (optional)' });
    return el('form', {
      class: 'todo-form',
      onsubmit: (e) => {
        e.preventDefault();
        if (!text.value.trim()) {
          this.error.show('Write what needs doing first.');
          return;
        }
        this.items = [...this.items, {
          id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          text: text.value.trim(),
          tag: tag.value || null,
          due: due.value || null,
          done: false,
          added: Date.now(),
        }];
        this.save();
        this.render('.todo-form input[type="text"]');
      },
    },
    el('div', { class: 'label' }, 'New to-do'),
    text,
    el('div', { class: 'todo-form-row' },
      el('label', { class: 'todo-field' }, el('span', {}, 'Tag'), tag),
      el('label', { class: 'todo-field' }, el('span', {}, 'Due (optional)'), due)),
    el('div', { class: 'todo-form-row' },
      el('button', { type: 'submit', class: 'btn primary' }, 'Add'),
      el('button', { type: 'button', class: 'btn', onclick: () => { this.adding = false; this.render(); } }, 'Done')));
  }

  // Questions and answers for the Help page.
  addHelp() {
    for (const item of [
      { group: 'home', order: 30, question: 'Where\'s my to-do list?', answer: () => [
        'On Home, swipe the dark area at the top to Plan Today and tap Open. You can also add a To-do widget to Home.',
      ] },
    ]) this.add('help.questions', item);
  }
}
