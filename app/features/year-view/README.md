# Year view

The academic year at a glance, **September to August**, as twelve small months. Days with classes are dark and the rest faded, so term time stands out without anyone typing in term dates; today is filled in purple. Tap a month to zoom in to it.

- The arrows (or arrow keys) move a year; **Today** comes back to this year.

## What it adds

- **Year** inside the Planner tab (view id `year`, zoom level 10, letter Y), or a Year tab of its own without the Planner. Its zoom-out label is the year, e.g. **‹ 2026–27**.

## What it needs

- **Requires:** sessions. **Uses if present:** planner.

## What it saves on the phone

- Nothing.

## How to check it works

1. Run `python build.py serve --test`, open **Planner** and tap **Y**.
2. The sample classes show as dark days in October and November. Tap **Oct** to open it.
3. Run `python build.py test`.
