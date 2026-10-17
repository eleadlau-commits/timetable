# Plan your journey

The **Plan your journey** page at the top of Home: the third page, after the first page and Explore. Journey planning isn't built yet, so its button shows a short *Plan your journey is coming soon* message.

## What it adds

- **A page on Home** (slot `home.pages`, order 20): the title *Plan your journey*, the line *Getting to your next class, and back home.*, and a big outlined **Plan a journey** button (Home's `home-button` style) that says *Coming soon*.

## What it needs

- **Requires:** nothing.
- **Uses if present:** `home` (for the page). Without Home, it has nowhere to show, but nothing breaks.

## What it saves on the phone

Nothing.

## How to check it works

1. Run `python build.py serve --test` and open the app on Home.
2. Swipe left twice on the dark area at the top (or tap the third dot). The Plan your journey page shows.
3. Tap **Plan a journey**: a message at the bottom says it's coming soon.
4. Delete this folder and build again: Home has two pages, and everything else stays.
