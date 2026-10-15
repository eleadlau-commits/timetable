# Study

The **Study** tab, for places to study. It only draws the place; other features add cards to it.

## What it adds

- **The Study tab** (view id `study`, book icon), with the line *Places to study* next to its title.

## What it offers other features

- **Slot `study.cards`:** cards on the Study tab. Item: `{ order, render() → element, or null }`. Library uses it. With no cards, the tab shows **Missing content**.

## What it needs

- **Requires:** nothing.

## What it saves on the phone

Nothing.

## How to check it works

1. Run `python build.py serve --test` and tap **Study**.
2. Run `python build.py test`.
