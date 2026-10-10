# Campus card

Scan the barcode on your campus card with the camera, from a photo, or by typing the number. The app then shows the barcode on screen in case you lose the card. The screen stays on while it's showing.

This feature doesn't depend on the timetable at all, so it can be copied into any other Folio app as it is.

**What it adds:** a card button in the top bar, which opens the Campus card window.

**What it needs:**
- **Features:** nothing.
- **In the Android app:** camera permission (in `feature.json`). For a future iPhone app, the camera explanation is there too.
- **The first time a phone without a built-in barcode reader scans:** an internet connection, to download the ZXing reader.

**Saves:** `card`, the barcode type and value. Brings it across from version 1. It's **not** removed with the timetable.

**Files:** `barcode.js` draws Code 128, Code 39 and Codabar barcodes. It's tested in `tests/barcode.test.js`.
