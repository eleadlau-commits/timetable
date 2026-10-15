# Durham rooms

A built-in list of Durham University room codes, covering 45 buildings. It knows that `CLC013` is the Arnold Wolfendale Lecture Theatre in the Calman Learning Centre on Stockton Road, and exactly where that is on a map.

- **Offers:** the service `places`, with `lookup(location)` → `{ code, room, building, address, lat, lng }`, or `null`.
- **Needs:** nothing. It has no screens of its own; Maps uses it.

**Where the data comes from:** room codes and buildings are from [AccessAble's guides to Durham's learning spaces](https://www.accessable.co.uk/durham-university/learning-spaces). Map positions are from OpenStreetMap, or AccessAble where OpenStreetMap doesn't have the building. All of it was collected in October 2026.

**To fix or add a room:** edit `BUILDINGS`, `PREFIXES` or `ROOMS` in `places.js`, then add a line to `tests/places.test.js`.

**For another university:** make a feature like this one, with that university's rooms, offering the same `places` service, and delete this folder.
