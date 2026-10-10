# Sessions

How a session (a class) looks. It draws the session cards the views use, and the session details window you get when you tap one. Other features change how sessions look through its slots.

## What it offers other features

**Service `sessions`:**
- **Finding sessions:** `all`, `onDay(date)`, `hiddenNote(date)`, `isShown(s)`
- **How they look:** `name(s)`, `shortName(s)`, `hue(s)`, `defaultHue(module)`, `kind(s)`, `badge(s)`, `moduleOf(s)`, `placeLabel(location)`, `placeLink(location)`
- **Drawing:** `card(s, { now, extra })`, `open(s)`
- **The day the views show:** `selected`, `select(date)`
- **Updating:** `changed()`, which tells everyone that how sessions look has changed

**Slots** (see `Sessions.js` for each item's shape):

| Slot | Changes | Used by |
|---|---|---|
| `session.filter` | which sessions are hidden | Modules |
| `session.name` | session names | Modules |
| `session.colour` | colours | Modules |
| `session.location` | how a location is shown and linked | Maps |
| `session.card` | extra lines on cards | Notes |
| `session.details` | sections in the details window | Maps, Notes, Reminders, Modules |

**Events:** `sessions:changed`.

## What it needs

Requires **timetable**.

## Files

- `format.js`: rules that don't need the screen (module codes, colours, session types). Tested in `tests/format.test.js`.
