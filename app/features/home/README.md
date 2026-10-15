# Home

The **Home** tab, which the app opens on. The date and a large clock on the dark area, then cards from other features at the bottom of the screen, as in `DESIGN.md`.

Home only draws the places. Other features fill them, so deleting one of those features leaves a **Missing content** box in its place and the screen keeps its shape.

## What it adds

- **The Home tab** (view id `home`, house icon), marked as the view the app opens on.

## What it offers other features

Slots, each item `{ order, render() → element, or null to show nothing }`:

| Slot | Where | Used by |
|---|---|---|
| `home.next` | Short lines under the clock | Up next ("Next: …") |
| `home.top` | Full-width cards above the bottom pair | Library |
| `home.main` | The large card at the bottom left | Up next (date strip and lectures) |
| `home.side` | The narrow card at the bottom right | Campus card |

## What it needs

- **Requires:** nothing.

## What it saves on the phone

Nothing.

## How it keeps time

The app redraws once a minute, but not exactly on the minute. While Home is on screen it also redraws just after each new minute, so the clock is never behind. On phones set to 12-hour time, a small AM or PM sits next to the clock.

## How to check it works

1. Run `python build.py serve --test`. The app opens on Home.
2. Check the clock changes on the minute, in light and dark mode.
3. Run `python build.py test`, which also checks the app without each card's feature.
