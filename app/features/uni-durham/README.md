# Durham University (pack)

Everything the app knows that is only true at Durham, in one folder. It has no screens of its own: it adds Durham to the University feature's `university.packs` slot, and the other features ask the `university` service. Delete this folder and the app still works, as a general app with no university.

## What's in it

| File | What it is | Used by |
|---|---|---|
| `Durham.js` | Durham's names, the timetable server, Bill Bryson Library's page of free seats, the year starting in September | University |
| `guide.js`, `guide/` | The timetable setup guide: My Timetable → Settings / Export → Publish Calendar: Yes → copy the Calendar Link, with two pictures (personal details left out) | Timetable (setup screen and Help) |
| `rooms.js` | Room codes → buildings and map positions (45 buildings), e.g. `CLC013` is the Arnold Wolfendale Lecture Theatre in the Calman Learning Centre | Maps |
| `photos/durham.jpg` | The photo behind the clock on Home | Home, Customise Home |

**Where the room data comes from:** [AccessAble's guides to Durham's learning spaces](https://www.accessable.co.uk/durham-university/learning-spaces), and OpenStreetMap for map positions (AccessAble where OpenStreetMap doesn't have the building), October 2026. To fix or add a room, edit `BUILDINGS`, `PREFIXES` or `ROOMS` in `rooms.js`, then add a line to `tests/rooms.test.js`.

**To change the guide**, change the words in `guide.js` (`**bold**`, `_slanted_` and `` `code` `` work). **To change the photo**, see `photos/README.md`.

## History

Until version 3.13.1 these lived in other features: rooms in `durham-rooms` (`places.js`), the guide in `timetable`, the photo in `home`, the library's address in `library`. Nothing saved on phones changed when they moved.
