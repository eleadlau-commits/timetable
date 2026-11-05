# Listings

The places on the **Spots** tab: cafés, pubs and clubs around Durham, with their student deals. They come from the online database, so the team can add a café or change a deal without a new version of the app.

## What it adds

- **The places on Spots** (slot `spots.places`). Spots draws them: a *Student deals* section at the top with every place that has a deal on now, and on each of the Cafés, Pubs and Clubs cards the number of places, opening a list of them. A kind with no places still says *Coming soon*.
- Each place shows its name, a short line, its deal (with *Until 30 Nov* if the deal has an end), its opening hours, where it is, and **Menu** and **Website** buttons if it has those links.

## Where the places come from

The database's `spots` collection, one document per place. Everyone can read the published ones, signed in or not. The team adds places in the Firebase console, which only people added to the Firebase project can open. **Owners can't change their place directly**: with a shop code they send changes from the app, and the team approves them in the app's *Approve changes* (the shop feature). Only the team's accounts (the `admins` collection) can change places from the app.

The places are kept on the phone, so they show straight away and offline. The app asks the database again only when its copy is more than 6 hours old (`FRESH_FOR` in `rules.js`). Each ask costs one read per place, so 200 people with 20 places use about 16,000 of the free plan's 50,000 reads a day, at most.

### Adding a place (in the Firebase console)

1. Open https://console.firebase.google.com → **Mobile Durham** → **Firestore Database** → the **Data** tab.
2. The first time only: **+ Start collection**, Collection ID `spots`. After that, click `spots` and **+ Add document**.
3. Leave **Document ID** on *Auto-ID*, add these fields, and click **Save**:

| Field | Type | Needed? | Example |
|---|---|---|---|
| `published` | boolean | yes | `true` (set `false` to keep it as a draft nobody sees) |
| `kind` | string | yes | `cafe`, `pub` or `club` |
| `name` | string | yes | `Flat White Kitchen` (up to 60 letters) |
| `line` | string | no | `Brunch and coffee by the river` (up to 120) |
| `deal` | string | no | `10% off with your campus card` (up to 120) |
| `dealEnds` | timestamp | no | the deal's last day; it disappears after that day |
| `address` | string | no | `21a Elvet Bridge` |
| `link` | string | no | `https://…` (only `https://` links are shown) |
| `hours` | string | no | `Mon–Fri 8–6, Sat 9–5` (up to 120) |
| `open` | string | no | opening times day by day, Monday first, `0800-1700` or nothing for closed: `0800-1700\|0800-1700\|0800-1700\|0800-1700\|0800-1700\|0900-1700\|` (Sunday closed). Shows *Open now · closes 5pm*. Owners usually set this from the app |
| `photo` | string | no | a picture across the top of the card: the name of a file in `app/features/listings/photos/` (e.g. `flat-white.jpg`, comes with the app, free; see the README there), or an `https://` address of a picture |
| `menu` | string | no | `https://…`, a page or PDF with the menu |
| `order` | number | no | `1` comes first; without it, 50; then by name |

To change a deal, click the place and edit the field (or, once the owner has a shop code, they can send the change themselves and you approve it in the app). To take a place down, set `published` to `false` (or delete the document). People see changes the next time their app asks, within 6 hours.

Anything that doesn't make sense (no name, a kind that isn't cafe, pub or club, `published` not ticked) is quietly left out, so a half-typed place never shows.

**Who can edit:** anyone added in Firebase → Project settings → **Users and permissions**. Give a teammate the *Editor* role there to let them edit places (it also lets them see the rest of the database, so only add people you trust).

## What it needs

- **Requires:** account (for the connection to the database; without it, Spots says *Coming soon*).
- **Uses if present:** spots (it fills Spots' `spots.places` slot).

## What it saves on the phone

- `saved` → `{ at, places }` (each place also has `open` and `photo` since version 3.6): when the places were last fetched, and the places themselves (tidied by `toPlace()` in `rules.js`).

## How to check it works

1. Run `python build.py serve --test` and tap **Spots**: *Student deals* shows Flat White Kitchen and Cafe on the Green (the sample data in `app/tests/seed.js`). The Cafés card says *3 places*, Pubs *1 place*, Clubs *Coming soon*.
2. Tap **Cafés**: three places; the Old Deal Cafe's deal has ended, so it shows without one.
3. On Home, the Explore page says *2 student deals on now*.
4. Run `python build.py test`, and `npm test` in `firebase/` for the database rules.
