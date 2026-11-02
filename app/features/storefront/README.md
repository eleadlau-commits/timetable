# Storefront

The **Your shop** tab in the business version: everything about the owner's shop on one page, as cards. It sits between Home and Spots in the tab bar, and only shows in the business version (see the welcome feature).

## What it adds

- **The Your shop tab** (view `storefront`), with the shop's name next to the title. Each card has the same frame: a title, a tag such as *Live* or *Being checked*, what's inside, and one big button. Today the cards come from the shop feature:
  - **Your shop on Spots**: the card exactly as students see it (photo, Open now, deal, links), and *Change details*.
  - **Student deal**: the deal that's live, and a new one being checked, with *Change the deal*.
  - **How it's going**: four weeks of how many students saw the shop, as bars, and one sentence about it.
- **Choose which of these are on Home**, at the bottom, which opens Customise Home. Home only shows the cards the owner picks.

Later features add their own cards here, such as bookings.

## For other features

Slot `storefront.cards`. Item: `{ id, order, title, render() → element, heading?() → the shop's name, tag?() → { text, tone?: 'live' | 'wait' | 'off' } or null, action?() → { label, onClick, primary? } or null, visible?() → false to hide it }`. The rules for which cards show and the name at the top are in `rules.js`, tested in `tests/`.

## What it needs

- **Requires:** nothing.
- **Uses if present:** welcome (the tab only shows in the business version; without it there's no business version, so no tab), home (the Choose link opens Customise Home through `home.tools`).

## What it saves on the phone

Nothing.

## How to check it works

1. Run `python build.py test`.
2. Run `python build.py serve --test`, choose *I run a business* (Settings → Using the app as), and open **Your shop**. Signed out, it shows *Set up your shop*.
