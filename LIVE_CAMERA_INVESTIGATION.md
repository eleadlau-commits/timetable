# Live camera versus physical card — 17 October 2026

## Finding and limits

No current software crop, downscale, aspect-ratio distortion or missing Telepen Numeric reader was found. Synthetic images produce identical validated Numeric data through live capture and photo import. These findings do **not** establish why the user's physical card is unreadable: no physical camera/device frame was available for inspection, and no real-device focus, exposure or resolution measurement was obtained remotely. Physical-card success and library-reader compatibility are unconfirmed.

The working acquisition/decoding pipeline was preserved. Changes are lightweight development diagnostics and regression coverage, not a new camera optimization.

## Pipeline comparison

| Property | Live camera | Imported photograph |
| --- | --- | --- |
| Source dimensions | Delivered `videoWidth` × `videoHeight`; ideal request 1920 × 1080 | Browser-decoded bitmap dimensions; a still file may have different detail |
| Application capture | Entire frame, native pixel dimensions | Entire bitmap, native pixel dimensions |
| Cropping and quiet zones | None; the dashed guide is only a CSS overlay | None; user-supplied cropping may already have removed margins |
| Scaling/compression | No application downscale, stretch or JPEG conversion | No application resize/recompression before decoding |
| Orientation | Reader rotation/inversion search enabled | Same reader settings after browser image decoding, including its image-orientation handling |
| Preprocessing | None | None |
| Common validation | `decodeBarcode` → `cardFromResult` → model validation | Same functions; only source metadata differs |
| Numeric requirements | Checksum-valid result, supported bytes/digit pairs, AIM `]B1` | Same |
| Telepen-specific difference | After automatic Alpha only, targeted Numeric read rejects the existing ambiguous known profile without conversion; scanning continues | Does not run this additional live ambiguity guard |
| Scheduling | Await decode completion, then wait 150 ms; no overlapping loop calls | One import operation |

Both use the same bundled, local zxing-wasm reader. The common path leaves Numeric recognition enabled and uses `tryHarder`, `tryRotate` and `tryInvert`. An already validated Numeric result is not decoded again. The independently verified writer, modulo-127 checksum generation, manual entry, storage and saved-card UI were not modified.

The final CSS rules use `object-fit: contain`. The overlay does not modify the captured pixels. The scanner does not use the formerly problematic playback-statistics counter to admit frames.

## Resolution, autofocus and exposure

Requested resolution is an ideal target, not a guarantee; current track settings and the actual video dimensions are distinct measurements. See the [W3C constraints/settings model](https://www.w3.org/TR/mediacapture-streams/). Device negotiations or internal camera processing may deliver different detail from an imported still, even when dimensions are large. The tests deliberately deliver 640 × 480 despite the 1920 × 1080 request and verify that the app reports and decodes the delivered dimensions honestly. This is a synthetic test, not a measurement of the user's camera.

The existing scanner requests continuous autofocus only when advertised and retains capability-gated tap focus/torch. It does not force exposure settings. The loop keeps trying unsuccessful frames while autofocus can settle; no new delay, focus gate or repeated control request was added. Mode metadata does not prove optical sharpness or focus lock. Focus/exposure settings are defined by the [W3C Image Capture API](https://www.w3.org/TR/image-capture/); unavailable settings are shown as not reported.

**Suspected, not confirmed:** insufficient pixels across individual bars, minimum focus distance, autofocus hunting, glare on the physical card, shadow/low contrast, motion and exposure differences. A screen may present a larger and more uniform image; a sharp imported still may contain more useful detail. These are hypotheses requiring device testing. No new preprocessing is justified by the evidence collected here.

## Development diagnostics

The existing panel retains actual frame dimensions, processed frames/second, average/max decoder execution time, current detection status, attempts and rejection counts. It now also shows:

- Requested versus reported stream versus actual captured dimensions. Captured dimensions refresh with the throttled performance update, rather than remaining the startup snapshot.
- Reported focus/exposure modes and whether the existing continuous-focus request was applied, refused or not advertised. Applied is not proof of focus lock.
- Telepen candidate status for the latest frame: not detected, detected, accepted or rejected. The last ambiguity reason is explicitly historical; the normal validation reason still identifies checksum/byte/variant rejection.

Optional settings reads happen at startup and with aggregate snapshots (at most once per second during misses, plus success), never as another image-processing pass. Telemetry only exposes allowlisted modes, dimensions and fixed status strings; camera IDs, labels, images and credential values are excluded. The additional sampling and diagnostic panel are removed from production builds. No credential photo was read or added to fixtures during this investigation.

## Verification

- New parity tests use synthetic Telepen Numeric (horizontal and rotated), Code 128, EAN-13 and ITF. They compare photo-decoded data to live → preview → save output and inspect full-frame capture dimensions. A horizontal sample begins with its quiet zone at the frame boundary to catch cropping errors.
- Existing synthetic tests cover reduced resolution, mild blur, partial glare/shadow, ambiguous Telepen rejection and recovery, frame-delivery liveness, camera controls, cancellation/restart, manual entry, persistence and mobile display.
- Unit tests exercise requested/reported/actual dimension differences, unavailable/throwing settings and mode/identifier redaction.
- Existing browser tests now read displayed diagnostic metrics rather than dynamically importing a second diagnostics singleton after Vite hot reload. This fixes test-harness metric visibility; it does not change decoding.

Run `npm.cmd test`, `npm.cmd run test:browser` and `npm.cmd run build`.

## On-device confirmation

Keep the whole barcode and its white margins visible, hold the card steady, allow focus to settle, and change its angle to remove reflections. Moving slightly farther away may permit focus where moving closer does not. Use the existing torch/tap-focus controls only if available. These are tests, not a guarantee of success.

Compare the same camera's physical-card and screen-image attempts using only the noncredential diagnostics: actual dimensions, frame rate, decoder time, reported focus/exposure, detection status and latest Telepen candidate state. No candidate suggests an image-readability problem rather than this live ambiguity guard; a rejected candidate requires inspecting the fixed validation reason. Neither observation alone proves the physical cause. Do not share the credential value or an unredacted card image.
