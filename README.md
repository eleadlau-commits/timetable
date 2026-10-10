# Timetable

This app shows your university timetable on your phone. It reads the personal calendar link your university can export, keeps a copy so it works offline, and updates itself whenever you open it.

GitHub builds the app for you, so you don't need to install anything. You get:
- **An Android app** (`Timetable.apk`) to download and install.
- **A web version** (GitHub Pages) to add to your home screen. Use this on an iPhone.

## Features

| Feature | What it does |
|---|---|
| **Day, Week and Upcoming** | Three ways to see your timetable. Swipe to move between days or weeks. |
| **Session details** | Tap any session for its time, room, description and more. |
| **Notes** | Your own notes on a session, e.g. "bring laptop". The first line shows on the card. |
| **Modules** | Rename a module ("ECON1011" → "Microeconomics"), pick its colour, or hide it. |
| **Maps** | Durham room codes show as buildings (`CLC013 · Calman Learning Centre`), with a map and directions. |
| **Reminders** | A notification before each class, plus your own reminders. |
| **Campus card** | Scan your card's barcode and show it on your phone if you lose the card. |
| **Link sharing** | A QR code to send your timetable link from a computer to your phone (web version). |

You can switch any feature off for yourself in **Settings → Features**. Everything you add (notes, colours, reminders, the card) stays on your own phone.

## Install it

**Android:**
1. On your phone, open `https://github.com/YOUR-USERNAME/timetable/releases`.
2. Tap **Timetable.apk** and open the downloaded file.
3. Allow installing from this source if asked, then tap **Install**. If Play Protect warns about an unknown app, tap **More details → Install anyway**.

**iPhone (or any phone), using the web version:**
1. *One-off, on GitHub:* go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Open `https://YOUR-USERNAME.github.io/timetable/` in Safari, then tap **Share → Add to Home Screen**.

**Updating:** install a newer APK straight over the old one. Your notes and settings stay.

## Connect your timetable

The app walks you through it the first time:
1. Open your timetable on the university website.
2. Find **Export** or **Subscribe**, and confirm it.
3. Copy the link and paste it into the app.

Keep the link private, because anyone with it can see your timetable.

If the web version says the university's server blocked it, either import the `.ics` file, or set up the free relay described in `app/features/web-relay/extras/README.md`.

## How it's made

The app is built with **Folio**, a small framework where every feature is a folder:

```
app/features/notes/        everything for Notes: code, styles, README, tests
app/features/reminders/    everything for Reminders
…
folio/                     the framework itself (see folio/README.md)
build.py                   the compiler: python build.py
```

Deleting a feature folder removes that feature and nothing else, and the automatic tests check exactly that.

**Adding a feature with Claude:** open this folder in Claude and describe what you want, for example *"Add a feature that shows how long it takes to walk between classes."* Claude reads `CLAUDE.md` and `folio/README.md`, makes a new feature folder, tests it, and tells you which files to upload.

**Commands** (need Python 3.9+, and Chrome or Edge for the tests):

| Command | What it does |
|---|---|
| `python build.py` | Compiles the app into `dist/`, with a report in `dist/report.html`. |
| `python build.py serve --test` | Runs the app on your computer with sample data, at http://localhost:8000. |
| `python build.py test` | Runs every test, including deleting each feature in turn. |
| `python build.py new-feature NAME` | Starts a new feature folder. |
| `python build.py list` | Lists features and what they need. |

**Releasing:** every upload to GitHub runs the tests, then builds the APK and the web version. If a test fails, nothing is released, so a broken version never reaches anyone's phone.

**The `signing` folder on GitHub:** don't delete it. It's what lets new versions install over old ones.
