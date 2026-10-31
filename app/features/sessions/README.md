# Sessions

How a session (a class) looks. It draws the session cards the views use, and the session details window you get when you tap one. Other features change how sessions look through its slots.

## What it offers other features

**Service `sessions`:**
- **Finding sessions:** `all` (the timetable's classes), `extra` (sessions from `session.extra`, such as your own events), `onDay(date)` (both), `hiddenNote(date)`, `isShown(s)`
- **How they look:** `name(s)`, `shortName(s)`, `hue(s)`, `defaultHue(module)`, `kind(s)`, `badge(s)`, `moduleOf(s)`, `placeLabel(location)`, `placeLink(location)`
- **Drawing:** `card(s, { now, extra })`, `open(s)`
- **The day the views show:** `selected`, `select(date)`
- **Calendars:** `hues(date, max)` (a colour per module on a day, for dots), and `layout`, the rules from `layout.js`: `layoutLanes`, `minutesInto`, `hourRange`, `monthGrid`, `academicYear`, `addMonths`
- **Updating:** `changed()`, which tells everyone that how sessions look has changed

**Slots** (see `Sessions.js` for each item's shape):

| Slot | Changes | Used by |
|---|---|---|
| `session.filter` | which sessions are hidden | Modules |
| `session.name` | session names | Modules |
| `session.colour` | colours | Modules |
| `session.location` | how a location is shown and linked | Maps |
| `session.card` | extra lines on cards | Notes |
| `session.details` | sections in the details window | Maps, Notes, Reminders, Modules, Own events |
| `session.extra` | adds sessions that aren't classes (`{ sessions() }`; call `changed()` when they change). They show in the views through `onDay`, but not in `all`, so they're never shared with friends or listed as modules | Own events |

A session can carry `hue` (its colour, before any from `session.colour`) and `outline: true` (drawn as an outline instead of filled: cards here, and the Day and Week views' blocks). Own events use both, plus `own: true`.

**Events:** `sessions:changed`.

## What it needs

Requires **timetable**.

## Files

- `format.js`: rules that don't need the screen (module codes, colours, session types). Tested in `tests/format.test.js`.
- `layout.js`: rules for calendar grids (sessions side by side when they clash, the hours a grid needs, the weeks of a month, the academic year). Tested in `tests/layout.test.js`.
