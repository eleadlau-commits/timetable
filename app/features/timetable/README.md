# Timetable

Loads the timetable from the university's calendar export link (`.ics`), saves it on the phone so it works offline, and downloads it again when it's more than 30 minutes old. Until there's a timetable, it shows the setup screen with step-by-step instructions.

## What it adds

- The **setup screen**: instructions, the link box with a Paste button, and "Other ways to get the link in".
- A **refresh button** in the top bar.
- **"Updated 5 min ago"** under the app name.
- A **Timetable section in Settings**: change the link, import an `.ics` file, or remove the timetable.

## What it offers other features

**Service `timetable`:**
- `events`, `name`, `hasData`, `url`, `updatedAt`, `source`
- `load(link)`, `reload()`, `importFile()`, `prefill(link)`, `typedLink`, `clear()`, `explain(error)`, `normaliseLink(text)`

**Slots:**
- `timetable.fetch`: other ways to download when the direct link is blocked
- `timetable.explain`: better error explanations
- `timetable.setup`: blocks on the setup screen
- `timetable.settings`: buttons next to "Save and refresh"

**Events:**
- `timetable:changed`: new data, or the timetable was removed
- `timetable:loaded`: the person loaded a timetable themselves
- `timetable:cleared`: other features should forget their timetable data

## What it needs

Nothing. In the Android app, `CapacitorHttp` is switched on (see `feature.json`), so the university's server can't block the download.

## What it saves on the phone

`ics` (the calendar file), `url`, `updated`, `source`. On first start it brings across data saved by version 1 of the app (`tt.ics`, `tt.url` and so on).

## Files

- `ics.js`: reads calendar files, including repeating sessions, exceptions, moved sessions and time zones. Tested in `tests/ics.test.js`.
