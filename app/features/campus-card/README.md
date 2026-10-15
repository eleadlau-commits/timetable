# Campus card

Scan the barcode on your campus card with the camera, from a photo, or by typing the number. The app then shows the barcode on screen in case you lose the card. The screen stays on while it's showing.

This feature doesn't depend on the timetable at all, so it can be copied into any other Folio app as it is.

**What it adds:**
- A card button in the top bar (on Home it's in the Menu), which opens the Campus card window.
- **A narrow card on Home** (`home.side`): *Card*, the barcode running down the card (dark on white in both themes, so it stays scannable), and the number under it. Tap it to open the Campus card window. Without a scanned card, Home shows "Missing content: scan your campus card", and tapping it opens the window to scan one.

**What it needs:**
- **Features:** nothing. Uses home if it's there.
- **In the Android app:** camera permission (in `feature.json`). For a future iPhone app, the camera explanation is there too.
- **The first time a phone without a built-in barcode reader scans:** an internet connection, to download the ZXing reader.

**Saves:** `card`, the barcode type and value. Brings it across from version 1. It's **not** removed with the timetable.

**Files:** `barcode.js` draws Code 128, Code 39 and Codabar barcodes, across or (for Home) running down. It's tested in `tests/barcode.test.js`.
