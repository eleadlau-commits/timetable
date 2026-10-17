# Campus Card: scanner, display and storage report

The app is standalone. All changes are inside Campus card; the separate Journey Planner is untouched. See README.md for local HTTP and private Wi-Fi HTTPS startup.

**Update:** the supplied physical card is now confirmed as Telepen Numeric / ]B1, START 1 / STOP 1, and direct manual Numeric entry is enabled. See [DURHAM_BARCODE_FINDINGS.md](DURHAM_BARCODE_FINDINGS.md) for evidence and the latest 20-browser-test results. Earlier missing-photo/manual-blocking statements below are historical; storage limits remain current.

## What was diagnosed

The previous browser reader was @zxing/browser/@zxing/library. It had no Telepen decoder, and the app's own model also rejected all Code 128 results. It requested only a rear-facing preference, with no high-resolution or focus constraints and no camera chooser. Its saved-card UI existed but was unreachable for rejected formats, and its credential disappeared on reload because storage was memory-only.

These are confirmed software limitations. They do not establish the exact cause on the user's physical card: **no photograph was available in this turn's attachments**, and no real card, camera or library gate was tested. A long number, scanner brand or visual density is not evidence of a particular symbology. The exact Durham format remains unconfirmed until a real image is decoded locally.

## Scanner and photograph import

The app now uses **zxing-wasm 3.1.5**, backed by ZXing-C++, for reading and writing. Its [official format table](https://github.com/Sec-ant/zxing-wasm#supported-barcode-formats) includes Telepen Alpha, Telepen Numeric, Code 128 and ITF. The old barcode libraries were removed.

The WASM file is bundled as a same-origin Vite asset. The default CDN loader and decoder logging are disabled. Nothing in the scan or photograph path uploads images or credentials. Imported photos are decoded using browser image decoding and transient canvas data; image bitmaps and canvases are released after processing, and the file input is reset. No photo or original barcode image is persisted.

Live capture requests rear camera preference and 2560 x 1440 ideal resolution, uses continuous focus where the browser exposes it, and allows switching cameras after permission. The decoder processes actual camera frames rather than the CSS preview crop, at a throttled cadence without overlapping decodes. The complete barcode must remain in frame. The preview uses contain rather than cropping wide bars.

The UI distinguishes insecure context, permission denial, missing/busy camera and decoder initialization failure. Camera tracks stop on cancellation, success, unsupported scan, camera switch, backgrounding, timeout and unmount, including pending initialization races. HTTPS with a trusted certificate remains necessary on iPhone; HTTP localhost is suitable on desktop.

## Supported reproduction subset and accuracy

Accepted formats: Telepen Numeric, Telepen Alpha and ordinary Code 128 containing printable ASCII data, ITF with digit pairs, basic Code 39, EAN-13 and EAN-8. Not every format supported by the decoder is accepted for reproduction. GS1/control-code variants, unclassified Telepen roots, arbitrary binary content, unsupported alphabet variants and 2D symbols are rejected. Numeric Telepen with special X/compression cases is not accepted unless represented by the supported even digit-pair subset. No Durham-specific length is assumed; a 512-character resource limit prevents pathological inputs. See SCANNER_DIAGNOSTICS.md for the latest error investigation, development diagnostics and display sizing fix.

Decoded data is stored as an exact string plus raw payload bytes, canonical format and AIM symbology identifier. Writer output must decode to the same bytes, text, format and identifier before preview/save and again on load. Required symbol checksums are generated and checked by the engine; EAN check digits are also validated explicitly. Leading zeros remain strings. Optional application check digits are not silently stripped. Ambiguous/multiple accepted barcodes require cropping the photo. No cross-format conversion is used.

The writer determines symbol structure and quiet zones. Display canvases have proportional width/height, nearest-neighbor rendering, black bars and white backgrounds. Full-screen mode is a viewport-sized modal suitable for Safari without requiring the browser Fullscreen API. Turn the phone to landscape if a particularly dense barcode needs more width. Browser brightness is not changed; the full-screen view gives a short Control Centre hint.

## Manual entry without guessing

Manual input uses a numeric mobile keyboard, rejects nondigits and preserves leading zeros. Until Durham's printed-number mapping is verified, a typed number must match the exact decoded value of the user's scanned/imported card. On a fresh install, enter the digits and choose Verify with photo. A successful matching photo produces the same preview as camera scanning, and Save card stores it. If a photo is verified first, enter its exact number and choose Preview barcode. A saved card can also supply its verified format when replacing it with the same typed value.

A different typed number requires a new scan/photo. This deliberately does not offer a format selector or silently assume that printed digits alone encode a Telepen/Code 128 credential.

## Saved-card screen

After confirmation, the saved barcode becomes the default screen. It reappears on page reload if storage succeeds. Full-screen barcode is prominent; Replace and Delete are discreet. Replacement/deletion require confirmation; failed writes leave the candidate available for retry. Deletion clears both the credential and the in-memory verified value. Failed/corrupt saved-card loading offers retry or confirmed deletion rather than trapping the user.

## Persistent storage and its limits

### Browser development

BrowserCardStorage uses IndexedDB to atomically store AES-256-GCM ciphertext, a fresh random IV and a non-exportable CryptoKey. A new key is generated per save. Plaintext card data is never written to localStorage or IndexedDB. Deletion removes the complete encrypted record and its key. The previous record remains if the IndexedDB replacement transaction fails.

**This is development persistence, not production access-credential security.** Same-origin JavaScript can invoke decryption with the stored key, including compromised scripts or an attacker controlling this origin. Non-exportability is not a hardware security boundary. Browser profile access, extensions, storage eviction/private browsing and clearing site data remain limitations. There is no passphrase or biometric unlock. Storage is scoped to the exact origin: HTTP desktop and HTTPS iPhone addresses have separate credentials, and an IP/port change can create a different origin. A collapsed Browser development storage disclosure explains the limitation without cluttering the card view.

The barcode displays offline once the app and WASM are loaded. Persistent storage survives an online reload, but an offline browser cold start is not promised: no service worker is installed. An installed native bundle can package those assets locally.

### Capacitor iOS

The app now selects NativeCardStorage on native Capacitor platforms and uses **@aparajita/capacitor-secure-storage 8.0.1** through an actual driver, rather than an unwired placeholder. [Plugin documentation](https://github.com/aparajita/capacitor-secure-storage) describes its iOS Keychain implementation. Reads/writes/deletion explicitly disable iCloud synchronization; writes use whenUnlockedThisDeviceOnly. The plugin's browser fallback is never used for card storage. Native storage failures do not fall back to plaintext browser storage.

The dependency targets Capacitor 8. Future iOS release still needs a generated/synced Capacitor iOS project, NSCameraUsageDescription and actual iPhone testing of permission/focus, Keychain restart, locked-device behavior, replacement/deletion and app lifecycle. Keychain items can survive app uninstall; use Delete before uninstalling when removal is required. Native hardware-backed behavior cannot be verified on this Windows web-only project.

## Verification

Synthetic data only; no real credential/image is committed as a fixture. Tests generate barcodes/images in memory.

- Unit validation/storage tests cover format acceptance, checksums, exact value/leading zeros, manual mapping refusal/match, replacement/deletion and native-driver errors.
- Browser tests cover Telepen camera initialization/decode, high-resolution/rear constraints, camera switch cleanup, rotated compressed JPEG import, manual entry/photo verification, save/display, encrypted non-exportable IndexedDB records, reload as default screen, replacement/deletion confirmation, mobile full-screen aspect ratios, offline in-session display, permission/insecure errors, unsupported QR/photo input, write failures and camera cancellation.
- Round-trip tests cover Telepen Numeric, Telepen Alpha, Code 128, ITF, Code 39, EAN-13 and EAN-8.
- The HTTPS local smoke test checks certificate trust/hostname validation, private-file denial, browser secure context, synthetic-device getUserMedia preview and track release.

Final checks on 15 October 2026: **24 unit tests passed; 12 browser tests passed; private HTTPS smoke test passed; TypeScript/Vite production build passed.** The mobile test also decodes a screenshot of the barcode's actual displayed pixels at 320px, preserving the synthetic original value. Native bridge logging is disabled in capacitor.config.ts. There is no fallback to memory or plaintext storage when browser persistence/native secure storage fails.

Commands:

```powershell
npm.cmd test
npm.cmd run test:browser
npm.cmd run build
npm.cmd run test:local  # requires both dev servers from README
```

Not verified: decoding the user's actual photograph (unavailable), real Durham symbology/printed-number mapping, physical iPhone optics, native Keychain on hardware, or gate acceptance. **No claim is made that this barcode works at Durham library gates.** Decode a legitimately issued card locally and perform an authorized physical scanner test before relying on it for entry.
