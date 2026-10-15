# Up next

What's coming up, on the **Home** tab.

## What it adds

- **Under the clock** (`home.next`): *Next: Linear Algebra II · 16:00 · CG85*. A class on another day shows its weekday, e.g. *Fri 09:00*. Without a timetable it says to add one.
- **The large card** (`home.main`):
  - A slim **date strip**: today first and filled in, then the weekdays after it, three at a time. The arrows page through days, skipping weekends. Tap a day to show it. When the app is opened again it goes back to today.
  - The **day's lectures**: the class on now (*Now · until 10:00*) or the next one (*Up next · in 47 min*) in full, with its time, type and room. Then the rest of the day, each one fainter than the one before (three steps). Classes already over are left out. Tap any class for its details. The list scrolls inside the card if it's long.
  - Days with nothing on, and the end of the day (*That's all for today.*), have their own message. Without a timetable the card shows **Missing content**.

## What it needs

- **Requires:** sessions.
- **Uses if present:** home (where it shows), timetable (to know if one is loaded).

## What it saves on the phone

Nothing.

## Files

- `rules.js`: the date strip, which class leads the card, the fade steps and the next class. Tested in `tests/rules.test.js`.

## How to check it works

1. Run `python build.py serve --test`. The sample timetable has classes today.
2. Tap other days in the strip and page with the arrows.
3. Run `python build.py test`.
