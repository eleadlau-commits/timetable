# Campus card

Scan the barcode on your campus card with the camera, from a photo, or by typing the number. The app then shows the barcode on screen in case you lose the card. The screen stays on while it's showing.

**Barcode types:** Telepen (used by UK university and library cards, **including Durham's**: the long number printed under the barcode), Code 128, Code 39 and Codabar. Durham cards use Telepen in number mode, which is why the app never read them before: neither the phone's own barcode reader nor ZXing knows Telepen, so the app reads it itself.

This feature doesn't depend on the timetable at all, so it can be copied into any other Folio app as it is.

**What it adds:**
- **On Home** (`home.side`): a narrow card with the barcode drawn down it, the number under it, and a purple **Tap** button under that; the card ends just under the button. Tap anywhere on it to open the window (a small box, not full screen, so it's quick to show). Without a card it shows **Missing content: Tap to add your campus card**.
- **On the More tab** (`more.items`): a Campus card card, the only one there.

(It used to be in the menu too. Since the menu became a sliding panel, it's on Home and More only.)

**What it needs:**
- **Features:** nothing.
- **In the Android app:** camera permission (in `feature.json`). For a future iPhone app, the camera explanation is there too.
- **The first time a phone without a built-in barcode reader scans:** an internet connection, to download the ZXing reader.

**Saves:** `card`, the barcode type and value. Brings it across from version 1. It's **not** removed with the timetable.

**Files:**
- `telepen.js` reads and draws Telepen: each character's bars, number mode (two digits per character), the check character. Tested in `tests/telepen.test.js`, including reading backwards (an upside-down card).
- `scan.js` looks for a Telepen barcode in a picture, along lines across it and down it, judging dark and light against the surroundings so shadows don't matter. Works offline. Also tested in `tests/telepen.test.js`.
- `barcode.js` draws Telepen, Code 128, Code 39 and Codabar barcodes, across or down the screen (`{ vertical: true }`). It's tested in `tests/barcode.test.js`.
- `reader.js` reads barcodes from the camera or a photo: the phone's own barcode reader where there is one, then Telepen (`scan.js`), then the ZXing library. For a photo it tries harder: ZXing has a go even if the phone's reader found nothing, then a larger copy of the photo, then the photo turned 30° each way (for a tilted card). While it reads, the button says *Reading the photo…*.
- `zxing-fixes.js` fixes two bugs in ZXing (version 0.21.3) as it loads, tested in `tests/zxing-fixes.test.js`. Both stopped photos from working whenever something dark (a table, a hand) was on the same line as the barcode:
  - **Code 128:** ZXing's search for the start of the barcode broke after its first wrong guess, so anything dark to the left of the barcode hid it.
  - **Codabar:** ZXing took everything from the first dark spot on a line to the last as the barcode (and had the wrong pattern for "+"). The replacement looks for a start and stop letter with white space around them.

**How to check photos work:** take a photo of the card on a table, with the barcode across the middle, and choose **Use a photo of the card**. A Durham card shows its long number (the one printed under the barcode) and *Telepen (numbers)*.

**Telepen's one catch:** the bars don't say whether they hold digits or text. Library cards use digits, so the app shows digits whenever the bars could be digits. The barcode it draws is exactly the same either way, so scanners read it the same. Photos where the card is small, a little blurry, tilted or sideways should work too. Very dark or very blurry photos may still not.
