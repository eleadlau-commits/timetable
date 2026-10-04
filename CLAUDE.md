# Timetable app

A personal timetable app for a Durham University student. It reads the university's iCal export link (.ics), stores it on the phone, and shows Day, Week and Upcoming views. It also has notes, module colours, names and hiding, and maps for Durham room codes.

## How it's built and released

- `www/` is the whole app: plain HTML, CSS and JavaScript modules. There's no build step, framework or npm packages in the app itself.
- The Android app is `www/` wrapped by Capacitor (`capacitor.config.json`). `CapacitorHttp` is enabled, so `fetch()` goes through native code and the university server's CORS rules don't apply in the APK.
- The web version (for iPhone) is `www/` published to GitHub Pages. There, CORS can block the timetable link, so the optional relay in `relay/` exists for that case.
- Releasing is done by `.github/workflows/build.yml` on every push to `main`. It builds the APK, attaches it to a GitHub Release, and deploys Pages.
- `signing/debug.keystore` is created by the first build and committed by the workflow. **Never delete or replace it**, or the next APK won't install over the old one and the user loses their notes and settings.
- The user isn't a developer. They don't use git locally; they upload files through the GitHub website (**Add file → Upload files**). When handing over changes, list exactly which files changed and give step-by-step upload instructions.
- Reminders use `@capacitor/local-notifications` (in `package.json`) via `window.Capacitor.Plugins.LocalNotifications`. In the web version they only show while the app is open. The workflow adds Android's `CAMERA` permission for the campus card scanner, because the Android project is generated fresh on every build.

## Files

| File | Purpose |
|---|---|
| `www/index.html` | All screens and dialogs (setup, day/week/agenda views, settings, session details, modules) |
| `www/app.js` | App logic: loading/refreshing the calendar, rendering, settings, notes, modules, maps |
| `www/ics.js` | iCalendar parser and recurrence expansion (RRULE, EXDATE, RECURRENCE-ID, time zones) |
| `www/places.js` | Durham room code → building table with names, streets and map coordinates, plus `lookupPlace()` |
| `www/barcode.js` | Draws the saved campus card barcode (Code 128, Code 39, Codabar) as SVG |
| `www/styles.css` | Styles, with light and dark mode via CSS variables on `:root` |
| `www/sw.js` | Service worker for offline use in the web version |

## Conventions

- **When you change anything in `www/`, bump `CACHE` in `www/sw.js`** (e.g. `timetable-v4` → `timetable-v5`). If you don't, the web version keeps serving the old files.
- New files in `www/` must be added to the `SHELL` list in `www/sw.js`.
- Everything the user creates is stored in `localStorage`. The keys are prefixed `tt.`, and notes, module names, colours, hidden modules and typed building names are in `tt.prefs` (see `emptyPrefs()` in `app.js`). Don't rename keys, or existing users lose their data. Add new fields to `emptyPrefs()` instead.
- Elements marked `data-web-only` or `data-native-only` are shown only in the web version or only in the Android app (`NATIVE` in `app.js`).
- Build the DOM with the `el()` helper in `app.js`, not `innerHTML`, because calendar text is untrusted.
- Room data came from AccessAble's Durham learning-spaces guides, and map positions from OpenStreetMap (October 2026). To fix or add a room or building, edit `BUILDINGS`, `PREFIXES` or `ROOMS` in `www/places.js`.

## Testing locally

Run `python -m http.server 8000 --directory www` and open http://localhost:8000. To test with sample data, put an `.ics` file in `www/` and load it via `http://localhost:8000/yourfile.ics`. Delete it afterwards.
