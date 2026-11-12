# University

Which university the app is set up for, and what it knows about it. The facts come from **university packs**: feature folders named `uni-<name>` and marked `"kind": "pack"` in their `feature.json` (Durham's is `uni-durham`). Everything else asks this feature, so no other feature needs to know about Durham.

For now there's only Durham, so nothing on screen changes and nobody is asked to choose.

## What it adds

- Nothing on screen yet. (Choosing a university comes later, once there's a second pack.)

## What it offers other features

- **Slot `university.packs`:** one item per pack:
  - `id` (`'durham'`), `name` (`'Durham University'`), `short` (`'Durham'`), `town` (`'Durham'`, the town Spots are in), `order`
  - `timetableHosts`: the timetable server's host names, e.g. `['mytimetable.durham.ac.uk']`
  - `guide`: the timetable setup guide `{ intro, steps, pictures, private }` (pictures by step number: `{ src, alt, width, height, max }`)
  - `rooms`: `{ lookup(location) }` → `{ code, room, building, address, lat, lng }` or null
  - `libraries`: `[{ id, name, page }]` (the page of free seats the library feature reads)
  - `photo`: the address of Home's photo
  - `yearStart`: the academic year's first month (0–11), September (8) if left out
- **Service `university`:** `pack()`, `packs()`, `name()`, `short()`, `town()`, `guide()`, `libraries()`, `photo()`, `yearStart()`, `lookupRoom(text)`, `packForLink(link)`, `choose(id)`. Each returns null (or `[]`, or September) when there's no answer, and every feature copes with that.
- **Service `places`:** `{ lookup(location) }`, the same as `lookupRoom`, for Maps (it used to come from the `durham-rooms` feature).
- **Event `university:changed`** `{ id }` when someone switches university.

## Who asks it

Timetable (the setup guide), Maps (rooms, through `places`), Library (which library), Home and Customise Home (the photo), Explore, Spots, Welcome and Shop (the town's name), Year view (the year's first month).

## What it saves on the phone

- `choice`: the chosen pack's id, once someone chooses. Until then the first pack (Durham).

## Adding another university

Copy `uni-durham` to `uni-<name>`, change the facts and the files, and keep the same shape. Then (a later step) a picker in Welcome and Settings appears once there are two packs.

## How to check it works

- `python build.py test` checks the rules (`tests/rules.test.js`) and that the app works with each folder deleted, including `uni-durham`.
- `python build.py serve --test`: everything should look exactly as before.
- `python build.py serve --test --without uni-durham`: the app with no university: a general setup guide, no library, rooms as written, "Around you".
