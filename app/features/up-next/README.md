# Up next

What's coming up, on the **Home** tab.

## What it adds

- **Today's lectures**, in the large card on Home (`home.main`): the class on now (*Now · until 10:00*) or the next one (*Up next · in 47 min*) in full, with its time, type and room. Then the rest of the day, each one fainter than the one before (three steps). Classes already over are left out. Tap any class for its details.
- **Everything fits without scrolling.** If the lectures don't fit, the card squeezes them a step at a time: first each later lecture goes on one line (start time and name), then the first one gets smaller, then it drops its type and room line.
- A day with nothing on, and the end of the day (*That's all for today.*), have their own message. Without a timetable the card shows **Missing content**.

(It used to show the next class under the clock and a date strip for other days. Both have gone; the Planner shows other days.)

## What it needs

- **Requires:** sessions.
- **Uses if present:** home (where it shows), timetable (to know if one is loaded).

## What it saves on the phone

Nothing.

## Files

- `rules.js`: which class leads the card, the fade steps, whether a class is on, and weekends. Tested in `tests/rules.test.js`.

## How to check it works

1. Run `python build.py serve --test`. The sample timetable has classes today.
2. Check every lecture fits on the card, also with a small window (for example 360 × 640).
3. Run `python build.py test`.
