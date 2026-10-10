# Notes

A note on any session, such as "bring laptop". You write it in the session details window, and it saves as you type. The first line shows on the session's card.

- **Adds:**
  - a line on session cards (`session.card`)
  - a "Your notes" box in session details (`session.details`, order 30)
- **Requires:** sessions.
- **Saves:** `notes`, the note text for each session. Brings across notes from version 1 on first start.
- **Forgets** its notes when the timetable is removed (`timetable:cleared`).
