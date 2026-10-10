# Folio

**Apps made of feature folders.** Each feature of an app lives in its own folder. A compiler reads the folders and assembles the app, a bit like LaTeX assembles a document. Delete a folder and the app still works, just without that feature.

Folio is for small personal and group apps: schedules, trackers, lists, notes, forms. The same files run as a web app, an Android app and (later) an iPhone app.

## Contents

1. [The big picture](#1-the-big-picture)
2. [A feature folder](#2-a-feature-folder)
3. [feature.json reference](#3-featurejson-reference)
4. [Writing a feature](#4-writing-a-feature)
5. [The framework's slots and events](#5-the-frameworks-slots-and-events)
6. [Helpers: ui and time](#6-helpers-ui-and-time)
7. [Saving data](#7-saving-data)
8. [The compiler](#8-the-compiler)
9. [Tests](#9-tests)
10. [The rules](#10-the-rules)
11. [Starting a new app](#11-starting-a-new-app)

---

## 1. The big picture

```
build.py                 run this: python build.py
folio/                   the framework (knows nothing about any particular app)
  runtime/               the code that runs inside every app
  compiler/folioc.py     the compiler
  templates/feature/     what `new-feature` copies
  tests/                 the framework's own tests
app/
  app.json               the app's name, version, colours and phone app id
  icons/                 the app's icons
  features/              one folder per feature
  tests/seed.js          sample data used by the automatic tests
dist/                    the compiled app (made by the compiler, never edited)
```

Features connect to each other in three ways, so they never need to touch each other's code:

| Way | What it is | Example |
|---|---|---|
| **Slots** | Named places where features add things. The feature that owns the place decides what an item looks like. | Notes adds a section to `session.details` |
| **Services** | An object one feature offers to others. Others get it with `this.use(name)`, which returns `null` if that feature isn't there. | Maps uses the `places` service from Durham rooms |
| **Events** | Named messages. Any feature can send one, and any can listen. | Timetable sends `timetable:cleared`, and Notes listens and forgets its notes |

**What keeps it safe to delete a folder:**
- **At compile time:** a feature whose `requires` are missing is left out, with the reason in the log.
- **When the app starts:** if a feature's code fails, it's switched off and everything it added is removed. The rest of the app carries on.
- **While it runs:** if a slot item or event listener throws, it's reported and skipped.
- **In your code:** `this.use()` returns `null` for missing services, and features handle that.
- **In the tests:** `python build.py test` checks all of the above automatically, by removing each feature in turn.

## 2. A feature folder

```
app/features/notes/
  feature.json      the instructions: name, what it needs, its files
  Notes.js          the feature: a class that extends Feature
  notes.css         its styles (optional)
  templates.html    larger pieces of fixed HTML, as <template id="…"> (optional)
  README.md         what it does, in plain English
  tests/            *.test.js files (not shipped in the app)
  extras/           anything else that isn't part of the app, e.g. a server script (not shipped)
```

Make a new one with `python build.py new-feature study-timer --requires sessions`.

## 3. feature.json reference

```json
{
  "name": "Notes",
  "description": "Your own notes on any session.",
  "version": "1.0.0",
  "main": "Notes.js",
  "styles": ["notes.css"],
  "templates": "templates.html",
  "requires": ["sessions"],
  "uses": ["durham-rooms"],
  "platforms": ["web", "android", "ios"],
  "enabled": true,
  "web": { "manifest": { } },
  "native": {
    "packages": { "@capacitor/local-notifications": "^7.0.0" },
    "capacitor": { "plugins": { } },
    "android": { "permissions": ["CAMERA"], "features": [{ "name": "android.hardware.camera", "required": false }] },
    "ios": { "plist": { "NSCameraUsageDescription": "Why the camera is needed." } }
  }
}
```

| Setting | Needed? | Meaning |
|---|---|---|
| `name`, `description` | yes | Shown in Settings → Features and in the build report. |
| `main` | yes | The file whose default export is the feature class. |
| `version` | no | The feature's own version, for the report. Default `1.0.0`. |
| `styles` | no | CSS files, added to the app's stylesheet in start order. |
| `templates` | no | An HTML file of `<template id="name">` blocks. Get a copy with `this.template('name')`. |
| `requires` | no | Features this one can't work without. It starts after them, and is left out without them. |
| `uses` | no | Features this one works better with. It starts after them if they're there, and works without them. |
| `platforms` | no | Where it runs: `web`, `android`, `ios`. Default: everywhere. |
| `enabled` | no | `false` switches the feature off without deleting it. |
| `web.manifest` | no | Merged into the web app manifest, e.g. a `share_target`. |
| `native` | no | What the phone apps need: npm `packages`, Capacitor config to merge, Android permissions and features, iPhone Info.plist entries. |

The folder name is the feature's id: lowercase words joined by dashes.

## 4. Writing a feature

```js
import { Feature, ui, time } from 'folio';

const { el } = ui;

export default class Notes extends Feature {
  start() {
    this.sessions = this.use('sessions');          // another feature's service
    this.notes = this.storage.get('notes', {});      // this feature's saved data

    this.add('session.details', {                    // add to a slot
      order: 30,
      render: (session) => el('p', {}, this.notes[session.key] || 'No note'),
    });
    this.on('timetable:cleared', () => this.storage.clear());   // listen to an event
  }
}
```

**Everything a feature can do through `this`:**

| Member | What it does |
|---|---|
| `start()` | Override it. Runs once, after everything in `requires` has started. May be `async`. |
| `add(slot, item)` | Adds an item to a slot. Returns a function that removes it. |
| `defineSlot(name, description)` | Creates a slot for other features. Describe what an item looks like. |
| `slot(name)` | A slot, to read its items: `.items`, `.map(fn)`, `.first(fn)`, `.some(fn)`, `.each(fn)`, `.run(item, fn)`. All of these contain errors. |
| `provide(name, object)` | Offers a service. Often the feature itself: `this.provide('sessions', this)`. |
| `use(name)` | Another feature's service, or `null`. Always handle `null`. |
| `on(event, fn)`, `emit(event, data)` | Listen to and send events. |
| `storage` | This feature's saved data (see [7](#7-saving-data)). |
| `refresh()` | Redraws the top bar and the current view. |
| `template(name)` | A copy of a template from templates.html. |
| `toast(message)` | A short message at the bottom of the screen. |
| `native` | `true` in the Android or iPhone app. |
| `plugin(name)` | A Capacitor plugin (e.g. `'LocalNotifications'`), or `null` on the web. |
| `app.shell` | The app's frame: `setTitle(text)`, `showScreen(owner, node)`, `hideScreen(owner)`, `selectView(id)`, `openSettings()`, `closeSettings()`, `refreshSettings()`. |

**Defining your own slots.** If your feature shows something other features might want to add to, define a slot and describe the item shape in one sentence. Then draw its items, for example `this.slot('session.card').map((line) => line.render(session))`. Items from features that aren't installed simply aren't there.

## 5. The framework's slots and events

**Slots:**

| Slot | Item | Where it appears |
|---|---|---|
| `views` | `{ id, label, order, mount(container), render(), step?(direction), visible?() }` | Tabs at the top. `mount` runs once and `render` on every redraw. `step(±1)` is called on swipes and arrow keys. |
| `header.buttons` | `{ id, label, icon, order, onClick(), visible?(), busy?() }` | Round buttons in the top bar. `icon` is a name from `ui.ICONS` or SVG drawing. `busy()` makes it spin. |
| `header.status` | `{ order, text() }` | The small grey line under the app's name. "offline" is added automatically. |
| `settings` | `{ id, title?, order, render() }` | A section in the Settings window. Return `null` or `false` to show nothing. |

The framework's own Settings sections, **Features** (switch features on and off for this phone) and **About** (version and problems), always come last.

**Events:**

| Event | When |
|---|---|
| `app:ready` | Every feature has started. |
| `app:resume` | The app came back to the screen. |
| `app:tick` | Once a minute while the app is on screen. |
| `app:online` / `app:offline` | The connection came back or dropped. |

**Order:** `order` numbers sort items from low to high, and the default is 50. Leave gaps (10, 20, 30) so new features can slot in between.

## 6. Helpers: ui and time

`ui`: `el(tag, attrs, ...children)`, `icon(name)`, `ICONS`, `toast(text)`, `dialog({ title, className, onClose })` → `{ open, close, setContent, setTitle, isOpen, element, content }`, `errorBox()` → element with `.show(text)`, `hint(text, { small })`, `select(options, { value, id, onChange })`, `toggle({ checked, label, onChange })`, `filePicker(accept)` → `{ pick() }`, `onSwipe(element, fn)`, `loadScript(url)`.

`time`: `MINUTE`, `HOUR`, `DAY`, `startOfDay`, `addDays`, `startOfWeek`, `sameDay`, `formatTime`, `formatDate`, `formatLongDate`, `formatDateTime`, `dayLabel`, `ago`, `inTime`, `toLocalInput`.

Shared CSS classes from `runtime/base.css`: `btn` (`primary`, `danger`, `block`, `small`), `icon-btn` (`ghost`), `link-btn`, `panel`, `hint` (`small`), `label`, `field`, `row`, `stack`, `group`, `error`, `empty`, `list`, `advanced` (for `<details>`), `check`, `switch`, `sub-head`. Colours are CSS variables: `--bg`, `--surface`, `--surface-2`, `--text`, `--muted`, `--line`, `--accent`, `--accent-soft`, `--danger`, `--radius`, `--shadow`. Light and dark mode are automatic.

## 7. Saving data

`this.storage` is the feature's private area in the device's storage. Values can be anything JSON can hold.

```js
this.storage.get('notes', {});         // value, or the fallback if nothing is saved
this.storage.set('notes', notes);      // false if the device refused (storage full)
this.storage.remove('notes');
this.storage.clear();                  // everything this feature saved
this.storage.once('import-v1', fn);    // runs fn only the first time, on each device
```

- **Never rename a key** that a released version has used, or people lose that data. Add a new key instead, and use `once()` to move old data across.
- **Data saved outside Folio** (by an older version of the app) can be read with `this.app.storage.raw(key)` or `rawJSON(key)`.
- **Only this phone can see the data.** Nothing is sent anywhere unless a feature does so on purpose.

## 8. The compiler

| Command | What it does |
|---|---|
| `python build.py` | Compiles `app/` into `dist/`. Prints a log, writes `dist/report.html`. |
| `python build.py check` | Checks every feature for mistakes, without compiling. |
| `python build.py list` | Lists features, what they need, and their start order. |
| `python build.py new-feature ID` | Creates a feature folder from the template. Options: `--name`, `--description`, `--requires a,b`. |
| `python build.py serve` | Compiles, then runs the app at http://localhost:8000. Add `--test` for sample data and the tests page (`/tests.html`). |
| `python build.py test` | Runs every test, including the delete-a-folder test (see [9](#9-tests)). `--quick` skips that one. |
| `python build.py --without notes,maps` | Compiles without some features, to see what happens. |

The compiler only needs Python 3.9 or newer. The browser tests also need Chrome or Edge.

**What it does:**
1. **Reads** `app.json` and every `features/*/feature.json`, checking each for mistakes.
2. **Checks imports:** a feature may only import `'folio'` and its own files. Anything else is a mistake.
3. **Leaves features out** when they're switched off, have a mistake, or are missing something they `require`, and keeps doing so until nothing else changes.
4. **Orders features** so each starts after what it requires and uses. Features that require each other in a circle are left out.
5. **Writes `dist/web/`:**
   - `index.html` with the templates
   - `app.css` (base styles, theme, then each feature's styles)
   - `start.js` (the list of features)
   - the framework and feature code
   - the web manifest, icons, and `sw.js`, the offline support, which is versioned automatically
6. **Writes what the phone apps need:**
   - `dist/package.json` (Capacitor and the packages features asked for)
   - `dist/capacitor.config.json` (merged from every feature)
   - `dist/native.json` (Android permissions and iPhone settings)
   - `dist/assets/icon-only.png`
7. **Writes `dist/report.html`:** the features, their slots, services and events, and the log.

## 9. Tests

`python build.py test` runs four kinds of test:

1. **Compiler tests** (`folio/tests/test_*.py`): finding, checking, ordering and compiling features.
2. **Feature and framework tests:** every `tests/*.test.js` file, run in a hidden browser.
   ```js
   import { test, assert } from 'folio/testing';
   import { moduleKey } from '../format.js';

   test('module codes group sessions', () => {
     assert.equal(moduleKey('ECON1011 Lecture'), 'ECON1011');
   });
   ```
   `assert` has `ok`, `equal`, `deepEqual`, `match`, `throws`. Put rules that don't need the screen in their own small file, so they're easy to test.
3. **Whole-app test:** the app is started with the sample data from `app/tests/seed.js`. The test opens every view and the first item in it, then Settings, then each top-bar button. Any problem fails the test.
4. **Delete-a-folder test:** the same check again, once without each feature, and once with no features at all.

On GitHub, these run before every release. If anything fails, nothing is released.

## 10. The rules

1. **One feature, one folder.** Everything a feature needs is inside it, including its phone permissions in `feature.json`.
2. **Import only `'folio'` and your own files.** To use another feature, use its service, slot or events.
3. **Handle missing features.** `this.use()` can return `null`, and a slot can be empty. The app must still work.
4. **Requires vs uses.** List what you can't work without in `requires` and what you work better with in `uses`.
5. **Build screens with `ui.el()` or templates, never `innerHTML` with outside text.** Text from calendars, files or websites can contain code.
6. **Keep saved data in `this.storage`, and never rename a released key.**
7. **Describe it.** Every feature has a `README.md`, and every slot you define has a one-line description of its items.
8. **Test it.** Rules go in small files with tests. Run `python build.py test` before releasing.
9. **Don't edit `dist/`.** It's rebuilt every time.
10. **Change `folio/` only for something every app needs.** A new slot or helper there benefits every feature. If it's only for one app, it belongs in a feature.

## 11. Starting a new app

1. Copy `build.py`, `folio/` and `.github/` into a new folder.
2. Create `app/app.json`:
   ```json
   { "id": "study-planner", "name": "Study planner", "description": "…", "version": "1.0.0",
     "theme": { "accent": "#00897b", "accentDark": "#4db6ac" },
     "native": { "appId": "io.github.studyplanner.app" } }
   ```
3. Add icons to `app/icons/`: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, and `icon-only.png` (1024×1024, for the phone app).
4. Create features with `python build.py new-feature …`. Features that aren't tied to one app can be copied between apps, such as campus-card.
5. Optionally, add `app/tests/seed.js` with sample data for the tests.

Folio's version is in `folio/VERSION`. When the framework changes in a way features notice, the version goes up and the change is described here.
