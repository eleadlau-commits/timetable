# Library

How busy Bill Bryson Library is right now, with free seats on each floor. It reads the library's public occupancy page (<https://apps.dur.ac.uk/study-spaces/library/bill-bryson/occupancy/display>). It doesn't book anything.

## What it adds

- **A card on Home** (`home.top`). Folded, it shows *Library*, a tag saying how busy it is (*Plenty of seats*, *Fairly busy*, *Busy*, *Full*, the same bands as the library's page), the free seats, and a bar: filled as far as the library is full, a dot where it ends, then a dotted line for the seats still free. *Busy* and *Full* are orange; quieter times are calm. Tap it to unfold each floor, with free seats per area (e.g. `North 52 · East 1`). It stays folded or unfolded as you left it.
- **Missing content:** when there's no reading from the last two hours (offline, the website blocked in the web version, or the page couldn't be read), Home shows "Missing content" with the reason. Tap it to try again (or, when the website is blocked, to open Settings).
- **Updates:** every 5 minutes while the card is on screen, or with its refresh button. The last reading is kept, so the card shows something straight away and while offline.
- **Settings → Library:** a switch to hide the card.

## What it needs

- **Requires:** nothing.
- **Uses if present:** home (without it the card has nowhere to go), web-relay. In the Android app the page is read directly. In the web version the university's server may block that, and then the page is read through the personal relay. Add `apps.dur.ac.uk` to the relay's `ALLOWED_HOSTS` (see `web-relay/extras/README.md`). Without a relay, the card explains this and links to the library's page.

## What it saves on the phone

- `show`: `false` if the card is switched off.
- `last`: `{ at, occupancy }`, the last reading.
- `open`: `true` if the card is unfolded.

## How it reads the page

`occupancy.js` looks for `Level N` headings and `free/total` numbers (also `free of total`), each named by the word before it. It goes by the page's words rather than its layout, so a redesign is less likely to break it. If the page stops having numbers, the card says it couldn't read them. The rules are tested in `tests/occupancy.test.js`.

## How to check it works

1. Run `python build.py serve --test` and open the app. Home shows the card with the sample reading from `app/tests/seed.js`.
2. With real data: in the web version the card will probably say the library's website is blocked, unless a relay is set up. In the Android app it shows the numbers.
3. Run `python build.py test`.
