# Home

The **Home** tab, which the app opens on. At the top, on the dark area, **four small pages you swipe between**, with a photo of Durham behind them. Then **widgets** from other features on a grid, filling the rest of the screen down to the tab bar, as in `DESIGN.md`. Home doesn't scroll (except on a very short screen). People choose the widgets and the photo with the **Customise Home** feature.

- **The pages:** each is only about as tall as the clock. Swipe left or right on the dark area, or tap the small knife-shaped dots under it. The pages follow your finger and settle on the next one, stopping at the first and last. Home always opens on the first page, and goes back to it when the app comes back to the screen.
  1. **The clock:** the date and the clock (40 px).
  2. **Plan Today** (from To-do list): how many things are due today, and an **Open** button.
  3. **Explore** (from Spots), with an **Open Spots** button.
  4. **Plan a journey** (from Journey), with a *Soon* button.
- **The photo:** `photos/durham.jpg` (or the one the person chose in Customise Home), shown half see-through behind the pages. It's clearest at the bottom right and fades out towards the top left, so the words stay readable. It stays still while the pages slide. The area is short and wide now, so a photo cut to that shape works best. Without the file there's simply no photo. **How to add or change it: see `photos/README.md`.**
- **A page's row** (class `home-page-row` in `home.css`): a title (`home-page-title`) and a line (`home-page-line`) on the left, and an outlined button (`home-button`: a solid white outline, a see-through inside) on the right.
- **The widgets:** a grid 3 columns wide, with as many rows as fit on the phone (each at least 56 px; at least 4 rows). A widget comes in up to three sizes: **wide** (the whole width, 1 row, a strip), **tall** (1 column, 3 rows) and **large** (2 columns, 3 rows). They go in, in order, at the first place they fit (left to right, top to bottom). Tall and large ones then stretch down to the bottom when nothing is under them, so the screen stays full. The rules are in `grid.js`, tested in `tests/grid.test.js`.
- **As it comes:** the library as a wide strip, then today's lectures (large) next to the campus card (tall), both stretching to the bottom. That's the same as Home looked before widgets.
- **The pencil** at the right of the dots is Customise Home's (`home.tools`).

Home only draws the places. Other features fill them. Deleting a widget's feature simply leaves its space free; with no widgets at all, Home shows **Missing content**.

## What it adds

- **The Home tab** (view id `home`, house icon), marked as the view the app opens on.

## What it offers other features

Slots, each item `{ order, render() → element, or null to show nothing }`:

| Slot | Where | Used by |
|---|---|---|
| `home.pages` | More pages at the top, after the clock. Item `{ id, order, render() }`. One short row: use `home-page-row`, `home-page-title`, `home-page-line` and `home-button`. | To-do list (Plan Today, order 5), Spots (Explore, order 10), Journey (Plan a journey, order 20) |
| `home.widgets` | Widgets on the grid. Item `{ id, label, order, sizes, start?, audience?, render(size) }`: `audience` says which version of the app it's in (the welcome feature): nothing for students only, `'business'` for the business version only, `'everyone'` for both (pages can say it too); `sizes` lists the sizes it can be drawn in (`'wide'`, `'tall'`, `'large'`), the first being how it starts out; `start: false` leaves it off Home until someone adds it; `render(size)` returns an element that fills the space, or null for nothing. | Library (wide, tall), Up next (large, tall, wide), Campus card (tall, wide); off until added: Study timer (wide, tall), To-do list (tall, wide), Student deals (wide, tall); business version: My card (large, tall, wide), This week (tall, wide), My deal (wide, tall) |
| `home.layout` | The person's choices. Only the first item is used. Item `{ widgets() → [{ id, size }] or undefined for the usual ones, photo() → an address or undefined for Home's own }`. | Customise Home |
| `home.tools` | Small buttons on the dark area, at the right of the dots. Item `{ id, label, icon, order, onClick() }`. | Customise Home (the pencil) |

**Service `home`:** `widgets()` → `[{ id, label, sizes }]`, `usual()` → the widgets as the app comes, `rows()` → how many rows fit on this phone, `pack(list)` and `fits(list)` (from `grid.js`, for this phone), `sizes`, and `photo` (the address of Home's own photo).

## What it needs

- **Requires:** nothing.

## What it saves on the phone

Nothing.

## Files

- `Home.js`: the tab, its places and the photo.
- `pages.js`: the swipeable pages and dots.
- `grid.js`: the widget grid's rules (sizes, where each widget goes, how many rows fit), tested in `tests/grid.test.js`.
- `pager.js`: the swiping rules (how far the pages follow the finger, which page they settle on), tested in `tests/pager.test.js`.
- `photos/`: where the Durham photo goes (`durham.jpg`, see `photos/README.md`).

## How it keeps time

The app redraws once a minute, but not exactly on the minute. While Home is on screen it also redraws just after each new minute, so the clock is never behind. On phones set to 12-hour time, a small AM or PM sits next to the clock.

## How to check it works

1. Run `python build.py serve --test`. The app opens on Home.
2. Check the clock changes on the minute, in light and dark mode, and that the screen doesn't scroll.
3. Swipe left on the dark area: Plan Today, Explore, then Plan a journey; the dots follow. Swipe right to go back. Tap a dot to jump.
4. Tap the pencil and change the widgets; Home changes behind the pop-up.
5. Run `python build.py test`, which also checks the app without each widget's feature.
