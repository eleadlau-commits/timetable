// Timetable: loads the timetable from the university's calendar link (.ics), saves it on the
// phone so it works offline, and keeps it up to date. Shows the setup screen until there is one.
//
// Service 'timetable' (this object):
//   events          every session: { key, title, location, description, start, end, allDay, cancelled }
//   name            the calendar's own name, if it has one
//   hasData, url, updatedAt, source ('link' or 'file')
//   load(link)      downloads and saves a timetable (throws an error that explain() describes)
//   reload({ silent })    downloads it again from the saved link
//   importFile()    lets the person choose an .ics file
//   prefill(link)   opens the setup screen with a link filled in
//   typedLink       whatever is typed in the setup screen's link box
//   clear()         removes the timetable from the device
//   explain(error)  a plain-English explanation of a loading error
//   normaliseLink(text)   the first web link in some text, with webcal:// turned into https://
//
// Events it sends:
//   'timetable:changed'   new data was loaded, or the timetable was removed
//   'timetable:loaded'    the person loaded or imported a timetable themselves
//   'timetable:cleared'   the person removed the timetable; features should forget its data

import { Feature, ui, time } from 'folio';
import { parseICS, expandEvents } from './ics.js';

const { el } = ui;
const STALE_MS = 30 * time.MINUTE;

class LoadError extends Error {
  constructor(code, extra = {}) {
    super(code);
    this.code = code;
    Object.assign(this, extra);
  }
}

async function getText(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new LoadError('http', { status: res.status });
  return res.text();
}

export default class Timetable extends Feature {
  start() {
    this.events = [];
    this.name = '';
    this.busy = false;
    this.lastRefreshFailed = false;
    this.showingSetup = false;

    this.defineSlot('timetable.fetch',
      'Other ways to download the timetable when the direct link is blocked. Item: { order, fetch(link) → Promise of the text, or null if not set up }.');
    this.defineSlot('timetable.explain',
      'Better explanations for loading errors. Item: { explain(error) → text or undefined }.');
    this.defineSlot('timetable.setup',
      'Blocks under "Other ways to get the link in" on the setup screen. Item: { order, render() → element }.');
    this.defineSlot('timetable.settings',
      'Extra buttons next to "Save and refresh" in Settings. Item: { order, render({ link() }) → element }.');
    this.provide('timetable', this);

    this.importOldData();
    const saved = this.storage.get('ics');
    if (saved) {
      try {
        this.apply(saved);
      } catch {
        this.storage.remove('ics');
      }
    }
    this.files = ui.filePicker('.ics,text/calendar');
    this.buildSetup();

    this.add('timetable.setup', { order: 30, render: () => el('div', {},
      el('b', {}, 'Copied it on a computer?'),
      ' Email or message the link to yourself, open it on your phone, then press and hold the link and choose ',
      el('i', {}, 'Copy'), '.') });
    this.add('timetable.setup', { order: 40, render: () => el('div', {},
      el('b', {}, 'Got a file instead of a link?'), ' If the export downloaded an ', el('code', {}, '.ics'),
      ' file, import it here. A file won\'t update by itself, so re-import it when your timetable changes.',
      el('button', { type: 'button', class: 'btn block', onclick: () => this.importFile() }, 'Import .ics file')) });

    this.add('header.buttons', {
      id: 'refresh', label: 'Refresh timetable', icon: 'refresh', order: 10,
      visible: () => this.hasData && !!this.url && !this.showingSetup,
      busy: () => this.busy,
      onClick: () => this.reload(),
    });
    this.add('header.status', { order: 10, text: () => this.statusText() });
    this.add('settings', { id: 'timetable', title: 'Timetable', order: 10, render: () => this.settingsSection() });

    this.on('app:ready', () => {
      this.updateScreen();
      if (this.hasData && !this.showingSetup && this.isStale()) this.reload({ silent: true });
    });
    const reloadIfStale = () => {
      if (this.hasData && this.isStale()) this.reload({ silent: true });
    };
    this.on('app:resume', reloadIfStale);
    this.on('app:online', reloadIfStale);
  }

  // ---- State ----

  get hasData() { return this.storage.has('ics'); }
  get url() { return this.storage.get('url'); }
  get updatedAt() { return this.storage.get('updated', 0); }
  get source() { return this.storage.get('source'); }

  isStale() {
    return Date.now() - this.updatedAt > STALE_MS;
  }

  statusText() {
    if (!this.hasData || !this.updatedAt) return '';
    const when = `${this.source === 'file' ? 'Imported' : 'Updated'} ${time.ago(this.updatedAt)}`;
    return this.lastRefreshFailed && navigator.onLine ? `${when} · couldn't refresh` : when;
  }

  // Before this app used Folio, it kept its data under keys starting with "tt.". Bring it across once.
  importOldData() {
    this.storage.once('import-from-v1', () => {
      const old = this.app.storage;
      const ics = old.raw('tt.ics');
      if (ics == null) return;
      if (!this.storage.set('ics', ics)) {
        old.removeRaw('tt.ics'); // make room, then try again
        if (!this.storage.set('ics', ics)) return;
      }
      this.storage.set('url', old.raw('tt.url'));
      this.storage.set('updated', +old.raw('tt.updated') || Date.now());
      this.storage.set('source', old.raw('tt.source') || (old.raw('tt.url') ? 'link' : 'file'));
      old.removeRaw('tt.ics'); // the biggest item, now saved under its new name
      // Open on the view the person had open (the view ids are the same as in version 1).
      const folio = old.area('folio');
      if (old.raw('tt.view') && !folio.has('view')) folio.set('view', old.raw('tt.view'));
    });
  }

  // ---- Loading ----

  apply(text) {
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new LoadError('not-calendar');
    const calendar = parseICS(text);
    const now = new Date();
    this.events = expandEvents(calendar.events, time.addDays(now, -200), time.addDays(now, 400));
    this.name = calendar.name || '';
  }

  save(text, link) {
    this.apply(text); // throws before anything is saved if the text isn't a calendar
    if (!this.storage.set('ics', text)) this.toast("Loaded, but couldn't save it for offline use on this device.");
    this.storage.set('updated', Date.now());
    this.storage.set('url', link);
    this.storage.set('source', link ? 'link' : 'file');
    this.lastRefreshFailed = false;
    this.emit('timetable:changed');
  }

  normaliseLink(raw) {
    const m = (raw || '').trim().match(/(?:webcals?|https?):\/\/[^\s"'<>]+/i);
    if (!m) return null;
    try {
      return new URL(m[0].replace(/^webcals?:\/\//i, 'https://')).href;
    } catch {
      return null;
    }
  }

  async download(link) {
    try {
      return await getText(link);
    } catch (err) {
      // An HTTP error came from the university itself; another route won't change that.
      if (err.status) throw err;
      for (const route of this.slot('timetable.fetch').items) {
        const text = await route.fetch(link);
        if (text != null) return text;
      }
      throw err;
    }
  }

  setBusy(on) {
    this.busy = on;
    this.loadButton.disabled = on;
    this.loadButton.textContent = on ? 'Loading…' : 'Load timetable';
    if (this.saveButton) this.saveButton.disabled = on;
    this.refresh();
  }

  async load(raw) {
    const link = this.normaliseLink(raw);
    if (!link) throw new LoadError('bad-link');
    if (this.busy) return;
    this.setBusy(true);
    try {
      this.save(await this.download(link), link);
    } finally {
      this.setBusy(false);
    }
    this.showingSetup = false;
    this.received.hidden = true;
    this.updateScreen();
    this.emit('timetable:loaded');
    const upcoming = this.events.filter((e) => e.start > new Date() && !e.cancelled).length;
    this.toast(upcoming ? `Timetable loaded with ${upcoming} upcoming sessions` : 'Loaded, but the timetable has no upcoming sessions yet');
  }

  async reload({ silent = false } = {}) {
    const link = this.url;
    if (!link || this.busy) return;
    if (!navigator.onLine) {
      if (!silent) this.toast("You're offline, so this is your saved timetable.");
      this.refresh();
      return;
    }
    this.setBusy(true);
    try {
      this.save(await this.download(link), link);
      if (!silent) this.toast('Timetable updated');
    } catch (err) {
      this.lastRefreshFailed = true;
      if (!silent) this.toast(this.explain(err));
    } finally {
      this.setBusy(false);
    }
  }

  async importFile() {
    const file = await this.files.pick();
    if (!file) return;
    try {
      this.save(await file.text(), null);
    } catch (err) {
      this.toast(err.code === 'not-calendar' ? "That file isn't a calendar (.ics) file." : "Couldn't read that file.");
      return;
    }
    this.showingSetup = false;
    this.app.shell.closeSettings();
    this.updateScreen();
    this.emit('timetable:loaded');
    this.toast('Timetable imported');
  }

  clear() {
    for (const key of ['ics', 'url', 'updated', 'source']) this.storage.remove(key);
    this.events = [];
    this.name = '';
    this.linkInput.value = '';
    this.emit('timetable:cleared');
    this.emit('timetable:changed');
    this.updateScreen();
  }

  explain(err) {
    if (err.code === 'bad-link') return "That doesn't look like a link. It should start with webcal://, https:// or http://.";
    if (err.code === 'not-calendar') {
      return 'That link opened a web page, not a calendar. Check that you copied the export or subscribe link (it often ends in .ics or starts with webcal://), not the address of the timetable page.';
    }
    if (err.status === 401 || err.status === 403) {
      return `The university's server refused the link (error ${err.status}). It may have expired or been reset. Create a new export link and paste it again.`;
    }
    if (err.status === 404 || err.status === 410) {
      return `The link wasn't found (error ${err.status}). It may have been revoked. Create a new export link.`;
    }
    if (err.status) return `The university's server returned error ${err.status}. Try again in a few minutes.`;
    if (!navigator.onLine) return "You're offline. Connect to the internet and try again.";
    const better = this.slot('timetable.explain').first((item) => item.explain(err));
    if (better) return better;
    if (this.native) return "Couldn't reach your university's timetable server. Check the link and your internet connection, then try again.";
    return "Your university's server stopped this app from reading the link directly (a browser security rule). Import the .ics file instead, under Other ways to get the link in.";
  }

  // ---- Setup screen ----

  buildSetup() {
    const page = this.template('setup');
    const part = (name) => page.querySelector(`[data-part="${name}"]`);
    this.setupNode = page.querySelector('.setup');
    this.linkInput = part('link');
    this.received = part('received');
    this.loadButton = part('load');
    this.extras = part('extras');
    this.backButton = part('back');
    const error = part('error');
    const showError = (message) => { error.textContent = message || ''; error.hidden = !message; };

    const paste = part('paste');
    if (!navigator.clipboard?.readText) paste.hidden = true;
    paste.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return this.toast('Your clipboard is empty.');
        this.linkInput.value = text.trim();
        showError(null);
      } catch {
        this.toast('Press and hold the box, then choose Paste.');
        this.linkInput.focus();
      }
    });
    const load = async () => {
      showError(null);
      try {
        await this.load(this.linkInput.value);
      } catch (err) {
        showError(this.explain(err));
      }
    };
    this.loadButton.addEventListener('click', load);
    this.linkInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
    this.backButton.addEventListener('click', () => {
      this.showingSetup = false;
      this.updateScreen();
    });
  }

  // Whatever is typed in the setup screen's link box.
  get typedLink() {
    return this.linkInput.value;
  }

  // Opens the setup screen with a link filled in, e.g. one that arrived from another device.
  prefill(link) {
    this.linkInput.value = link;
    this.received.hidden = false;
    this.showingSetup = true;
    this.updateScreen();
  }

  updateScreen() {
    const shell = this.app.shell;
    if (!this.hasData || this.showingSetup) {
      this.backButton.hidden = !this.hasData;
      this.extras.replaceChildren(...this.slot('timetable.setup').map((item) => item.render()));
      shell.setTitle(null);
      shell.showScreen(this.id, this.setupNode);
    } else {
      shell.setTitle(this.name);
      shell.hideScreen(this.id);
    }
    this.refresh();
  }

  // ---- Settings ----

  settingsSection() {
    const input = el('input', {
      id: 'timetable-settings-link', type: 'url', inputmode: 'url', autocomplete: 'off', autocapitalize: 'off',
      autocorrect: 'off', spellcheck: 'false', placeholder: 'webcal://… or https://…',
    });
    input.value = this.url || '';
    const error = ui.errorBox();
    this.saveButton = el('button', {
      type: 'button',
      class: 'btn primary',
      disabled: this.busy,
      onclick: async () => {
        error.show(null);
        try {
          await this.load(input.value);
          this.app.shell.closeSettings();
        } catch (err) {
          error.show(this.explain(err));
        }
      },
    }, 'Save and refresh');
    const context = { link: () => input.value || this.url };
    return el('div', { class: 'stack' },
      el('label', { class: 'label', for: 'timetable-settings-link' }, 'Timetable link'),
      input,
      error,
      el('div', { class: 'row' }, this.saveButton, this.slot('timetable.settings').map((item) => item.render(context))),
      el('button', { type: 'button', class: 'btn', onclick: () => this.importFile() }, 'Import .ics file'),
      this.hasData && el('button', {
        type: 'button',
        class: 'btn danger',
        onclick: () => {
          if (!confirm('Remove your timetable and link from this device? Notes, reminders and other settings for it are removed too. Things that aren\'t part of the timetable, such as a saved campus card, stay.')) return;
          this.app.shell.closeSettings();
          this.clear();
        },
      }, 'Remove timetable from this device'));
  }
}
