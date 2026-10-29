# Timetable

Loads the timetable from the university's calendar export link (`.ics`), saves it on the phone so it works offline, and downloads it again when it's more than 30 minutes old. Until there's a timetable, it shows the setup screen with step-by-step instructions.

## What it adds

- The **setup screen**: instructions, the link box with a Paste button, and "Other ways to get the link in".
- **A refresh button on the Planner tab** (slot `planner.actions`), on the right of the title: the round refresh icon, spinning while it loads, next to "Updated 5 min ago". It's there for Day, Week and Upcoming, and only when there's a link to download again (not for an imported file).
- **"Updated 5 min ago"** at the top of the menu, under *Not signed in*, and next to view titles (`header.status`).
- A **Timetable section in Settings**: change the link, import an `.ics` file, or remove the timetable.
- **Questions in Help** (`help.questions`): *How do I connect my timetable?* (a page of its own: the same steps as the setup screen, the tips for a computer or a file, and a **Set up my timetable** / **Change my timetable link** button that opens the setup screen), *How often does my timetable update?*, *My timetable looks wrong or out of date* and *Who can see my timetable link?*

## What it offers other features

**Service `timetable`:**
- `events`, `name`, `hasData`, `url`, `updatedAt`, `source`
- `load(link)`, `reload()`, `importFile()`, `openSetup()`, `prefill(link)`, `typedLink`, `clear()`, `explain(error)`, `normaliseLink(text)`

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

Nothing. In the Android app the download is made by the phone itself (Folio's `this.getText`, through the CapacitorHttp plugin), so the university's server can't block it.

## What it saves on the phone

`ics` (the calendar file), `url`, `updated`, `source`. On first start it brings across data saved by version 1 of the app (`tt.ics`, `tt.url` and so on).

## Files

- `guide.js`: the words of the setup guide (the intro, the five steps and the line about keeping the link private), used by the setup screen and by Help. **To change the guide, change it here.** In the text, `**bold**`, `_slanted_` and `` `code` `` work.
- `ics.js`: reads calendar files, including repeating sessions, exceptions, moved sessions and time zones. Tested in `tests/ics.test.js`.
