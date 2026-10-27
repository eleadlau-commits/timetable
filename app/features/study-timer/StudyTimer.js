// Study timer: a card on the Study tab (time studied today, progress towards the weekly goal,
// a Start button, and while running the time left and whether it's study or rest). Tapping it
// opens a full-screen pop-up:
//   - a pattern of study and rest blocks to build (presets, saved patterns, Repeat ×N), and a
//     module from the timetable to study for
//   - the running timer: a big countdown, the strip with a marker, Pause, Skip and Stop
//   - this week: hours per day split by module, the total against the goal, the difference
//     from last week, the number of sessions and the time per module
// The timer is worked out from the clock (the start time and each pause, resume and skip), so
// it keeps the right time when the phone is locked or the app is closed. The phone apps
// schedule a notification for each change of block; the web version can only tell you while
// it's open. The rules are in rules.js, with tests; the strip is in strip.js.
//
// Saved data (on this phone only, nothing online):
//   'draft'    → { blocks: [{ kind: 'study' | 'rest', min }], repeat, from } the pattern being built
//                (from: the id of the pattern it started as)
//   'patterns' → [{ id, name, blocks, repeat }] patterns saved with a name (the presets aren't saved)
//   'module'   → the module code chosen for the next session, or null
//   'run'      → { pattern, module, startedAt, events: [{ type: 'pause' | 'resume' | 'skip', at }] }
//                the running timer, or null
//   'history'  → [{ start, end, module, session }] finished study time (ms since 1970; session is
//                the start time of the run it came from)
//   'goal'     → hours a week to aim for (0 = no goal)

import { Feature, ui } from 'folio';
import {
  PRESETS, MINUTE, clampMinutes, totalMinutes, studyMinutes, newRun, position, upcomingChanges, historyEntries,
  studiedToday, weekStats, formatMinutes, formatStudied, formatClock, differenceText,
} from './rules.js';
import { editStrip, runStrip } from './strip.js';

const { el } = ui;
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FIRST_ID = 7100; // notification ids 7100–7199 are this feature's
const MAX_NOTES = 60;

const copy = (p) => ({ blocks: p.blocks.map((b) => ({ ...b })), repeat: p.repeat || 1, from: p.id || null });

export default class StudyTimer extends Feature {
  start() {
    this.sessions = this.use('sessions');
    this.notifier = this.plugin('LocalNotifications'); // only in the phone apps
    this.draft = this.storage.get('draft', null) || copy(PRESETS[1]);
    this.patterns = this.storage.get('patterns', []);
    this.module = this.storage.get('module', null);
    this.run = this.storage.get('run', null);
    this.history = this.storage.get('history', []);
    this.goal = this.storage.get('goal', 0);
    this.lastIndex = this.run ? position(this.run, Date.now()).index : -1;
    this.naming = false;
    this.card = null;
    this.live = null;
    this.timer = 0;
    this.channelMade = false;

    this.add('study.cards', { order: 20, render: () => this.drawCard() });
    this.add('settings', { id: 'study-timer', title: 'Study timer', order: 72, render: () => this.goalField() });
    this.on('app:resume', () => this.tick());
    this.on('app:ready', () => this.tick());
    this.on('timetable:cleared', () => { if (this.module) this.setModule(null); });
    this.ticking();
  }

  // ---- The timer ----

  ticking() {
    clearInterval(this.timer);
    if (this.run) this.timer = setInterval(() => this.tick(), 1000);
  }

  begin() {
    if (!studyMinutes(this.draft)) {
      ui.toast('Add a study block first.');
      return;
    }
    const now = Date.now();
    this.run = newRun(this.draft, this.module, now);
    this.lastIndex = 0;
    this.saveRun();
    this.ticking();
    this.refresh();
    this.openWindow();
  }

  act(type) {
    if (!this.run) return;
    const now = Date.now();
    this.run.events.push({ type, at: now });
    this.lastIndex = position(this.run, now).index; // no "time for a break" message for a block you skipped to
    this.saveRun();
    this.refresh();
    this.drawWindow();
  }

  stop() {
    if (!this.run) return;
    this.finish(Date.now(), false);
  }

  // Saves the study time done, and clears the timer.
  finish(now, completed) {
    const p = position(this.run, now);
    this.history.push(...historyEntries(this.run, now));
    this.storage.set('history', this.history);
    this.run = null;
    this.lastIndex = -1;
    this.saveRun();
    this.ticking();
    const studied = p.stretches.reduce((n, s) => n + s.end - s.start, 0);
    ui.toast(completed ? `Session done: ${formatStudied(studied)} of study saved.` : `Stopped. ${formatStudied(studied)} of study saved.`);
    this.refresh();
    if (this.window?.isOpen) this.drawWindow();
  }

  saveRun() {
    this.storage.set('run', this.run);
    this.schedule();
  }

  // Every second while a timer runs: move on to the next block, finish when it's done, and
  // update the card and the pop-up.
  tick() {
    if (!this.run) return;
    const now = Date.now();
    const p = position(this.run, now);
    if (p.done) {
      if (!this.notifier && now - p.endedAt < 2 * MINUTE) this.alert('Session done');
      this.finish(p.endedAt ?? now, true);
      return;
    }
    if (p.index !== this.lastIndex) {
      if (!this.notifier && this.lastIndex >= 0) this.alert(p.block.kind === 'rest' ? 'Time for a break' : 'Back to studying');
      this.lastIndex = p.index;
      if (this.window?.isOpen) this.drawWindow();
    }
    this.updateLive(p);
  }

  // Web version: a message and a buzz while the app is open.
  alert(text) {
    ui.toast(text);
    try { navigator.vibrate?.([300, 150, 300]); } catch { /* not every browser can */ }
  }

  // ---- Phone apps: a notification for each change of block ----

  schedule() {
    if (!this.notifier) return;
    this.scheduling = (this.scheduling || Promise.resolve()).then(() => this.scheduleNow());
  }

  async scheduleNow() {
    const n = this.notifier;
    try {
      const ids = [];
      for (let i = 0; i < MAX_NOTES; i += 1) ids.push({ id: FIRST_ID + i });
      await n.cancel({ notifications: ids });
      if (!this.run) return;
      let granted = (await n.checkPermissions()).display === 'granted';
      if (!granted) granted = (await n.requestPermissions()).display === 'granted';
      if (!granted) return;
      if (!this.channelMade) {
        await n.createChannel({ id: 'study-timer', name: 'Study timer', description: 'When to take a break and when to study again', importance: 4, visibility: 1, vibration: true }).catch(() => {});
        this.channelMade = true;
      }
      const list = upcomingChanges(this.run, Date.now()).slice(0, MAX_NOTES);
      if (!list.length) return;
      await n.schedule({
        notifications: list.map((c, i) => ({
          id: FIRST_ID + i,
          title: c.title,
          body: c.body,
          channelId: 'study-timer',
          schedule: { at: new Date(c.at), allowWhileIdle: true },
        })),
      });
    } catch { /* try again on the next change */ }
  }

  // ---- Modules from the timetable ----

  // [{ code, label, hue }] for each module with a module code, in code order.
  moduleList() {
    const s = this.sessions;
    if (!s) return [];
    const seen = new Map();
    for (const x of s.all || []) {
      const code = s.moduleOf(x);
      if (seen.has(code) || code === x.title.trim() || !s.isShown(x)) continue;
      seen.set(code, { code, label: s.shortName(x), hue: s.hue(x) });
    }
    return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  moduleInfo(code) {
    if (!code) return { label: 'No module', hue: null };
    const found = this.moduleList().find((m) => m.code === code);
    return found || { label: code, hue: this.sessions?.defaultHue?.(code) ?? null };
  }

  colourStyle(code) {
    const { hue } = this.moduleInfo(code);
    return hue == null ? '' : `--stt-c:hsl(${hue} 65% var(--stt-l))`;
  }

  setModule(code) {
    this.module = code || null;
    this.storage.set('module', this.module);
  }

  // ---- The card on the Study tab ----

  drawCard() {
    const now = Date.now();
    const p = this.run && position(this.run, now);
    const time = el('b', { class: 'stt-card-time' });
    const what = el('span', { class: 'stt-card-what' });
    const open = () => this.openWindow();
    const button = p
      ? el('button', { type: 'button', class: 'btn small', onclick: (e) => { e.stopPropagation(); open(); } }, 'Open')
      : el('button', { type: 'button', class: 'btn primary small', onclick: (e) => { e.stopPropagation(); this.begin(); } }, 'Start');
    const today = studiedToday(this.history, now) + (p ? this.liveStudy(p) : 0);
    const week = weekStats(this.history, now).total;
    const goal = this.goal * 60 * MINUTE;
    // Tapping anywhere on the card opens the timer. For keyboards and screen readers the title is
    // the button, because a card that is itself a button can't hold the Start/Open button.
    this.card = el('div', {
      class: `stt-card${p ? ' on' : ''}`,
      style: p ? this.colourStyle(this.run.module) : '',
      onclick: open,
    },
      el('div', { class: 'stt-card-line' },
        el('button', { type: 'button', class: 'stt-card-title', onclick: (e) => { e.stopPropagation(); open(); } }, 'Study timer'),
        p ? el('span', { class: `stt-tag ${p.block.kind}` }, p.paused ? 'Paused' : (p.block.kind === 'study' ? 'Study' : 'Rest')) : null,
        button),
      p
        ? el('div', { class: 'stt-card-run' }, time, what)
        : el('div', { class: 'stt-card-sub' }, `Today ${formatStudied(today)}`, goal ? ` · This week ${formatStudied(week)} of ${formatMinutes(this.goal * 60)}` : ''),
      goal && !p ? this.goalBar(week, goal) : null);
    this.cardParts = { time, what };
    if (p) this.updateCard(p);
    return this.card;
  }

  updateCard(p) {
    if (!this.card?.isConnected || !this.cardParts) return;
    this.cardParts.time.textContent = formatClock(p.left);
    const info = this.moduleInfo(this.run.module);
    this.cardParts.what.textContent = `left of this ${p.block.kind === 'study' ? 'study' : 'rest'} block${this.run.module ? ` · ${info.label}` : ''}`;
  }

  // Study time done so far in the running session (it's added to the history when it ends).
  liveStudy(p) {
    return p.stretches.reduce((n, s) => n + s.end - s.start, 0);
  }

  goalBar(done, goal) {
    const share = Math.min(1, done / goal);
    return el('span', { class: 'stt-goal-bar', role: 'img', 'aria-label': `${Math.round(share * 100)}% of this week's goal` },
      el('i', { style: `width:${(share * 100).toFixed(1)}%` }));
  }

  // ---- The pop-up ----

  openWindow() {
    if (!this.window) this.window = ui.dialog({ title: 'Study timer', className: 'stt-dialog', onClose: () => { this.naming = false; this.live = null; } });
    this.drawWindow();
    this.window.open();
  }

  drawWindow() {
    if (!this.window) return;
    this.live = null;
    this.window.setContent(this.run ? this.runningSection() : this.builderSection(), this.weekSection());
    if (this.run) this.tick();
  }

  // ---- 1. Building a pattern ----

  builderSection() {
    const d = this.draft;
    const all = [...PRESETS, ...this.patterns];
    const changeBlock = (i, min) => {
      d.blocks[i].min = min;
      this.saveDraft();
    };
    const strip = editStrip(d.blocks, { onChange: changeBlock, onTap: (i) => this.editBlock(i) });
    strip.setAttribute('style', this.colourStyle(this.module));
    const total = totalMinutes(d);
    const modules = this.moduleList();

    return el('section', { class: 'stt-builder' },
      el('div', { class: 'stt-chips', role: 'group', 'aria-label': 'Patterns', 'data-own-swipe': '' },
        all.map((p) => el('button', {
          type: 'button',
          class: 'stt-chip',
          'aria-pressed': String(d.from === p.id),
          onclick: () => {
            this.draft = copy(p);
            this.saveDraft();
          },
        }, p.name))),
      strip,
      el('div', { class: 'stt-tools' },
        el('button', { type: 'button', class: 'btn small', onclick: () => this.addBlock('study') }, '+ Study'),
        el('button', { type: 'button', class: 'btn small', onclick: () => this.addBlock('rest') }, '+ Rest'),
        el('span', { class: 'stt-repeat' },
          el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Repeat fewer times', disabled: d.repeat <= 1, onclick: () => this.setRepeat(d.repeat - 1) }, '−'),
          el('span', {}, `Repeat ×${d.repeat}`),
          el('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Repeat more times', disabled: d.repeat >= 12, onclick: () => this.setRepeat(d.repeat + 1) }, '+'))),
      el('p', { class: 'stt-total' },
        total ? `${formatMinutes(total)} in all · ${formatMinutes(studyMinutes(d))} studying` : 'Nothing in the pattern yet.'),
      ui.hint('Drag the end of a block to make it longer or shorter. Tap a block to type its length or delete it.', { small: true }),
      this.nameArea(),
      el('label', { class: 'label stt-label', for: 'stt-module' }, 'Module'),
      modules.length
        ? ui.select([['', 'No module'], ...modules.map((m) => [m.code, m.label === m.code ? m.code : `${m.label} (${m.code})`])], {
          id: 'stt-module',
          value: this.module || '',
          onChange: (code) => { this.setModule(code); this.drawWindow(); },
        })
        : ui.hint(this.sessions ? 'Add your timetable to choose a module.' : 'Modules come from your timetable.', { small: true }),
      el('button', { type: 'button', class: 'btn primary block stt-start', disabled: !studyMinutes(d), onclick: () => this.begin() }, 'Start'),
      ui.hint(this.notifier
        ? "You'll get a notification each time a block ends, even with the phone locked."
        : 'In the web version, the timer can only tell you a block has ended while the app is open. The phone app sends a notification.', { small: true }));
  }

  saveDraft() {
    this.storage.set('draft', this.draft);
    this.drawWindow();
  }

  addBlock(kind) {
    this.draft.blocks.push({ kind, min: kind === 'study' ? 25 : 5 });
    this.saveDraft();
  }

  setRepeat(n) {
    this.draft.repeat = Math.min(12, Math.max(1, n));
    this.saveDraft();
  }

  // A small box to type a block's exact length, or delete it.
  editBlock(i) {
    const b = this.draft.blocks[i];
    if (!b) return;
    const box = ui.dialog({ title: b.kind === 'study' ? 'Study block' : 'Rest block', size: 'box', onClose: () => box.element.remove() });
    const input = el('input', { type: 'text', inputmode: 'numeric', value: String(b.min), 'aria-label': 'Minutes', id: 'stt-minutes' });
    const error = ui.errorBox();
    const save = (e) => {
      e.preventDefault();
      const min = clampMinutes(input.value);
      if (!min) { error.show('Type a number of minutes, from 1 to 240.'); return; }
      b.min = min;
      box.close();
      this.saveDraft();
    };
    box.setContent(el('form', { class: 'stack', onsubmit: save },
      el('label', { class: 'label', for: 'stt-minutes' }, 'Minutes'),
      input,
      error,
      el('div', { class: 'stt-tools' },
        el('button', { type: 'submit', class: 'btn primary' }, 'Save'),
        el('button', {
          type: 'button',
          class: 'btn danger',
          onclick: () => {
            this.draft.blocks.splice(i, 1);
            box.close();
            this.saveDraft();
          },
        }, 'Delete block'))));
    box.open();
    input.select();
  }

  // Save the pattern with a name, or delete a saved one.
  nameArea() {
    const saved = this.patterns.find((p) => p.id === this.draft.from);
    if (this.naming) {
      const input = el('input', { type: 'text', 'aria-label': 'Pattern name', placeholder: 'e.g. Exam revision', maxlength: '40' });
      setTimeout(() => input.focus(), 0);
      return el('form', {
        class: 'stt-name-form',
        onsubmit: (e) => {
          e.preventDefault();
          const name = input.value.trim();
          if (!name) return;
          const pattern = { id: `p${Date.now()}`, name, blocks: this.draft.blocks.map((b) => ({ ...b })), repeat: this.draft.repeat };
          this.patterns.push(pattern);
          this.storage.set('patterns', this.patterns);
          this.draft.from = pattern.id;
          this.naming = false;
          this.saveDraft();
        },
      }, input,
      el('button', { type: 'submit', class: 'btn small primary' }, 'Save'),
      el('button', { type: 'button', class: 'link-btn', onclick: () => { this.naming = false; this.drawWindow(); } }, 'Cancel'));
    }
    return el('div', { class: 'stt-name-tools' },
      this.draft.blocks.length ? el('button', { type: 'button', class: 'link-btn', onclick: () => { this.naming = true; this.drawWindow(); } }, 'Save this pattern') : null,
      saved ? el('button', {
        type: 'button',
        class: 'link-btn stt-danger',
        onclick: () => {
          this.patterns = this.patterns.filter((p) => p.id !== saved.id);
          this.storage.set('patterns', this.patterns);
          this.draft.from = null;
          this.saveDraft();
          ui.toast(`Deleted the pattern ${saved.name}.`);
        },
      }, `Delete ${saved.name}`) : null);
  }

  // ---- 2. The running timer ----

  runningSection() {
    const p = position(this.run, Date.now());
    const strip = runStrip(p.blocks);
    strip.element.setAttribute('style', this.colourStyle(this.run.module));
    const clock = el('div', { class: 'stt-clock', role: 'timer', 'aria-live': 'off' });
    const kind = el('span', { class: 'stt-tag' });
    const step = el('span', { class: 'stt-step' });
    const info = this.moduleInfo(this.run.module);
    this.live = { clock, kind, step, strip };
    return el('section', { class: 'stt-running', style: this.colourStyle(this.run.module) },
      el('div', { class: 'stt-now' }, kind, step, this.run.module ? el('span', { class: 'stt-module' }, info.label) : null),
      clock,
      strip.element,
      el('div', { class: 'stt-controls' },
        p.paused
          ? el('button', { type: 'button', class: 'btn primary', onclick: () => this.act('resume') }, 'Resume')
          : el('button', { type: 'button', class: 'btn primary', onclick: () => this.act('pause') }, 'Pause'),
        el('button', { type: 'button', class: 'btn', onclick: () => this.act('skip') }, 'Skip'),
        el('button', { type: 'button', class: 'btn danger', onclick: () => this.stop() }, 'Stop')),
      ui.hint(this.notifier
        ? 'It keeps time with the phone locked or the app closed, and sends a notification when each block ends.'
        : 'It keeps time with the app closed. In the web version it can only tell you a block has ended while the app is open.', { small: true }));
  }

  updateLive(p) {
    this.updateCard(p);
    const live = this.live;
    if (!live || !this.window?.isOpen) return;
    live.clock.textContent = formatClock(p.left);
    live.kind.textContent = p.paused ? 'Paused' : (p.block.kind === 'study' ? 'Study' : 'Rest');
    live.kind.className = `stt-tag ${p.block.kind}`;
    live.step.textContent = `Block ${p.index + 1} of ${p.blocks.length}`;
    live.strip.update(p);
  }

  // ---- 3. This week ----

  weekSection() {
    const now = Date.now();
    const history = this.run ? [...this.history, ...historyEntries(this.run, now)] : this.history;
    const w = weekStats(history, now);
    const goal = this.goal * 60 * MINUTE;
    const top = Math.max(60 * MINUTE, ...w.days.map((d) => d.total));
    const todayIndex = w.days.findIndex((d, i) => now >= d.start && (i === 6 || now < w.days[i + 1].start));
    const bars = w.days.map((d, i) => el('div', { class: `stt-day${i === todayIndex ? ' today' : ''}` },
      el('span', { class: 'stt-day-hours' }, d.total ? `${(d.total / (60 * MINUTE)).toFixed(1)} h` : ''),
      el('div', { class: 'stt-day-bar', role: 'img', 'aria-label': `${formatStudied(d.total)}` },
        Object.entries(d.byModule).map(([code, ms]) => el('i', {
          style: `height:${((ms / top) * 100).toFixed(1)}%;${this.colourStyle(code)}`,
          class: code ? 'mod' : '',
        }))),
      el('span', { class: 'stt-day-name' }, DAYS[i])));

    return el('section', { class: 'stt-week' },
      el('h3', { class: 'stt-head' }, 'This week'),
      el('div', { class: 'stt-days' }, bars),
      el('div', { class: 'stt-sums' },
        el('p', {}, el('strong', {}, formatStudied(w.total)), goal ? ` of ${formatMinutes(this.goal * 60)}` : ' studied'),
        goal ? this.goalBar(w.total, goal) : null,
        el('p', { class: 'hint small' }, `${differenceText(w.total, w.lastWeek)} · ${w.sessions} session${w.sessions === 1 ? '' : 's'}`)),
      w.modules.length ? el('ul', { class: 'stt-mods' }, w.modules.map((m) => el('li', { style: this.colourStyle(m.module) },
        el('i', { class: m.module ? 'mod' : '' }),
        el('span', {}, this.moduleInfo(m.module).label),
        el('b', {}, formatStudied(m.ms))))) : null,
      this.goalField());
  }

  // The weekly goal, in hours (in the pop-up and in Settings).
  goalField() {
    const input = el('input', { type: 'text', inputmode: 'decimal', value: this.goal ? String(this.goal) : '', placeholder: 'No goal', 'aria-label': 'Hours a week' });
    return el('form', {
      class: 'stt-goal',
      onsubmit: (e) => {
        e.preventDefault();
        const hours = Number(input.value.replace(',', '.') || 0);
        if (!Number.isFinite(hours) || hours < 0 || hours > 100) { ui.toast('Type a number of hours, from 0 to 100.'); return; }
        this.goal = Math.round(hours * 2) / 2;
        this.storage.set('goal', this.goal);
        ui.toast(this.goal ? `Weekly goal: ${formatMinutes(this.goal * 60)}.` : 'No weekly goal.');
        this.refresh();
        if (this.window?.isOpen) this.drawWindow();
      },
    },
      el('label', { class: 'label' }, 'Weekly goal (hours)'),
      el('div', { class: 'field' }, input, el('button', { type: 'submit', class: 'btn small' }, 'Save')));
  }
}
