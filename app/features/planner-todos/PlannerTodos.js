// To-dos in the Planner: the to-do list's to-dos on the days they're due.
//   - Day view: a "To do" card above the day's classes (slot day.cards), with the day's to-dos
//     (and, on today, anything overdue) to tick off, and + Add for a new one due that day.
//     A day with nothing due shows just a small "+ Add a to-do" line.
//   - The week strip in Day and the Month grid: a small tick on days with to-dos left to do,
//     red once the day has gone by (slots day.marks and month.marks).
//   - Month view: the chosen day's to-dos above its classes (slot month.cards).
// The to-dos themselves belong to the todo feature (its service 'todos'); this only shows them.
// Which to-dos go on which day is in rules.js, with tests.
//
// Saved data: nothing.

import { Feature, ui } from 'folio';
import { dayKey, forDay, markFor, markLabel, lateLabel } from './rules.js';

const { el } = ui;

export default class PlannerTodos extends Feature {
  start() {
    this.todos = this.use('todos');
    if (!this.todos) return;
    this.addHelp();

    this.add('day.cards', { order: 10, render: (day) => this.card(day, { empty: true }) });
    this.add('month.cards', { order: 10, render: (day) => this.card(day, { empty: false }) });
    const mark = {
      order: 10,
      render: (day) => this.mark(day),
      label: (day) => markLabel(markFor(this.todos.items(), dayKey(day), dayKey(new Date()))),
    };
    this.add('day.marks', mark);
    this.add('month.marks', mark);
  }

  // The tick in a day's corner, or nothing.
  mark(day) {
    const m = markFor(this.todos.items(), dayKey(day), dayKey(new Date()));
    if (!m) return null;
    return el('span', { class: `planner-todos-mark${m.late ? ' late' : ''}` }, ui.icon('check'));
  }

  // The To do card for a day. With empty: true, a day with nothing on it gets a small Add line;
  // otherwise it gets nothing.
  card(day, { empty }) {
    const key = dayKey(day);
    const today = dayKey(new Date());
    const rows = forDay(this.todos.items(), key, today);
    const add = () => this.todos.open({ due: key });
    if (!rows.length) {
      if (!empty) return null;
      return el('button', { type: 'button', class: 'link-btn planner-todos-add-line', onclick: add }, '+ Add a to-do');
    }
    return el('section', { class: 'planner-todos-card', 'aria-label': key === today ? 'To do today' : 'To do' },
      el('div', { class: 'planner-todos-head' },
        el('h3', {}, key === today ? 'To do today' : 'To do'),
        el('button', { type: 'button', class: 'link-btn', 'aria-label': 'Add a to-do for this day', onclick: add }, '+ Add')),
      el('ul', { class: 'planner-todos-list' }, rows.map(({ item, overdue }) => this.row(item, overdue, today))));
  }

  row(item, overdue, today) {
    const tag = item.tag ? this.todos.tagName(item.tag) : null;
    return el('li', { class: `planner-todos-item${item.done ? ' done' : ''}` },
      el('button', {
        type: 'button',
        class: 'planner-todos-tick',
        role: 'checkbox',
        'aria-checked': String(!!item.done),
        'aria-label': `Done: ${item.text}`,
        onclick: () => this.todos.setDone(item.id, !item.done),
      }, ui.icon('check')),
      el('button', { type: 'button', class: 'planner-todos-main', onclick: () => this.todos.open() },
        el('span', { class: 'planner-todos-text' }, item.text),
        (tag || overdue) && el('span', { class: 'planner-todos-meta' },
          tag && el('span', { class: 'planner-todos-pill' }, tag),
          overdue && el('span', { class: 'planner-todos-late' }, `Overdue · ${lateLabel(item.due, today)}`))));
  }

  // Questions and answers for the Help page.
  addHelp() {
    this.add('help.questions', {
      group: 'timetable', order: 60, question: 'Do my to-dos show in the Planner?', answer: () => [
        'Yes. A to-do with a due date shows on its day: in Day view there\'s a To do card above your classes, and in Month it\'s above the chosen day\'s classes. You can tick them off right there, and + Add makes a new one due that day.',
        'Days with something left to do have a small tick in the corner, red if the day has gone by. Anything overdue also shows on today until you tick it. To-dos without a date stay in the list on Home.',
      ],
    });
  }
}
