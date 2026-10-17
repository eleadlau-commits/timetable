# Fast automatic scanner repair

## Evidence and limits

Compared the exact scanners at `5b957587976b5f0487f25b497b683035da73972d` and `1e8eb002a3703fe2daae54fa55d64c9832a2d97d`, then the repaired scanner. The later version added a video → PNG → browser image → pixels round trip and changed retries to roughly 1 Hz (slower for expensive frames). Camera preferences, full-frame geometry, reader options and the Telepen ambiguity predicate were unchanged. No crop, lossy compression or resolution loss was established between those versions.

A synthetic Telepen symbol visible from 250–650 ms reproduced a scheduling regression: the original scanner recognised it 3/3 times; the one-second scanner missed it 3/3 times. Stable and narrow/blurred symbols still decoded in both historical versions. This demonstrates a missed readable window, **not the complete cause of the user's persistent photograph-on-screen failure**. Focus, glare, motion, exposure and useful pixels remain device-dependent possibilities.

The repair captures native full-frame `ImageData` directly into one reused canvas. Photo import and video share `decodePixels`, identical reader options and existing checksum/byte/AIM validation. Rotation and inversion remain decoder options; there is no extra preprocessing, cropping, scaling or PNG conversion. The established Alpha-versus-Numeric ambiguity guard remains live-only and unchanged in meaning. Numeric results are not converted from Alpha. The verified encoder, manual entry, saved display and storage are unchanged.

## Resolution and scheduling

Initial request: rear camera preference, ideal 1920 × 1080; preserve an explicitly selected camera. On `OverconstrainedError`, retry selection without dimensions. Query capabilities and try higher common pairs, highest first: 3840 × 2160, 2560 × 1440. Independent capability maxima only bound probes; they do not establish support. Exact constraints must be confirmed by both `getSettings()` and video dimensions. Refused/ignored modes fall back; video settling is bounded to approximately 500 ms per supported-settings probe. Restore the original actual mode if probes fail. No camera reacquisition loop or upscaling is used.

Three consecutive capture/decode durations over 650 ms trigger one bounded attempt to reduce the actual camera mode to the next supported common lower mode. There is no repeated per-frame probing. Further device tuning may be needed if that mode remains too expensive. Frames are always captured at the actual video dimensions, including quiet zones and original aspect ratio.

One awaited loop starts immediately and targets 500 ms start-to-start. Four consecutive operations below 100 ms allow 300 ms intervals; eight allow 200 ms. Slower operations reset the fast streak. When processing exceeds the target, a bounded 16–100 ms yield precedes the next capture, rather than another full target interval. No overlapping jobs, image queue, repeated native still capture or manual Capture button. Cancellation immediately stops tracks/timers and suppresses late results. WASM executes on the main thread; a synchronous read already in progress cannot be interrupted until it returns.

Continuous autofocus, optional tap focus, torch, camera selection and positioning guide are retained. No forced exposure or speculative contrast filter was added.

## Measured comparison

Desktop Chromium, warm WASM, synthetic 1280 × 720 / 30 fps camera source, three alternating-order trials per fixture, 2200 ms timeout. Times include startup after decoder warmup. These are automated measurements, **not webcam or iPhone results**. Run `node scripts/benchmark-regression.mjs` from this workspace; historical source is extracted unchanged into ignored artifacts. In a normal checkout the script uses its own Git history. Raw results remain in ignored `artifacts/regression-comparison.json`.

| Synthetic fixture | Original mean recognition ms | Regressed mean ms | Repaired mean ms | Exact matches original / regressed / repaired |
|---|---:|---:|---:|---|
| Stable Telepen Numeric | 53.3 | 51.6 | 42.2 | 3 / 3 / 3 |
| Brief readable Telepen | 409.6 | timeout (2212.4) | 549.5 | 3 / 0 / 3 |
| Narrow, mildly blurred Telepen | 45.9 | 65.6 | 45.5 | 3 / 3 / 3 |
| Rotated Telepen | 40.9 | 53.3 | 54.3 | 3 / 3 / 3 |
| Code 128 | 42.6 | 61.1 | 42.4 | 3 / 3 / 3 |
| EAN-13 | 42.8 | 54.1 | 42.0 | 3 / 3 / 3 |
| ITF | 45.2 | 56.1 | 45.4 | 3 / 3 / 3 |

All three versions rejected the ambiguous Telepen fixture in all trials. The repaired loop is not faster on every fixture; the original short retry also catches the brief window earlier. The controlled evidence supports eliminating PNG overhead and restoring useful retry frequency, not a universal speedup claim. PNG encoding alone cost about 3.4–14.6 ms on the stable fixtures in this run, in addition to image reopening. The repaired loop made zero PNG calls.

Repaired 720p stable Telepen decoder average 31.9 ms, maximum 32.0 ms; rotated 39.5 / 56.6 ms. Separate browser tests measured native synthetic 1080p capture average/maximum 8.9 / 8.9 ms and decode 95.9 / 95.9 ms; synthetic 4K 42.3 / 42.3 ms capture and 252.2 / 252.2 ms decode. Those high-resolution observations are single-frame results, not sustained-device benchmarks. Simulated native 720p fallback, 1080p and 4K were verified. Actual webcam resolution and CPU utilisation have not been measured.

## Diagnostics and verification

Development builds show requested/capability/settings/video dimensions, safe resolution-probe outcomes, focus/exposure, captured and processed counts, measured rate, average/maximum capture and decode time, attempts per frame, success/failure counts, active/rejected flags and Telepen ambiguity reasons. No values, images, camera identifiers or raw exceptions appear. Production omits the panel.

Recognition statuses distinguish no returned candidate, returned unreadable candidate, decoded-but-rejected, Telepen ambiguity, valid result and capture/processing failure. Reader configuration is preserved: the decoder may return no result for an unreadable symbol. Diagnostics state this limitation explicitly; “no candidate” is not proof no barcode exists in the scene. No extra pass is added just for diagnostics.

Validation: **43 unit tests, 45 browser tests and production build passed**. Coverage includes automatic retries/adaptation, transient Telepen, native dimensions and negotiation refusal/readback mismatches, pixel capture failure, no overlap, cancellation/restart, unsupported QR rejection, supported Code 128/EAN-13/ITF/Telepen, rotation, reduced resolution, synthetic blur/glare/shadow, import/manual preview-save-display-reload, encryption, deletion, full screen and focus/torch cleanup. Production smoke verification checks scanning/save/reload with no diagnostic panel.

An additional local-only check of the private reference photograph matched the printed number through local OCR, photo import and photo-fed live pipeline; preview/save, generated-pixel decoding, manual equivalence, full screen and reload passed. It used no external/upload requests and removed its test credential. Neither photograph nor value is included here or in test fixtures.

## Test with the laptop webcam

Open http://127.0.0.1:5173/ (start with `npm.cmd run dev`), reload and select **Scan barcode**. Test an ordinary supported barcode, the campus-card photograph on another screen, then the physical card. Keep all bars and white margins visible, avoid reflections and allow focus to settle. Scanning is automatic; use Cancel to stop. If recognition fails, report dimensions, resolution-probe outcomes, recognition status, counts and timing from the development panel; do not share the value or image.

Photograph-on-screen recognition and physical-card recognition still require user confirmation on the actual webcam. iPhone camera behaviour requires a trusted HTTPS local connection and device testing. No library-gate compatibility is claimed. Stop the development servers with `npm.cmd run stop` or Ctrl+C in the starting terminal.
