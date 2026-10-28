# Month view

A month at a time. Each day shows a coloured dot for each module on it (up to four), today is filled in purple and the chosen day is circled. The chosen day's classes are listed underneath; tap one for its details.

- **Tap a day** to choose it. **Tap it again**, or **Day**, to zoom in to it; **Week** zooms in to its week.
- The arrows (or arrow keys) move a month; **Today** comes back to this month.

## What it adds

- **Month** inside the Planner tab (view id `month`, zoom level 20, letter M), or a Month tab of its own without the Planner. Its zoom-out label is the month's name, e.g. **‹ October**.

## What it needs

- **Requires:** sessions. **Uses if present:** planner.

## What it saves on the phone

- Nothing. The chosen day belongs to the sessions service, so every view stays in step.

## How to check it works

1. Run `python build.py serve --test`, open **Planner** and tap **M**.
2. Days with classes have dots; tap one to see its classes, tap it again to open it.
3. Run `python build.py test`.
