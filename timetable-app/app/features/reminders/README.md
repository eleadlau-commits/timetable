# Reminders

- **Before every class:** a notification, from 5 minutes to 2 hours before. You can change it for one session in its details window.
- **Your own reminders:** one-off ones, such as an essay deadline.

The Android app schedules real notifications, which arrive even when it's closed. The web version can only show reminders while it's open.

**What it adds:**
- **A bell button** in the top bar, which opens the Reminders window.
- **In session details:** a "Reminder for this session" choice (`session.details`, order 40).

**What it needs:**
- **Requires:** sessions.
- **In the Android app:** the `@capacitor/local-notifications` package, listed in `feature.json`.

**Saves:**
- `lead`: minutes before every class
- `sessions`: changes for individual sessions
- `custom`: your own reminders

It brings these across from version 1, and forgets them when the timetable is removed. Hidden modules and cancelled sessions never send reminders.
