# Planner

One tab for the timetable views. Day, Week and Upcoming each stay their own feature folder, and appear inside the Planner, with a switch at the top to move between them.

## What it adds

- **The Planner tab** (view id `planner`, first in the tab bar). It's hidden when no views are inside it.
- **The slot `planner.views`**: views inside the Planner. An item looks exactly like one of the app's views: `{ id, label, order, mount(container), render(), step?(direction), visible?() }`. Swipes and arrow keys go to the view that's showing.
- `app.shell.selectView('day')` still works: it opens the Planner on Day. (The Week view uses this when you tap a day.) Someone whose saved view was `day`, `week` or `agenda` from an older version lands in the Planner on that view.

## What it offers

- **Service `planner`:** `select(id)` opens the Planner on that view. Day, Week and Upcoming check for it: if the Planner is there they go inside it, and if it's been deleted they become tabs of their own again.

## What it needs

Nothing.

## What it saves on the phone

- `view`: the id of the view last shown in the Planner.

## How to check it works

1. `python build.py serve --test`, open the Planner tab, switch between Day, Week and Upcoming.
2. In Week, tap a day: it opens in Day.
3. `python build.py --without planner`: Day, Week and Upcoming are tabs of their own.
