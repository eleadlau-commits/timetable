# User-triggered barcode capture

**Historical implementation:** the manual Capture barcode button and native still-capture code below have been removed. See [AUTOMATIC_SCANNING.md](AUTOMATIC_SCANNING.md) for the current fully automatic photograph loop. This document records the preceding experiment.

The scanner's **Capture barcode** button takes one still image and uses the exact `decodePhoto` function used by photograph import. Live scanning, import, manual entry, the verified Telepen Numeric encoder, preview/save, persistent storage and full-screen presentation remain available.

## Capture path

- Prefer `ImageCapture.takePhoto()` on the active video track. If available, request the camera's advertised maximum photo dimensions within the shared decoder's 48-million-pixel limit. Unsupported capability queries use default photo settings. Native photo quality/resolution depend on the browser and camera.
- If the still API is missing, refuses capture or returns an empty/oversized file, copy the whole video at `videoWidth` × `videoHeight` to a temporary canvas and encode losslessly as PNG. This fallback preserves native stream pixels and quiet zones; it cannot manufacture higher detail than the stream supplies.
- Do not crop to the guide, stretch, resize, modify stream constraints or automatically repeat high-resolution captures. No dependency, CDN or account was added.
- Await any active live decoder call before taking the photo. Pause live decode scheduling for the complete capture/decode operation; the preview stream keeps running. Disable the button while busy, reject duplicate capture requests, and resume the ordinary 150 ms post-completion live loop after failure.
- Pass the temporary Blob to `decodePhoto`, including its existing rotation/inversion search, broad supported-format reading, checksum/byte validation and `]B1` Numeric validation. Existing photo-import interpretation rules apply; Numeric data is not inferred from length. The generated barcode still undergoes the existing exact round-trip verification before preview.
- On success, release the camera and use the existing preview/confirmation/save UI. On failure, show **Barcode not recognised. Try again.**, keep the camera open, and allow another attempt. After a manual failure, unsupported live results do not dismiss the camera while the same card is being adjusted. Normal live-only behavior before manual capture is unchanged.
- Cancellation discards late capture results, and cancellation after browser image opening is checked before invoking the reader. Temporary canvases are cleared and decoded bitmaps closed. Blobs are only transient in-memory objects: no image persistence, upload, logging or fixture creation.

## Diagnostics and verification

Development builds show capture method, bitmap dimensions, whether the shared reader was invoked, capture outcome, format/AIM and a fixed safe rejection reason. The fields retain the last capture result when ordinary live scanning resumes. No payload, image, camera identifier or card number is displayed. The diagnostic panel is excluded from production builds.

Synthetic browser coverage includes native 1280 × 960 capture from a 640 × 480 preview, live-loop pause with continuing video playback, button debouncing, shared Telepen Numeric `]B1` decode, quiet zones, native-frame fallback for missing/refused APIs, unreadable/unsupported captures and retries without camera reacquisition, cancellation, existing-card preservation, preview/save/reload and a 320-pixel mobile viewport. Existing permission, live scanning, import, manual entry, formats, storage and full-screen regressions remain in the full suite.

Run `npm.cmd test`, `npm.cmd run test:browser` and `npm.cmd run build`.

## Running and device limits

From the Campus Card project, run `npm.cmd install` after a fresh clone, then `npm.cmd run dev`. Open `http://127.0.0.1:5173/`, choose **Scan barcode**, position the complete barcode with white margins, wait for focus to settle and press **Capture barcode**. Live scanning continues as the alternative until a still capture starts.

For an iPhone on the same private Wi-Fi, use `npm.cmd run dev:iphone` and the private HTTPS URL it prints. Install/trust the development CA and allow camera access as described in README. No public exposure, paid service or account is required. Native still capture may be unavailable; diagnostics identify when the fallback uses only the video stream's native resolution.

Stop the development servers with `npm.cmd run stop` (or Ctrl+C in their terminals). Actual autofocus, native photo API availability/resolution, reflection handling, latency and physical-card recognition still require testing on the user's device. No physical-card or authorised gate-reader compatibility is claimed.
