# More

The **More** tab: everything else the app can do, as a list of rows in groups.

## What it adds

- **The More tab** (view id `more`, three-dots icon), with the line *Everything else* next to its title.

## What it offers other features

- **Slot `more.items`:** rows on the More tab. Item: `{ id, label, icon, order, group?, detail?() → short text, onClick(), visible?() }`. Rows with the same `group` are shown together under that heading.

Used by:

| Group | Row | From |
|---|---|---|
| On the go | Campus card | campus-card |
| On the go | Reminders | reminders |
| Your timetable | Modules | modules |
| Your timetable | Calendar link (opens Settings) | timetable |
| Your timetable | Send to your phone (QR code, web only) | link-sharing |

## What it needs

- **Requires:** nothing.

## What it saves on the phone

Nothing.

## How to check it works

1. Run `python build.py serve --test` and tap **More**. Tap each row.
2. Run `python build.py test`.
