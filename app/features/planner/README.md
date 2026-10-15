# Planner

The **Planner** tab. It holds the timetable views (Day, Week and Upcoming) with a switch between them under the title. Swipes and arrow keys go to the open view.

## What it adds

- **The Planner tab** (view id `planner`, calendar icon). It only appears when at least one view is inside it.

## What it offers other features

- **Slot `planner.views`:** views inside the Planner. Item: `{ id, label, order, mount(container), render(), step?(direction), visible?() }`, the same as for the framework's `views` slot. Day view, Week view and Upcoming use it.
- **Service `planner`:** there while Planner is running. Views check for it: `this.add(this.use('planner') ? 'planner.views' : 'views', …)`. So without Planner, each of them becomes a tab of its own again.
- `app.shell.selectView('week')` opens the Planner on Week, because the Planner answers `contains('week')`.

## What it needs

- **Requires:** nothing.

## What it saves on the phone

- `view`: the view last open in the Planner (`day`, `week` or `agenda`). The first time, it takes the view the app itself remembered before the Planner existed.

## How to check it works

1. Run `python build.py serve --test` and tap **Planner** at the bottom.
2. Switch between Day, Week and Upcoming. Close and reopen the app: the Planner remembers which one was open.
3. Run `python build.py test`. Try `python build.py --without planner`: Day, Week and Upcoming come back as tabs.
