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
6. **Run `python build.py test`** and fix everything before handing over. It includes the delete-a-folder test. If you changed `firebase/firestore.rules`, also run `npm test` in `firebase/` (needs Java).
7. **Check it in a browser** with `python build.py serve --test`, which uses the sample data in `app/tests/seed.js`.
8. **Update the docs:** the feature's `README.md`, the table below, and `README.md` for anything people see.

## Features

In start order. `python build.py list` shows the same, and `dist/report.html` maps every slot, service and event.

| Feature | What it does | Requires (uses) | Adds to | Offers |
|---|---|---|---|---|
| `account` | The account page (from the account button and the menu); signing in with Google through Firebase (web: Google's window; Android: Google's own sign-in); privacy notice; Delete my account removes all online data | | account | service `account`; slots `account.sections`, `account.cleanup`; event `account:changed` |
| `campus-card` | Scan and show the campus card barcode | | home.side, more.items | |
| `timetable` | Loads and saves the timetable, setup screen, the Planner's refresh button | | status, planner.actions, settings | service `timetable`; slots `timetable.fetch/explain/setup/settings`; events `timetable:changed/loaded/cleared` |
| `sessions` | Session cards and the details window | timetable | | service `sessions`; slots `session.filter/name/colour/location/card/details`; event `sessions:changed` |
| `planner` | The Planner tab, holding Day, Week and Upcoming | | views | service `planner`; slots `planner.views`, `planner.actions`, `planner.buttons` |
| `day-view` | Day view | sessions (planner) | planner.views | slot `day.cards` |
| `durham-rooms` | Durham room codes → buildings and map positions | | | service `places` |
| `friends` | Swap timetables with friends: friend codes, requests, accept/remove, friends' timetables (grey or tinted), Free/Busy | account (sessions) | header.actions, account.sections, account.cleanup | |
| `help` | Help and Feedback in the menu; both say "coming soon" for now | | menu | |
| `home` | The Home tab: small swipeable pages on the dark area (date and clock first) over a Durham photo, then cards filling the screen without scrolling; the app opens on it | | views | slots `home.pages/top/main/side` |
| `journey` | The Plan your journey page on Home; says "coming soon" for now | (home) | home.pages | |
| `study` | The Study tab | | views | slot `study.cards` |
| `study-timer` | The Study timer card on Study: build a pattern of study and rest blocks, run it (keeps time from the clock; notifications in the phone apps), this week's hours by module and a weekly goal; saved on the phone only | (study, sessions) | study.cards, settings | |
| `web-relay` | Relay for the web version when downloads are blocked (web only) | timetable | timetable.fetch/explain, settings | service `relay` |
| `library` | How busy Bill Bryson Library is: a thin row on Home, a folded bar on Study, free seats per floor in a full-screen pop-up | (web-relay, home, study) | home.top, study.cards, settings | |
| `link-backup` | Backs up the timetable link to your private area while signed in; brings it back on a new phone | account, timetable | account.sections, timetable.setup | |
| `link-sharing` | QR code and Android share (web only) | timetable (web-relay) | timetable.setup/settings | |
| `maps` | Building names, map preview, directions | sessions (durham-rooms) | session.location/details, settings | |
| `modules` | Rename, recolour or hide modules; button under the Planner's switch | sessions (planner) | session.name/colour/filter/details, planner.buttons, settings | |
| `more` | The More tab: cards with a dark bar along the bottom (just the campus card for now) | | views | slot `more.items` |
| `notes` | Notes on sessions | sessions | session.card/details | |
| `reminders` | Class and personal reminders | sessions | menu, session.details | |
| `spots` | The Spots tab: Cafés, Pubs and Clubs cards (coming soon), and the Explore page on Home | | views, home.pages | |
| `todo` | To-do list pop-up with tags, due dates and "Due today"; the Plan Today page on Home (with how many are due today) | (home) | home.pages | |
| `up-next` | Today's lectures on Home, squeezed to fit without scrolling | sessions (timetable, home) | home.main | |
| `upcoming` | Next four weeks (view id `agenda`) | sessions (planner) | planner.views | |
| `week-view` | Week grid | sessions (day-view, planner) | planner.views | |

**The screen:** one top bar (menu on the left; features' buttons from `header.actions` such as Friends, then the account button, on the right), the open tab's title below it (on Home, the dark area continues behind the clock), and the tab bar along the bottom: Study · Planner · Home · Spots · More (tap, or swipe the bar). The menu slides in from the left: *Not signed in* and the status line at the top, then Account, Reminders, Settings, Help, About, Feedback (the framework's own rows mixed with features' `header.buttons` by `order`). The account button and the Account row open the `account` feature's page (Folio's `account` slot); without that feature they say "coming soon". Pop-ups fill the screen, with their title bar staying at the top; only Reminders and the campus card stay small boxes (`size: 'box'`). Light or dark follows the phone, or Settings → Appearance (Folio switches every `@media (prefers-color-scheme: dark)` rule, so dark styles go inside that query as usual). Colours, fonts and the "knife" corner shape are in `app/theme.css` (from `DESIGN.md`); new styles use the names from there (`--shape` for cards and pop-ups, `--shape-btn` for buttons and text boxes, `--shape-sm` for small tags) rather than colours or corners of their own. Day buttons in date strips and round things (tick circles, dots, switches) keep their own shape, and cards have no coloured edges. When a place has nothing to show, use `ui.missing('what is missing')`. On Home's dark area, big buttons use Home's `home-button` class, and its see-through whites are `--on-top-fill`, `--on-top-dot` and `--on-top-dot-on`. The Durham photo is `app/features/home/photos/durham.jpg` (see the README there).

## Branches

Name each branch `claude/` plus a few words saying what the change is, e.g. `claude/library-card` or `claude/fix-week-view-swipe`. Don't use the session's random name (like `claude/beautiful-dirac-r9jeyv`). This is the owner's standing permission to push to such a branch instead. Never push straight to `main`.

## Releasing

- **On GitHub:** every push to `main` runs `.github/workflows/build.yml`. Tests run first, and if they fail nothing is released. Then the APK goes to Releases and the web version to GitHub Pages.
- **The iPhone app** is built by the *iPhone app (TestFlight)* job on one of GitHub's Macs (`macos-15-intel`, newest Xcode; the arm64 `macos-15` Macs were often unavailable) and sent to TestFlight. The iPhone project is made fresh each time (`npx cap add ios`, CocoaPods), then `python build.py ios-project` adds features' `native.ios` settings, files and Podfile lines, and the app's id, version, build number (the run number) and Apple team. Xcode signs it itself with the App Store Connect key. The job needs four GitHub secrets (`APPLE_TEAM_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY`) and `app/features/account/native/GoogleService-Info.plist`; without them it says what's missing and stops, and the rest still releases. Setup steps are in README.md ("The iPhone app"). It's iPhone only (`native.ios.devices` in `app/app.json`). **Never put the Apple key in the repository or the chat.**
- **The Android project** is made fresh on every build, in `dist/`. Packages, permissions and Capacitor settings come from each feature's `feature.json` (`native`).
- **The signing key:** `signing/debug.keystore` is made by the first build and committed by the workflow. **Never delete or replace it**, or new APKs won't install over old ones and people lose their data. The workflow points Gradle at it in `build.gradle` and refuses to release an APK whose signature doesn't match it. (Builds 1–18 were each signed with a throwaway key, because Gradle ignored `~/.android` on GitHub's machines, so people on those builds have to uninstall once.)
- **The version:** the app's version is in `app/app.json`. Bump it for releases people should notice.
- **The name:** the app is called Mobile Durham (`name` in `app/app.json`). Its `id` (`timetable`) and `native.appId` (`io.github.timetable.app`) must never change: the id is the start of every saved key, and the appId is what lets new APKs install over old ones.

## Things to know

- **Version 1 data:** before Folio, data was saved under `tt.*` keys. Each feature brings its part across once (`import-from-v1`). Keep that code.
- **Downloads from other websites** (the timetable, the library page): use `this.getText(url)` (Folio's `net.js`). In the Android app the phone makes the download itself (the CapacitorHttp plugin, called directly), so it isn't blocked; in the web version it can be, which is what `web-relay` is for. **Don't switch CapacitorHttp on for the whole app** (`"CapacitorHttp": { "enabled": true }`): it takes over every request the web part makes and breaks Firebase's database ("unavailable").
- **The app icon:** a one-line drawing of Durham Cathedral, dark purple `#2e2440` on light grey `#e2dfe7`. The source is `app/icons/icon.svg`; the PNGs in `app/icons/` are made from it. On Android 8 and newer the launcher uses the adaptive icon in `android-res/` (vector copies of the drawing, copied into the Android project by the "Use Mobile Durham's adaptive icon" step); change it there too if the icon changes. The background colour in the "Generate app icons" step must stay `#e2dfe7`.
- **Campus card barcodes:** Durham cards use **Telepen** in number mode (the long number under the barcode). Neither the phone's BarcodeDetector nor ZXing reads Telepen, so `campus-card` reads and draws it itself (`telepen.js`, `scan.js`). It also patches two ZXing bugs (`zxing-fixes.js`).
- **Firebase:** accounts use the Firebase project `mobile-durham` (Google sign-in only). Its web config is in `app/features/account/firebase-config.js`; that's not a password. Never put a service account, private key or anything secret in the repository or the chat. The database rules are in `firebase/firestore.rules`, tested against Google's emulator by `firebase/tests/` (GitHub's *Database rules* job; nothing is released if they fail), and published by pasting into the Firebase console (see `firebase/README.md`). Anything stored online needs rules with tests, a line in `onlineData()` (`account/rules.js`) so Delete my account removes it, and an updated privacy notice (`account/privacy.js`). There's no App Check yet: Android's check (Play Integrity) needs the app on Google Play, so it's added, enforced, once it is. Google's sign-in window doesn't work inside the Android app, so it uses Google's own Android sign-in through `@capacitor-firebase/authentication`, with `native/google-services.json` copied into the Android project by Folio's `native.android.files`.
- **Durham room data:** from AccessAble and OpenStreetMap, October 2026. To change it, edit `app/features/durham-rooms/places.js` and its tests.
