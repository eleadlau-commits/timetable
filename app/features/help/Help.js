// Help and feedback: the Help and Feedback rows in the menu. Help opens a page of questions and
// answers in groups (groups.js). Help's own questions are in questions.js; other features add
// theirs through the 'help.questions' slot. Tapping a question opens its answer under it, or,
// for a longer one such as how to connect your timetable, a page of its own. Feedback isn't
// built yet, so it says it's coming soon.
//
// Slot 'help.questions': Item: { group, order, question, answer() → text, list of paragraphs
//   or element, page?, action?, visible?() }. visible() → false leaves it out (e.g. the library's
//   question at a university without one). group is an id from groups.js (e.g. 'timetable'); page: true
//   opens the answer as its own page; action: { label, run() } adds a button under the answer,
//   which closes Help first.
//
// Saved data: none.

import { Feature, ui } from 'folio';
import { arrange } from './groups.js';
import { QUESTIONS, CONTACT } from './questions.js';

const { el } = ui;

export default class Help extends Feature {
  start() {
    this.defineSlot('help.questions',
      'Questions and answers on the Help page. Item: { group, order, question, answer() → text, paragraphs or element, page?, action?: { label, run() }, visible?() → false to leave it out }.');
    this.add('header.buttons', {
      id: 'help',
      label: 'Help',
      icon: 'help',
      order: 70,
      onClick: () => this.open(),
    });
    this.add('header.buttons', {
      id: 'feedback',
      label: 'Feedback',
      icon: 'chat',
      order: 90,
      onClick: () => this.toast('Feedback is coming soon.'),
    });
  }

  open() {
    if (!this.window) this.window = ui.dialog({ title: 'Help', className: 'help-dialog' });
    const uni = this.use('university');
    const names = { short: uni?.short() || '', town: uni?.town() || '' };
    const own = QUESTIONS.map((q) => ({ ...q, answer: () => (typeof q.answer === 'function' ? q.answer(names) : q.answer) }));
    const slot = this.slot('help.questions');
    const shown = slot.items.filter((q) => !q.visible || slot.run(q, (x) => x.visible() !== false, true));
    const groups = arrange([...own, ...shown]);
    this.window.setContent(groups.length
      ? el('div', { class: 'help' }, ...groups.map((g) => this.group(g)))
      : ui.missing('Help\'s questions'));
    this.window.open();
  }

  group(g) {
    return el('section', { class: 'help-group' },
      el('h3', {}, g.title),
      el('div', { class: 'help-list' }, ...g.items.map((item) => this.question(item))));
  }

  question(item) {
    if (item.page) {
      return el('div', { class: 'help-q' },
        el('button', { type: 'button', class: 'help-page', onclick: () => this.openPage(item) },
          el('span', {}, item.question), ui.icon('right')));
    }
    const details = el('details', { class: 'help-q' },
      el('summary', {}, el('span', {}, item.question), ui.icon('right')));
    // The answer is drawn the first time it's opened, so it's up to date.
    details.addEventListener('toggle', () => {
      if (details.open && !details.querySelector('.help-answer')) details.append(this.answer(item, 'help-answer'));
    });
    return details;
  }

  openPage(item) {
    if (!this.page) this.page = ui.dialog({ title: '', className: 'help-page-dialog' });
    this.page.setTitle(item.question);
    this.page.setContent(this.answer(item, 'help-subpage'));
    this.page.open();
  }

  answer(item, className) {
    let content;
    try {
      content = item.answer?.();
    } catch (err) {
      console.error(err);
      content = null;
    }
    const parts = (Array.isArray(content) ? content : [content]).filter(Boolean)
      .map((part) => (typeof part === 'string' ? paragraph(part) : part));
    if (!parts.length) parts.push(ui.missing('the answer'));
    if (item.action) {
      parts.push(el('button', {
        type: 'button',
        class: 'btn primary',
        onclick: () => {
          this.page?.close();
          this.window?.close();
          item.action.run();
        },
      }, item.action.label));
    }
    return el('div', { class: className }, ...parts);
  }
}

// A paragraph, with {contact} turned into the email link.
function paragraph(text) {
  const [before, after] = text.split('{contact}');
  if (after === undefined) return el('p', {}, text);
  return el('p', {}, before, el('a', { href: `mailto:${CONTACT}` }, CONTACT), after);
}
