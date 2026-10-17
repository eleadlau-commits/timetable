# Automatic photograph scanning

Opening **Scan barcode** now starts one automatic native-frame → lossless PNG → `decodePhoto()` loop. There is no Capture barcode button, capture loading state, button-specific error, parallel direct-frame decoder or repeated `ImageCapture.takePhoto()` call. Photo import, manual number entry, verified generation, preview/save, persistence and full-screen display remain available.

## Investigation: confirmed versus suspected

The previous live path passed full-frame `ImageData` directly to the reader, roughly every decode duration plus 150 ms. Photo import decoded a Blob through browser image opening and a full-size canvas. Both already shared the underlying reader, rotation/inversion search and checksum/byte/model checks. Live scanning additionally rejected the existing ambiguous Telepen Alpha/Numeric profile. Neither path cropped the guide, resized the image or removed its quiet zones. A missing Numeric reader or demonstrated encoder defect was not found.

These are confirmed software differences, **not a confirmed physical cause**. Imported stills can have different focus, illumination, dimensions and useful detail from webcam video. Minimum focus distance, autofocus settling, reflections, exposure, motion and insufficient pixels across individual bars remain hypotheses. No physical webcam or real card has been tested in this change. Converting video to PNG preserves its pixels; it cannot create detail absent from the source.

## Camera resolution

The initial request remains the already-supported ideal **1920 × 1080**, with rear-camera preference and exact camera selection when chosen. An `OverconstrainedError` falls back to camera selection without dimension constraints. There is no forced frame rate or exposure, upscaling, extra resolution negotiation, or silent switch to a different camera. Existing capability-gated focus/torch controls remain.

`getCapabilities()` is queried when available. Development diagnostics now show independent width/height min/max ranges; maxima do not prove a jointly supported resolution or acceptable performance. `getSettings()` and actual `videoWidth`/`videoHeight` are reported separately. Actual pixels govern capture dimensions. Higher-than-1080p modes are not forced without device performance evidence, given the previous regressions.

Tests verified simulated delivered **1920 × 1080** frames and a simulated **640 × 480** fallback. The user's actual webcam resolution, higher-resolution support and optical performance remain to be measured using this panel.

## One shared decoding pipeline

1. Capture the entire video into a reusable canvas at its native dimensions. No guide crop, stretching or preprocessing.
2. Asynchronously encode one lossless PNG Blob, then invoke the same `decodePhoto()` used by file import.
3. Open the image, read full-size pixels and use the existing decoder and checksum/byte/AIM validation. Preserve rotation/inversion handling.
4. Retain the automatic scanner's existing Telepen ambiguity guard as an optional post-validation hook on the same pixels. It only performs its pre-existing Numeric check after an Alpha result; it does not repeat the broad reader on valid Numeric results. No validation condition or verified writer changed. File import's existing default behavior is unchanged.
5. On a valid result, stop camera tracks and enter the existing preview/confirmation. On unreadable, unsupported or failed frame capture, keep trying quietly. Unsupported formats remain rejected; they do not silently become saved cards.

No photo is saved, uploaded or logged. The PNG Blob is transient, browser image bitmaps are closed, the photo decoder's temporary canvas is cleared and the reusable capture canvas is cleared on stop. Cancellation is checked after asynchronous capture/image opening and before reader invocation. No additional frames or late successful result are delivered after cancellation.

## Scheduling and performance

There is exactly one loop, with one awaited capture and photograph decode. The next timer is created after completion. For total capture/decode duration `d`, the start-to-start target is `max(1000 ms, 2 × d)`; the post-completion pause is at least 150 ms. Responsive devices run at about 1 Hz, slow devices automatically run less often rather than accumulating a queue. The former 30-second recognition timeout was removed so routine misses do not dismiss the scanner. Cancel, camera switching and existing background-page cleanup stop the active session.

Desktop Chromium synthetic observations (single runs, machine-load dependent):

| Delivered synthetic frame | PNG capture | `decodePhoto` execution | Measured cadence |
| --- | ---: | ---: | --- |
| 1920 × 1080, valid Telepen Numeric | 31.2 ms | 238.1 ms | One successful frame; insufficient intervals for measured frequency |
| 640 × 480, repeated blank frames | 10.8 ms, sampled attempt | 58.8 ms average / 85.1 ms max | 0.99 Hz |

These measure the automatic photo path, not physical-camera accuracy, OS CPU utilization or optical quality. PNG encoding/browser image opening add work compared with the old direct-pixel path; the lower capture rate bounds that recurring work. WASM decoding still runs on the main thread. No worker or expensive image enhancement was added. Photos retain the existing 25 MB / 48-million-pixel safety limits.

## Diagnostics and tests

Development-only fields show requested, negotiated and actual resolution; capability ranges; focus/exposure metadata; captured dimensions and count; successful/unsuccessful attempts; average/max photo-decode time; capture time; measured start frequency; `decodePhoto()` and reader invocation; format/AIM; and safe validation/failure reasons. Frequency says Measuring until at least two capture starts exist. No card values, images, device IDs or labels enter the diagnostics. Production excludes the panel and metric sampling.

Tests cover 1080p requests, actual dimensions and fallback, shared photo decoding, one loop during slow encoding/image opening, automatic retries after empty/unsupported/failed captures, unchanged ambiguity rejection, no native still API use, no manual button, cancellation/bitmap cleanup, camera restart, rotation, glare/shadow fixtures, quiet zones, mobile display, import, manual entry and persistence. Synthetic credentials only.

Run `npm.cmd test`, `npm.cmd run test:browser` and `npm.cmd run build`.

## Try the physical card

Run `npm.cmd run dev` and open `http://127.0.0.1:5173/` on the laptop. Select **Scan barcode**; scanning starts without another button. Keep the whole barcode and white margins visible, hold steady and allow several attempts for focus to settle. Compare slightly different distances and angles to avoid reflections. If available, use the existing camera selector, tap focus or torch.

Compare noncredential panel fields for the physical card and the known working screen photograph. Report actual dimensions, frequency, decode time, detection/Telepen rejection status and the fixed rejection reason; do not share the card value or unredacted image. Press **Cancel scan** to stop. `npm.cmd run stop` stops the dev servers. Private iPhone HTTPS remains available through `npm.cmd run dev:iphone` with the README certificate steps.

Physical-card recognition and authorised library-reader compatibility require the user's own test. They are not claimed by these automated results.
