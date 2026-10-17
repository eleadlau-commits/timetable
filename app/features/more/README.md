# More

The **More** tab: everything else the app can do, as cards. For now there's one: the campus card.

## What it adds

- **The More tab** (view id `more`, three-dots icon), with the line *Everything else* next to its title.

## What it offers other features

- **Slot `more.items`:** cards on the More tab. Item: `{ id, label, order, detail?() → short text, photo?, onClick(), visible?() }`. Each card has its `label` and `detail` at the top and a dark bar along the bottom with an arrow, the same style as the cards on Spots. Give it a `photo` (an image address) to show a photo in the bar, fading into the dark from the left. With no cards, the tab shows **Missing content**.

Used by:

| Card | From |
|---|---|
| Campus card | campus-card |

The to-do list, Reminders, Modules, Calendar link and Send to your phone used to be rows here. They're still in the app: the to-do list from *Plan Today* on Home, Reminders from the menu, Modules under the Planner's switch (and in Settings), and the calendar link and *Send to phone* in Settings.

## What it needs

- **Requires:** nothing.

## What it saves on the phone

Nothing.

## How to check it works

1. Run `python build.py serve --test` and tap **More**: one card, Campus card. Tap it: the campus card opens.
2. Run `python build.py test`.
