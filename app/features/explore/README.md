# Explore

The **Explore** tab (it used to be the Spots tab): big cards for things to discover around Durham. Today there are two:

- **Spots** (from the spots feature): cafés, pubs and clubs, with student deals. Its bar says how many deals are on now. Tapping it opens Spots in a full-screen window.
- **Societies** (from the societies feature): clubs and societies to join. Tapping it opens the list.

It also adds the **Explore page on Home** (the swipeable pages at the top, in both versions of the app), with an **Open Explore** button. Its line comes from the first card that has one, such as "2 student deals on now".

## For other features

Slot `explore.cards`. Item: `{ id, label, line, order, onClick(), detail?() → short text for the dark bar, photo? (an image address for the bar), homeLine?() → a line for the Explore page on Home, visible?() → false to hide it }`. Which cards show, in which order, is in `rules.js`, tested in `tests/`.

## What it needs

- **Requires:** nothing.
- **Uses if present:** home (the Explore page). Without Explore, Spots goes back to having its own tab.

## What it saves on the phone

Nothing.

## How to check it works

1. Run `python build.py test`.
2. Run `python build.py serve --test` and tap **Explore**: Spots (2 student deals on now) and Societies (4 societies), from the sample data.
