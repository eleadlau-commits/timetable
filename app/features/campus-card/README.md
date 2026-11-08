# Campus card

Scan the barcode on your campus card with the camera, take or choose a photo of it, or type the number. The app then shows the barcode on screen in case you lose the card. The screen stays on while it's showing.

**Barcode types:** Telepen (used by UK university and library cards, **including Durham's**: the long number printed under the barcode), Code 128, Code 39 and Codabar. Durham cards use Telepen in number mode, which is why the app never read them before: neither the phone's own barcode reader nor ZXing knows Telepen, so the app reads it itself.

This feature doesn't depend on the timetable at all, so it can be copied into any other Folio app as it is.

**What it adds:**
- **On Home**, a widget (`home.widgets`) in two sizes. **Wide** is a strip with the barcode across and the number under it. **Tall** (the usual one) is a narrow card with the barcode drawn down it, the number under it, and a purple **Tap** button under that; the card ends just under the button. Tap anywhere on it to open the window (a small box, not full screen, so it's quick to show). Without a card it shows **Missing content: Tap to add your campus card**.
- **On the More tab** (`more.items`): a Campus card card, the only one there.

(It used to be in the menu too. Since the menu became a sliding panel, it's on Home and More only.)

**What it needs:**
- **Features:** nothing.
- **In the Android app:** camera permission (in `feature.json`). For a future iPhone app, the camera explanation is there too.
- **The first time a phone without a built-in barcode reader scans:** an internet connection, to download the ZXing reader.

**Saves:** `card`, the barcode type and value. Brings it across from version 1. It's **not** removed with the timetable.

**Files:**
- `telepen.js` reads and draws Telepen: each character's bars, number mode (two digits per character), the check character. Tested in `tests/telepen.test.js`, including reading backwards (an upside-down card).
- `scan.js` looks for a Telepen barcode in a picture, along lines across it and down it, straight and slanted up to 12° each way (a card that isn't quite straight). It finds the bars by where the line dips darker and rises lighter, with each edge halfway between, so blur, shadows and uneven light don't matter much. Works offline. Also tested in `tests/telepen.test.js`, with small, blurry, slanted pictures like a phone camera's.
- In `telepen.js`, each character is read by trying all 128 and keeping the closest fit, judged mostly by each bar plus the space after it: blur makes thin bars look wider and spaces narrower by the same amount, so those sums stay right even when single widths don't.
- `barcode.js` draws Telepen, Code 128, Code 39 and Codabar barcodes, across or down the screen (`{ vertical: true }`). It's tested in `tests/barcode.test.js`.
- `reader.js` reads barcodes from the camera or a photo: Telepen first (`scan.js`; quick, and it checks itself), then the phone's own barcode reader where there is one, then the ZXing library. Camera pictures are read at full size; each one tries straight lines and one pair of slants, a different pair each time, so it keeps up. Without internet, the camera keeps looking for Telepen (which doesn't need ZXing). For a photo it tries harder: ZXing has a go even if the phone's reader found nothing, then a larger copy of the photo, then the photo turned 30° each way (for a tilted card). While it reads, the button says *Reading the photo…*.
- `zxing-fixes.js` fixes two bugs in ZXing (version 0.21.3) as it loads, tested in `tests/zxing-fixes.test.js`. Both stopped photos from working whenever something dark (a table, a hand) was on the same line as the barcode:
  - **Code 128:** ZXing's search for the start of the barcode broke after its first wrong guess, so anything dark to the left of the barcode hid it.
  - **Codabar:** ZXing took everything from the first dark spot on a line to the last as the barcode (and had the wrong pattern for "+"). The replacement looks for a start and stop letter with white space around them.

**The camera:** it asks for a sharp picture (up to 1920 × 1080; without asking, phones often gave 640 × 480, in which the thin bars blurred together, which is why scanning was much harder than photos), keeps focusing, and zooms in 2× where the phone can, so the card can be held a hand's width away (most phones can't focus closer). A red line shows where to put the barcode, and there's a **Light on** button on phones with a torch. **Take a photo of the card** opens the camera straight away (Folio's `filePicker(…, { capture: 'environment' })`); a photo is sharper still, so it's the surest way. **Choose a photo** picks one already taken.

**How to check photos work:** take a photo of the card on a table, with the barcode across the middle, and choose **Choose a photo** (or use **Take a photo of the card**). A Durham card shows its long number (the one printed under the barcode) and *Telepen (numbers)*.

**Telepen's one catch:** the bars don't say whether they hold digits or text. Library cards use digits, so the app shows digits whenever the bars could be digits. The barcode it draws is exactly the same either way, so scanners read it the same. Photos where the card is small, a little blurry, tilted or sideways should work too. Very dark or very blurry photos may still not.
