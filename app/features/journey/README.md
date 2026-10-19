# Plan your journey

The **Plan a journey** page at the top of Home: the last page, after the clock, Plan Today and Explore. Journey planning isn't built yet, so its button shows a short *Plan your journey is coming soon* message.

## What it adds

- **A page on Home** (slot `home.pages`, order 20): the title *Plan a journey*, the line *To your next class, and back home*, and an outlined **Soon** button on the right (Home's `home-button` style).

## What it needs

- **Requires:** nothing.
- **Uses if present:** `home` (for the page). Without Home, it has nowhere to show, but nothing breaks.

## What it saves on the phone

Nothing.

## How to check it works

1. Run `python build.py serve --test` and open the app on Home.
2. Swipe left twice on the dark area at the top (or tap the third dot). The Plan your journey page shows.
3. Tap **Plan a journey**: a message at the bottom says it's coming soon.
4. Delete this folder and build again: Home has three pages, and everything else stays.
