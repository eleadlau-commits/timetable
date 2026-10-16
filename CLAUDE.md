# Mobile Durham (built with Folio)

**Mobile Durham** (called *Timetable* until version 3.1) is an app for a Durham University student and a few friends. It reads the university's calendar export link (`.ics`) and shows Day, Week and Upcoming views, plus a to-do list, notes, module colours/names/hiding, maps of Durham rooms, how busy the library is, reminders and a campus card barcode.

It's built with **Folio**, a small framework in `folio/` where every feature is a folder in `app/features/` and a compiler (`python build.py`) assembles the app. **Read `folio/README.md` before changing anything.** It explains slots, services, events, feature.json, storage and the rules.

## Who you're working with

The owner isn't a developer. They describe what they want, and Claude builds it. So:
- **Explain in plain English** what changed and how to try it.
- **At the end, list exactly which files changed**, and how to get them onto GitHub. They use GitHub Desktop or upload through the GitHub website.
- **Keep their friends' data safe.** Never rename a saved key. Bring old data across with `this.storage.once(...)`.

## How to work on it

1. **New feature?** Run `python build.py new-feature <id> --requires sessions`, then fill it in. Don't grow an existing feature for something new.
2. **Stay in the feature's folder.** Change `folio/` only for something every app would need, such as a new framework slot or helper. If you do, update `folio/README.md` and bump `folio/VERSION`.
3. **Connect through slots, services and events, never by importing another feature's files.** The compiler rejects imports outside a feature's folder.
4. **Handle missing features.** `this.use()` can return null, and slots can be empty.
5. **Write tests** for rules in `tests/*.test.js`. Keep rules in small files without screen code so they're testable.
6. **Run `python build.py test`** and fix everything before handing over. It includes the delete-a-folder test.
7. **Check it in a browser** with `python build.py serve --test`, which uses the sample data in `app/tests/seed.js`.
8. **Update the docs:** the feature's `README.md`, the table below, and `README.md` for anything people see.

## Features

In start order. `python build.py list` shows the same, and `dist/report.html` maps every slot, service and event.

| Feature | What it does | Requires (uses) | Adds to | Offers |
|---|---|---|---|---|
| `campus-card` | Scan and show the campus card barcode | | home.side, more.items | |
| `timetable` | Loads and saves the timetable, setup screen, the Planner's refresh button | | status, planner.actions, settings, more.items | service `timetable`; slots `timetable.fetch/explain/setup/settings`; events `timetable:changed/loaded/cleared` |
| `sessions` | Session cards and the details window | timetable | | service `sessions`; slots `session.filter/name/colour/location/card/details`; event `sessions:changed` |
| `planner` | The Planner tab, holding Day, Week and Upcoming | | views | service `planner`; slots `planner.views`, `planner.actions` |
| `day-view` | Day view | sessions (planner) | planner.views | slot `day.cards` |
| `durham-rooms` | Durham room codes → buildings and map positions | | | service `places` |
| `friends` | The Friends button in the top bar; says "coming soon" for now | | header.actions | |
| `help` | Help and Feedback in the menu; both say "coming soon" for now | | menu | |
| `home` | The Home tab: date, clock, cards; the app opens on it | | views | slots `home.next/top/main/side` |
| `study` | The Study tab | | views | slot `study.cards` |
| `web-relay` | Relay for the web version when downloads are blocked (web only) | timetable | timetable.fetch/explain, settings | service `relay` |
| `library` | How busy Bill Bryson Library is, free seats per floor | (web-relay, home, study) | home.top, study.cards, settings | |
| `link-sharing` | QR code and Android share (web only) | timetable (web-relay) | timetable.setup/settings, more.items | |
| `maps` | Building names, map preview, directions | sessions (durham-rooms) | session.location/details, settings | |
| `modules` | Rename, recolour or hide modules | sessions | session.name/colour/filter/details, settings, more.items | |
| `more` | The More tab: everything else, in groups | | views | slot `more.items` |
| `notes` | Notes on sessions | sessions | session.card/details | |
| `reminders` | Class and personal reminders | sessions | menu, session.details, more.items | |
| `spots` | The Spots tab, empty for now ("Coming soon") | | views | |
| `todo` | To-do list pop-up with tags, due dates and "Due today"; Plan Today button on Home (with how many are due today), row on More | (home, more) | home.next, more.items | |
| `up-next` | "Next:" under the clock, date strip and the day's lectures on Home | sessions (timetable, home) | home.next, home.main | |
| `upcoming` | Next four weeks (view id `agenda`) | sessions (planner) | planner.views | |
| `week-view` | Week grid | sessions (day-view, planner) | planner.views | |

**The screen:** one top bar (menu on the left; features' buttons from `header.actions` such as Friends, then the account button, on the right), the open tab's title below it (on Home, the dark area continues behind the clock), and the tab bar along the bottom: Study · Planner · Home · Spots · More (tap, or swipe the bar). The menu slides in from the left: *Not signed in* and the status line at the top, then Account, Reminders, Settings, Help, About, Feedback (the framework's own rows mixed with features' `header.buttons` by `order`). The account button and the Account row say "coming soon" until a feature fills Folio's `account` slot. Colours, fonts and the "knife" corner shape are in `app/theme.css` (from `DESIGN.md`); new styles use the names from there (`--shape` for cards and pop-ups, `--shape-btn` for buttons and text boxes, `--shape-sm` for small tags) rather than colours or corners of their own. Day buttons in date strips and round things (tick circles, dots, switches) keep their own shape, and cards have no coloured edges. When a place has nothing to show, use `ui.missing('what is missing')`.

## Branches

Name each branch `claude/` plus a few words saying what the change is, e.g. `claude/library-card` or `claude/fix-week-view-swipe`. Don't use the session's random name (like `claude/beautiful-dirac-r9jeyv`). This is the owner's standing permission to push to such a branch instead. Never push straight to `main`.

## Releasing

- **On GitHub:** every push to `main` runs `.github/workflows/build.yml`. Tests run first, and if they fail nothing is released. Then the APK goes to Releases and the web version to GitHub Pages.
- **The Android project** is made fresh on every build, in `dist/`. Packages, permissions and Capacitor settings come from each feature's `feature.json` (`native`).
- **The signing key:** `signing/debug.keystore` is made by the first build and committed by the workflow. **Never delete or replace it**, or new APKs won't install over old ones and people lose their data. The workflow points Gradle at it in `build.gradle` and refuses to release an APK whose signature doesn't match it. (Builds 1–18 were each signed with a throwaway key, because Gradle ignored `~/.android` on GitHub's machines, so people on those builds have to uninstall once.)
- **The version:** the app's version is in `app/app.json`. Bump it for releases people should notice.
- **The name:** the app is called Mobile Durham (`name` in `app/app.json`). Its `id` (`timetable`) and `native.appId` (`io.github.timetable.app`) must never change: the id is the start of every saved key, and the appId is what lets new APKs install over old ones.

## Things to know

- **Version 1 data:** before Folio, data was saved under `tt.*` keys. Each feature brings its part across once (`import-from-v1`). Keep that code.
- **Timetable downloads:** `CapacitorHttp` is on in the Android app (timetable's `feature.json`), so downloads aren't blocked there. In the web version they can be, which is what `web-relay` is for.
- **The app icon:** a one-line drawing of Durham Cathedral, dark purple `#2e2440` on light grey `#e2dfe7`. The source is `app/icons/icon.svg`; the PNGs in `app/icons/` are made from it. On Android 8 and newer the launcher uses the adaptive icon in `android-res/` (vector copies of the drawing, copied into the Android project by the "Use Mobile Durham's adaptive icon" step); change it there too if the icon changes. The background colour in the "Generate app icons" step must stay `#e2dfe7`.
- **Durham room data:** from AccessAble and OpenStreetMap, October 2026. To change it, edit `app/features/durham-rooms/places.js` and its tests.
