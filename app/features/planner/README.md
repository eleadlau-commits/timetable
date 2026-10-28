# Planner

The **Planner** tab: one calendar you zoom in and out of, like the iPhone's Calendar. **Year → Month → Week → Day.**

- **Zoom in:** tap a month (in Year), a day's "Week" or "Day" button or the chosen day again (in Month), or a day's heading (in Week). The new level grows out of where you tapped.
- **Zoom out:** tap the purple label at the top left (such as **‹ October**), or pinch with two fingers. Spreading two fingers zooms in.
- **Jump to a level:** the small **Y M W D** switch.
- **Upcoming:** the list button next to the switch shows the next four weeks as a list; tap it again to go back.
- Arrow keys go to the open level's previous or next year, month, week or day; swipes change tab, as everywhere. Animations are skipped when the phone's "reduce motion" setting is on.

The Planner **opens on Day, on today**, each time the app starts. While the app stays open, it keeps the level and day you were on when you switch tabs and come back.

## What it adds

- **The Planner tab** (view id `planner`, calendar icon). It only appears when at least one view is inside it.
- **A bar under the title:** the zoom-out label, the level switch, a button for each view that isn't a level (Upcoming), and features' small buttons (`planner.buttons`, such as Modules).
- **Small buttons on the right of its title**, from other features (see `planner.actions` below).

## What it offers other features

- **Slot `planner.views`:** views inside the Planner. Item: `{ id, label, order, mount(container), render(), step?(direction), visible?() }`, as for the framework's `views` slot, plus:
  - `zoom`: makes it a level; bigger is closer. Year 10, Month 20, Week 30, Day 40.
  - `short`: its letter on the level switch (e.g. `'M'`).
  - `crumb(date)`: the zoom-out label's text while the next level in is open (Month gives the month's name).
  - `buttonIcon`: for a view without `zoom`, the icon of its button (a list if not given).
- **Slot `planner.actions`:** small round buttons on the right of the Planner's title. Item: `{ order, render() → element or null }`. Timetable adds its refresh button here. Use `icon-btn ghost`.
- **Slot `planner.buttons`:** small buttons next to the level switch. Item: `{ order, render() → element or null }`. Modules adds its palette button here. Use `icon-btn` with an `aria-label`.
- **Service `planner`:** there while Planner is running. Views check for it: `this.add(this.use('planner') ? 'planner.views' : 'views', …)`, so without Planner each becomes a tab of its own. It has `zoomIn()` and `zoomOut()` (one level, on the sessions service's selected day) and `show(id, 'in' | 'out')`.
- `app.shell.selectView('week')` opens the Planner on Week, because the Planner answers `contains('week')`.

## What it needs

- **Requires:** nothing. **Uses if present:** sessions (for the zoom-out label's date).

## What it saves on the phone

- Nothing any more. Version 1 saved the open view as `view`; that key is left alone but no longer read, because the Planner now always opens on today.

## How to check it works

1. Run `python build.py serve --test` and tap **Planner** at the bottom. It opens on today's Day.
2. Tap **‹ This week**, then **‹ October**, then **‹ 2026–27**: Week, Month, Year. Tap a month to go back in.
3. Switch to Home and back: the Planner is still on the level you left.
4. On a phone (or touch emulation), pinch in and out.
5. Run `python build.py test`. Try `python build.py --without planner`: the views come back as tabs.
