# Maps

Shows which building a session is in, and how to get there:
- **On cards:** `CLC013 · Calman Learning Centre`.
- **Tapping a location:** opens Google Maps with a pin on the building. Known buildings use their exact coordinates.
- **In session details:** the room name, the street, and a small map (from OpenStreetMap) with a pin. You can also type the right building name if it's unknown or wrong, and it's remembered for every session there.

**What it adds:**
- **Locations:** how they're shown and linked (`session.location`).
- **Session details:** a building and map section (`session.details`, order 10).
- **Settings:** an "Area for map searches" setting.

**What it needs:**
- **Requires:** sessions.
- **Uses if present:** durham-rooms, through its `places` service. Without it, maps still work from the location text and any building names you type.
- **In the phone app:** it lets the OpenStreetMap preview load (see `native.capacitor` in `feature.json`).

**Saves:** `typed`, the building names you typed, and `area`. Brings these across from version 1, and forgets them when the timetable is removed.
