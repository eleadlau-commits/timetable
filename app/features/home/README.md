# Home

The screen the app opens on. It has its own header instead of the top bar, the date, a big clock, and places where other features add cards. It's on the page's dark top, in the light and dark themes alike.

## What it adds

- **The Home tab** (view id `home`), the default tab.
- **Header:** *Menu* (three lines) opens a list of the buttons that used to be in the top bar: refresh, reminders, campus card, Settings… (whatever features add to `header.buttons`), with the "Updated 5 min ago" line above them. *Friends* only appears if a feature offers a `friends` service (none does yet). *Account* opens Settings.
- **Date and clock:** today's date, and the time in IBM Plex Mono, 96 px. It changes at the start of every minute (`app:tick`). On a 12-hour phone, AM/PM is shown small after the time.
- **Places for other features** (slots it defines). Each item is `{ order, render() }`, and `render()` gives back an element to show, a short text saying what's missing (e.g. `'add your timetable'`), or `null` to leave the place to other items.

  | Slot | Where | Filled by |
  |---|---|---|
  | `home.next` | The line under the clock | sessions: "Next: … · 16:00 · CG85 · in 47 min" |
  | `home.top` | A wide card above the bottom block | library |
  | `home.main` | The left column of the bottom block | sessions: date strip and lecture card |
  | `home.side` | The narrow right column (104 px) | campus-card |

- **Missing content:** a place where nothing has anything to show gets a dashed "Missing content" box, with the reason if an item gave one (e.g. "Missing content: add your timetable"). So the layout keeps its shape when a feature is deleted or its data isn't there.

## What it needs

Nothing. It **uses**, if present, the `friends` service (`{ open() }`) for the Friends button.

## What it saves on the phone

Nothing.

## Rules and tests

`clock.js` has the rules: the clock's time and AM/PM, and what a place shows (`slotContent`, `missingText`). Tested in `tests/clock.test.js`.

## How to check it works

1. `python build.py serve --test`, open http://localhost:8000. Home is the first screen.
2. The clock changes when the minute does. Menu lists the old top-bar buttons; Account opens Settings.
3. `python build.py --without sessions,library,campus-card` and open `dist/web`: each place shows "Missing content".
