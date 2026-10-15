# Library

How busy Bill Bryson Library is right now, with free seats on each floor. It reads the library's public occupancy page (<https://apps.dur.ac.uk/study-spaces/library/bill-bryson/occupancy/display>). It doesn't book anything.

## What it adds

- **A card on Home** (`home.top`): *Library*, how busy it is (*Plenty of seats*, *Fairly busy*, *Busy*, *Full*, the same bands as the library's page; busy and full are orange), the free seats, and a bar that fills up as the library fills up, with a dotted line for the free part. Tap it to open the Study tab. When there are no numbers yet it shows **Missing content** with the reason (for example, that the web version needs the relay).
- **A card on the Study tab** (`study.cards`): the same, plus free seats on each floor with a small bar, the areas of floors that have more than one (e.g. `North 52 · East 1`), when it was last checked, a refresh button and a link to the library's page.
- **Updates:** every 5 minutes while a card is on screen, or with the refresh button. The last reading is kept, so the cards show something straight away and while offline.
- **Settings → Library:** a switch to hide the cards.

## What it needs

- **Requires:** nothing.
- **Uses if present:** home and study, where the cards go.
- **Uses if present:** web-relay. In the Android app the page is read directly. In the web version the university's server may block that, and then the page is read through the personal relay. Add `apps.dur.ac.uk` to the relay's `ALLOWED_HOSTS` (see `web-relay/extras/README.md`). Without a relay, the card explains this and links to the library's page.

## What it saves on the phone

- `show`: `false` if the card is switched off.
- `last`: `{ at, occupancy }`, the last reading.
- `open`: no longer used. It remembered whether the old Day view card was unfolded; the key is left alone.

## How it reads the page

`occupancy.js` looks for `Level N` headings and `free/total` numbers (also `free of total`), each named by the word before it. It goes by the page's words rather than its layout, so a redesign is less likely to break it. If the page stops having numbers, the card says it couldn't read them. The rules are tested in `tests/occupancy.test.js`.

## How to check it works

1. Run `python build.py serve --test`. The card is on Home; tap it for the Study tab.
2. In the web version the card will probably say the library's website is blocked, unless a relay is set up. In the Android app it shows the numbers.
3. Run `python build.py test`.
