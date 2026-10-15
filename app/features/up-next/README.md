# Up next

Your timetable on Home: what's next under the clock, and a card with the rest of the day.

## What it adds

- **The line under the clock** (`home.next`): `Next: Linear Algebra II · 16:00 · CG85` with a live `in 47 min` countdown that changes every minute. While a class is on, it says `Now: … · until 17:00`. For a class on another day it says `Tomorrow 09:00` or `Monday 09:00`. It looks up to two weeks ahead. Tap it to open the class.
- **The date strip and lecture card** (`home.main`):
  - **Date strip:** three days, today first and filled in the accent colour, then the next weekdays (weekends are skipped, except when today is a weekend day). Tap a day to show it in the card. The arrows turn a page of days either way. *Today* in the card's corner brings you back.
  - **Lecture card:** the next class in full (name, time, type and room), then the rest of that day, each one fainter than the one before (three steps, then they stay at the faintest). Classes that are over are left off today's card. If there are more than fit, the card scrolls. Tap any class to open its details.
  - **No classes:** "No classes" on an empty day. **After the last class:** "That's all for today", with a link to the next day that has classes.
- When there's no timetable yet, both places show "Missing content: add your timetable". Tapping it opens Settings.

The day picked in the strip isn't saved. The app goes back to today when it opens, after midnight, and when a timetable is loaded.

## What it needs

- **Requires:** sessions (names, colours, hidden modules and room names all come from it, so renaming or hiding a module in the Modules feature shows here too).
- **Uses if present:** timetable (to know if there is one), home (without Home there's nowhere to show it).

## What it saves on the phone

Nothing.

## Rules and tests

`lectures.js` has the rules, tested in `tests/lectures.test.js`: which class is next (cancelled and all-day entries never are), what the card shows on a day and after the last class, the order the later classes fade in, and the weekday-only date strip.

## How to check it works

1. `python build.py serve --test` and open http://localhost:8000. The sample timetable has classes 40 minutes from now, then every hour.
2. Watch the countdown change when the minute does. Tap *Fri* and *Mon* in the strip, use the arrows, then tap *Today*.
3. `python build.py test`.
