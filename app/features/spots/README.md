# Spots

The **Spots** tab, for places around Durham. For now it has a card for each kind of place, and each says it's coming soon.

## What it adds

- **The Spots tab** (view id `spots`, pin icon), with the line *Places around Durham* next to its title. Three cards: **Cafés**, **Pubs** and **Clubs**. Each has its name and a short line at the top, and a dark bar along the bottom saying *Coming soon*. Tapping a card shows a short *coming soon* message. The cards look the same as the one on More.
- **The Explore page on Home** (slot `home.pages`, order 10): the title *Explore*, the line *Places to study, eat and meet around Durham.*, and a big outlined **Open Spots** button (*Cafés, pubs and clubs* under it) that opens the Spots tab.

## Adding a photo to a card

Each card's dark bar can show a photo, fading into the dark from the left, like the photo on Home. Put the photo in a `photos/` folder here (e.g. `photos/cafes.jpg`) and set that spot's `photo` in `Spots.js` to `new URL('photos/cafes.jpg', import.meta.url).href`. Without a photo, the bar is plain dark.

## What it needs

- **Requires:** nothing.

## What it saves on the phone

Nothing.

## How to check it works

1. Run `python build.py serve --test` and tap **Spots**: three cards, Cafés, Pubs and Clubs. Tap one: a message says it's coming soon.
2. On Home, swipe to Explore and tap **Open Spots**: the Spots tab opens.
3. Run `python build.py test`.
