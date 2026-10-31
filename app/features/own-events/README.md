# Own events

Things of your own in the Planner, such as a society meeting, the gym or a shift at work. They're drawn as **outlines** (a purple line round the edge, the page's background inside), so they stand apart from your classes.

## What it adds

- **A + button** next to the Planner's level switch (`planner.buttons`). It opens a form: name, day (starting on the day the Planner is showing), start and end time (moving the start keeps the length), an optional place, **Repeat every week** and, for repeating ones, an optional last week. After adding, the Planner jumps to that day.
- **Your events in every view**, through Sessions' `session.extra` slot: Day, Week, Month, Year, Upcoming and Up next on Home. They count as busy in Friends' Free/Busy, but they're never shared with friends and never listed in Modules.
- **In the details window** (tap an event, `session.details`): "Your own event · Every Tuesday", then **Edit** and **Delete**. Deleting a repeating event asks: just that week, or every week. Notes and reminders work on them too; reminders are off unless you choose a time.
- **A Help question** (*Can I add my own things to the Planner?*, in *Your timetable*).

## What it needs

- **Requires:** sessions.
- **Uses if present:** planner, for the + button. Without the Planner there's no + button, but saved events still show in the views.

## What it saves on the phone

- `items`: `[{ id, title, date: 'YYYY-MM-DD', start: 'HH:MM', end: 'HH:MM', place, weekly, until: 'YYYY-MM-DD' or '', skip: ['YYYY-MM-DD', …] }]`. `skip` holds the weeks deleted from a repeating event.

Nothing goes online. Backing them up to your account could come later (it would need database rules, tests, a line in `onlineData()` and the privacy notice).

## Files

- `OwnEvents.js`: the button, the form and the details section.
- `rules.js`: checking the form, and turning each event into sessions (one per week for repeating ones, from 200 days ago to 400 days ahead, like the timetable). Tested in `tests/rules.test.js`.
- `style.css`: the form. The outline look is in Sessions (`.card.outline`) and in the Day and Week views' CSS.

## How to check it works

1. Run `python build.py serve --test`. The sample data has *Choir rehearsal* every week from today at 6 pm, and *Lunch with Sam* tomorrow.
2. Open the Planner: they're outlined in Day, Week and the list. Tap one for Edit and Delete.
3. Tap **+**, add something, and check it appears on that day.
4. Run `python build.py test`.
