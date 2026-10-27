# Spots

The **Spots** tab, for places around Durham: a card for each kind of place, and Student deals at the top. The places themselves come from another feature (`listings`, from the online database) through the `spots.places` slot.

## What it adds

- **The Spots tab** (view id `spots`, pin icon), with the line *Places around Durham* next to its title.
  - **Student deals** at the top: a card for each place with a deal on now (name, line, the deal with its end date, where it is, and a **Website** button). Hidden when there are none.
  - Three cards: **Cafés**, **Pubs** and **Clubs**. Each has its name and a short line at the top, and a dark bar along the bottom saying how many places there are. Tapping one opens a full-screen list of its places. A kind with no places says *Coming soon*, and tapping it shows a short *coming soon* message. The cards look the same as the one on More.
- **The Explore page on Home** (slot `home.pages`, order 10): the title *Explore*, the line *Cafés, pubs and clubs* (or *2 student deals on now* when there are some), and an outlined **Open Spots** button on the right that opens the Spots tab.
- **Slot `spots.places`**: where the places come from. Only the first item is used. Item: `{ places(kind) → [place], deals() → [place], update?() }`, where kind is `cafes`, `pubs` or `clubs`, and a place is `{ id, name, line?, deal?, until?, address?, link? }`. `update()` is called each time the tab is drawn, so the places can be fetched again when they're old. Spots draws the places itself.

## Adding a photo to a card

Each card's dark bar can show a photo, fading into the dark from the left, like the photo on Home. Put the photo in a `photos/` folder here (e.g. `photos/cafes.jpg`) and set that spot's `photo` in `Spots.js` to `new URL('photos/cafes.jpg', import.meta.url).href`. Without a photo, the bar is plain dark.

## What it needs

- **Requires:** nothing.

## What it saves on the phone

Nothing.

## How to check it works

1. Run `python build.py serve --test` and tap **Spots**: Student deals, then Cafés (3 places), Pubs (1 place) and Clubs (coming soon), from the sample data. Tap Cafés: a list of three. Tap Clubs: a message says it's coming soon.
   Without `listings` (`python build.py serve --test --without listings`), all three say *Coming soon*, as before.
2. On Home, swipe to Explore and tap **Open Spots**: the Spots tab opens.
3. Run `python build.py test`.
