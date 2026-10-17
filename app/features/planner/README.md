# Planner

The **Planner** tab. It holds the timetable views (Day, Week and Upcoming) with a switch between them under the title. Swipes and arrow keys go to the open view.

## What it adds

- **The Planner tab** (view id `planner`, calendar icon). It only appears when at least one view is inside it.
- **Small buttons on the right of its title**, from other features (see `planner.actions` below). They stay the same whichever view is open.
- **Buttons under the switch**, from other features (see `planner.buttons` below), such as **Modules: colours and names**. The row is hidden when there are none.

## What it offers other features

- **Slot `planner.views`:** views inside the Planner. Item: `{ id, label, order, mount(container), render(), step?(direction), visible?() }`, the same as for the framework's `views` slot. Day view, Week view and Upcoming use it.
- **Slot `planner.actions`:** small round buttons on the right of the Planner's title, after the status line. Item: `{ order, render() → element or null }`. Timetable adds its refresh button here. Use `icon-btn ghost` for the look.
- **Slot `planner.buttons`:** buttons under the Planner's switch. Item: `{ order, render() → element or null }`. Modules adds its button here. Use `btn small` for the look; an icon before the words is fine.
- **Service `planner`:** there while Planner is running. Views check for it: `this.add(this.use('planner') ? 'planner.views' : 'views', …)`. So without Planner, each of them becomes a tab of its own again.
- `app.shell.selectView('week')` opens the Planner on Week, because the Planner answers `contains('week')`.

## What it needs

- **Requires:** nothing.

## What it saves on the phone

- `view`: the view last open in the Planner (`day`, `week` or `agenda`). The first time, it takes the view the app itself remembered before the Planner existed.

## How to check it works

1. Run `python build.py serve --test` and tap **Planner** at the bottom.
2. Switch between Day, Week and Upcoming. Close and reopen the app: the Planner remembers which one was open.
3. The round refresh button on the right of the title is there on all three (the test build has a made-up link, so refreshing says it couldn't).
4. Run `python build.py test`. Try `python build.py --without planner`: Day, Week and Upcoming come back as tabs.
