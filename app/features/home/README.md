# Home

The **Home** tab, which the app opens on. At the top, on the dark area, **four small pages you swipe between**, with a photo of Durham behind them. Then cards from other features, filling the rest of the screen down to the tab bar, as in `DESIGN.md`. Home doesn't scroll (except on a very short screen).

- **The pages:** each is only about as tall as the clock. Swipe left or right on the dark area, or tap the small knife-shaped dots under it. The pages follow your finger and settle on the next one, stopping at the first and last. Home always opens on the first page, and goes back to it when the app comes back to the screen.
  1. **The clock:** the date and the clock (40 px).
  2. **Plan Today** (from To-do list): how many things are due today, and an **Open** button.
  3. **Explore** (from Spots), with an **Open Spots** button.
  4. **Plan a journey** (from Journey), with a *Soon* button.
- **The photo:** `photos/durham.jpg`, shown half see-through behind the pages. It's clearest at the bottom right and fades out towards the top left, so the words stay readable. It stays still while the pages slide. The area is short and wide now, so a photo cut to that shape works best. Without the file there's simply no photo. **How to add or change it: see `photos/README.md`.**
- **A page's row** (class `home-page-row` in `home.css`): a title (`home-page-title`) and a line (`home-page-line`) on the left, and an outlined button (`home-button`: a solid white outline, a see-through inside) on the right.
- **The cards:** full-width cards (`home.top`), then a pair filling the rest of the height: a large card on the left (`home.main`) and a narrow one on the right (`home.side`).

Home only draws the places. Other features fill them, so deleting one of those features leaves a **Missing content** box in its place and the screen keeps its shape.

## What it adds

- **The Home tab** (view id `home`, house icon), marked as the view the app opens on.

## What it offers other features

Slots, each item `{ order, render() → element, or null to show nothing }`:

| Slot | Where | Used by |
|---|---|---|
| `home.pages` | More pages at the top, after the clock. Item `{ id, order, render() }`. One short row: use `home-page-row`, `home-page-title`, `home-page-line` and `home-button`. | To-do list (Plan Today, order 5), Spots (Explore, order 10), Journey (Plan a journey, order 20) |
| `home.top` | Full-width cards above the bottom pair | Library |
| `home.main` | The large card at the bottom left, as tall as the space left | Up next (today's lectures) |
| `home.side` | The narrow card at the bottom right | Campus card |

## What it needs

- **Requires:** nothing.

## What it saves on the phone

Nothing.

## Files

- `Home.js`: the tab, its places and the photo.
- `pages.js`: the swipeable pages and dots.
- `pager.js`: the swiping rules (how far the pages follow the finger, which page they settle on), tested in `tests/pager.test.js`.
- `photos/`: where the Durham photo goes (`durham.jpg`, see `photos/README.md`).

## How it keeps time

The app redraws once a minute, but not exactly on the minute. While Home is on screen it also redraws just after each new minute, so the clock is never behind. On phones set to 12-hour time, a small AM or PM sits next to the clock.

## How to check it works

1. Run `python build.py serve --test`. The app opens on Home.
2. Check the clock changes on the minute, in light and dark mode, and that the screen doesn't scroll.
3. Swipe left on the dark area: Plan Today, Explore, then Plan a journey; the dots follow. Swipe right to go back. Tap a dot to jump.
4. Run `python build.py test`, which also checks the app without each card's feature.
