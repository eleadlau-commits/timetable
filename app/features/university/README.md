# University

Which university the app is set up for, and what it knows about it. The facts come from **university packs**: feature folders named `uni-<name>` and marked `"kind": "pack"` in their `feature.json` (Durham's is `uni-durham`). Everything else asks this feature, so no other feature needs to know about Durham.

For now there's only Durham, so nothing on screen changes and nobody is asked to choose.

## What it adds

Only once there are two packs or more (so nothing yet):
- **Which university?** A window after someone new taps *I'm a student* on the Welcome screen. With one pack, that pack is simply saved for them.
- **Settings → University**, to change it. Changing it changes the library, rooms, setup guide, Spots and Societies; the timetable, to-dos and friends stay.
- **A pasted timetable link picks the university** when nobody has chosen: a link from `mytimetable.durham.ac.uk` means Durham (each pack's `timetableHosts`).

People who were already using the app (they'd chosen student or business, or were given student) keep the university they have, Durham: it's saved for them once, the first time this version runs.

## What it offers other features

- **Slot `university.packs`:** one item per pack:
  - `id` (`'durham'`), `name` (`'Durham University'`), `short` (`'Durham'`), `town` (`'Durham'`, the town Spots are in), `order`
  - `townId`, `uniId`: which town's Spots and which university's Societies to show (`'durham'`: Durham keeps `lists/spots` and `lists/societies`; another id reads `lists/spots-<townId>` and `lists/societies-<uniId>`)
  - `timetableHosts`: the timetable server's host names, e.g. `['mytimetable.durham.ac.uk']`
  - `guide`: the timetable setup guide `{ intro, steps, pictures, private }` (pictures by step number: `{ src, alt, width, height, max }`)
  - `rooms`: `{ lookup(location) }` → `{ code, room, building, address, lat, lng }` or null
  - `libraries`: `[{ id, name, page }]` (the page of free seats the library feature reads)
  - `photo`: the address of Home's photo
  - `yearStart`: the academic year's first month (0–11), September (8) if left out
- **Service `university`:** `pack()`, `packs()`, `name()`, `short()`, `town()`, `townId()`, `uniId()`, `guide()`, `libraries()`, `photo()`, `yearStart()`, `lookupRoom(text)`, `packForLink(link)`, `choose(id)`. Each returns null (or `[]`, or September) when there's no answer, and every feature copes with that.
- **Service `places`:** `{ lookup(location) }`, the same as `lookupRoom`, for Maps (it used to come from the `durham-rooms` feature).
- **Event `university:changed`** `{ id }` when someone switches university.

## Who asks it

Timetable (the setup guide), Maps (rooms, through `places`), Library (which library), Home and Customise Home (the photo), Explore, Spots, Welcome, Shop and Help (the names), Year view (the year's first month), Listings and Societies (which list to read).

## What it saves on the phone

- `choice`: the chosen pack's id: once someone chooses, once a new student is set up, or (once) for people already using the app. Until then the first pack (Durham).

## Adding another university

Copy `uni-durham` to `uni-<name>`, change the facts and the files, and keep the same shape (give it its own `townId` and `uniId`, unless it shares a town with another pack, e.g. two universities in Newcastle share `townId: 'newcastle'`). The picker appears by itself once there are two packs. The team then adds that town's places with `town` and its societies with `uni` in the Firebase console.

## How to check it works

- `python build.py test` checks the rules (`tests/rules.test.js`) and that the app works with each folder deleted, including `uni-durham`.
- `python build.py serve --test`: everything should look exactly as before.
- `python build.py serve --test --without uni-durham`: the app with no university: a general setup guide, no library, rooms as written, "Around you".
