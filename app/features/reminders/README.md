# Reminders

- **Before every class:** a notification, from 5 minutes to 2 hours before. You can change it for one session in its details window.
- **Your own reminders:** one-off ones, such as an essay deadline.

The phone apps (Android and iPhone) schedule real notifications, which arrive even when the app is closed. The web version can only show reminders while it's open.

**What it adds:**
- **Reminders** in the menu, which opens the Reminders window (a small box, not full screen).
- **In session details:** a "Reminder for this session" choice (`session.details`, order 40).

**What it needs:**
- **Requires:** sessions.
- **In the phone apps:** the `@capacitor/local-notifications` package, listed in `feature.json`.

**Saves:**
- `lead`: minutes before every class
- `sessions`: changes for individual sessions
- `custom`: your own reminders

It brings these across from version 1, and forgets them when the timetable is removed. Hidden modules and cancelled sessions never send reminders.
