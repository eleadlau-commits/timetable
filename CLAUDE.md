# Timetable app (built with Folio)

A timetable app for a Durham University student and a few friends. It reads the university's calendar export link (`.ics`) and shows Day, Week and Upcoming views, plus notes, module colours/names/hiding, maps of Durham rooms, reminders and a campus card barcode.

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
| `campus-card` | Scan and show the campus card barcode | | header button | |
| `timetable` | Loads and saves the timetable, setup screen | | header button + status, settings | service `timetable`; slots `timetable.fetch/explain/setup/settings`; events `timetable:changed/loaded/cleared` |
| `sessions` | Session cards and the details window | timetable | | service `sessions`; slots `session.filter/name/colour/location/card/details`; event `sessions:changed` |
| `day-view` | Day view | sessions | views | |
| `durham-rooms` | Durham room codes → buildings and map positions | | | service `places` |
| `web-relay` | Relay for the web version when downloads are blocked (web only) | timetable | timetable.fetch/explain, settings | service `relay` |
| `link-sharing` | QR code and Android share (web only) | timetable (web-relay) | timetable.setup/settings | |
| `maps` | Building names, map preview, directions | sessions (durham-rooms) | session.location/details, settings | |
| `modules` | Rename, recolour or hide modules | sessions | session.name/colour/filter/details, settings | |
| `notes` | Notes on sessions | sessions | session.card/details | |
| `reminders` | Class and personal reminders | sessions | header button, session.details | |
| `upcoming` | Next four weeks (view id `agenda`) | sessions | views | |
| `week-view` | Week grid | sessions (day-view) | views | |

## Releasing

- **On GitHub:** every push to `main` runs `.github/workflows/build.yml`. Tests run first, and if they fail nothing is released. Then the APK goes to Releases and the web version to GitHub Pages.
- **The Android project** is made fresh on every build, in `dist/`. Packages, permissions and Capacitor settings come from each feature's `feature.json` (`native`).
- **The signing key:** `signing/debug.keystore` is made by the first build and committed by the workflow. **Never delete or replace it**, or new APKs won't install over old ones and people lose their data.
- **The version:** the app's version is in `app/app.json`. Bump it for releases people should notice.

## Things to know

- **Version 1 data:** before Folio, data was saved under `tt.*` keys. Each feature brings its part across once (`import-from-v1`). Keep that code.
- **Timetable downloads:** `CapacitorHttp` is on in the Android app (timetable's `feature.json`), so downloads aren't blocked there. In the web version they can be, which is what `web-relay` is for.
- **Durham room data:** from AccessAble and OpenStreetMap, October 2026. To change it, edit `app/features/durham-rooms/places.js` and its tests.
