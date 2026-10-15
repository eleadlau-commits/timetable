# Library

How busy Bill Bryson Library is right now, with free seats on each floor. It reads the library's public occupancy page (<https://apps.dur.ac.uk/study-spaces/library/bill-bryson/occupancy/display>). It doesn't book anything.

## What it adds

- **A card at the top of today's Day view** (`day.cards`): a bar that fills up as the library fills up, how busy it is (*Plenty of seats*, *Fairly busy*, *Busy*, *Full*, the same bands as the library's page) and the free seats in total. Tap it to see each floor, with free seats per area (e.g. `North 52 · East 1`). It's only shown on today, since the numbers are live.
- **Updates:** every 5 minutes while the card is on screen, or with its refresh button. The last reading is kept, so the card shows something straight away and while offline.
- **Settings → Library:** a switch to hide the card.

## What it needs

- **Requires:** day-view.
- **Uses if present:** web-relay. In the Android app the page is read directly. In the web version the university's server may block that, and then the page is read through the personal relay. Add `apps.dur.ac.uk` to the relay's `ALLOWED_HOSTS` (see `web-relay/extras/README.md`). Without a relay, the card explains this and links to the library's page.

## What it saves on the phone

- `show`: `false` if the card is switched off.
- `last`: `{ at, occupancy }`, the last reading.

## How it reads the page

`occupancy.js` looks for `Level N` headings and `free/total` numbers (also `free of total`), each named by the word before it. It goes by the page's words rather than its layout, so a redesign is less likely to break it. If the page stops having numbers, the card says it couldn't read them. The rules are tested in `tests/occupancy.test.js`.

## How to check it works

1. Run `python build.py serve --test` and open the app on the Day view, on today.
2. In the web version the card will probably say the library's website is blocked, unless a relay is set up. In the Android app it shows the numbers.
3. Run `python build.py test`.
