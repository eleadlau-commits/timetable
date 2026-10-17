# Home

The **Home** tab, which the app opens on. At the top, on the dark area, **pages you swipe between**, with a photo of Durham behind them. Then cards from other features at the bottom of the screen, as in `DESIGN.md`.

- **The pages:** swipe left or right on the dark area, or tap the small knife-shaped dots under it. The pages follow your finger and settle on the next one, stopping at the first and last. Home always opens on the first page, and goes back to it when the app comes back to the screen.
  1. **Today:** the date, the clock (40 px) and what's next, then the big **Plan Today** button.
  2. **Explore** (from Spots), with an **Open Spots** button.
  3. **Plan your journey** (from Journey), with a *coming soon* button.
- **The photo:** `photos/durham.jpg`, shown half see-through behind the pages. It's clearest at the bottom right and fades out towards the top left, so the words stay readable. It stays still while the pages slide. Without the file there's simply no photo. **How to add or change it: see `photos/README.md`.**
- **The big outlined button** (class `home-button` in `home.css`): a solid white outline, a see-through inside, as wide as its words plus a little room for the arrow. Plan Today, Open Spots and Plan a journey all use it.

Home only draws the places. Other features fill them, so deleting one of those features leaves a **Missing content** box in its place and the screen keeps its shape.

## What it adds

- **The Home tab** (view id `home`, house icon), marked as the view the app opens on.

## What it offers other features

Slots, each item `{ order, render() → element, or null to show nothing }`:

| Slot | Where | Used by |
|---|---|---|
| `home.next` | Short lines or buttons under the clock | Up next ("Next: …"), To-do list (the *Plan Today* button, on the left) |
| `home.pages` | More pages at the top, after the first. Item `{ id, order, render() }`. Use `home-page-title`, `home-page-line` and `home-button` for the look. | Spots (Explore, order 10), Journey (Plan your journey, order 20) |
| `home.top` | Full-width cards above the bottom pair | Library |
| `home.main` | The large card at the bottom left | Up next (date strip and lectures) |
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
2. Check the clock changes on the minute, in light and dark mode.
3. Swipe left on the dark area: Explore, then Plan your journey; the dots follow. Swipe right to go back. Tap a dot to jump.
4. Run `python build.py test`, which also checks the app without each card's feature.
