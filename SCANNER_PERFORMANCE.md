# Scanner regression investigation — 15 October 2026

**Follow-up repair:** a surviving playback-statistics gate could prevent all decoding after the first frame. It has been removed. See [SCANNER_REPAIR.md](SCANNER_REPAIR.md) for the reproduced failure, selective fix and current verification. The benchmark figures below describe the preceding performance investigation.

## Findings and scope

The preceding physical-card change introduced measurable extra latency. It alternated horizontal/full/vertical crops, allocated contrast images after cropped misses, re-read successful Numeric results, required two matching frames, reset canvas dimensions on every capture, and added a pause equal to decode time (150–700 ms) after the work had already completed. A frame could invoke the reader up to four times. Every invocation enabled hard search, rotation and inversion again. These WASM operations execute on the main JavaScript thread. There were no overlapping decode calls or JPEG compression; the original photo-import pipeline was unchanged.

Camera ideals also increased from the earlier 1920 × 1080 profile to 2560 × 1440 with a 30 fps constraint. Higher negotiated resolution increases pixel work; its effect on actual optics, exposure and devices has not been measured here. Automatic exposure constraints also had no demonstrated benefit.

The new Alpha ambiguity guard terminated the entire camera session. That is inappropriate for a provisional frame: an improved view could subsequently produce a valid Numeric interpretation. The guard does not identify the real-world cause of this user's failed scan. A fixed local photograph cannot reproduce screen reflections, focus or camera negotiation.

No Git history or earlier source snapshot was available in this standalone directory. The pre-fix regressed scanner and decoder were frozen in `tests/benchmarks/` before editing, with import-path changes and an attempt counter only. The comparison below is against that actual pre-fix implementation, not an invented timing for the older working release. Earlier reports document the full-frame pipeline and successful private photograph-fed camera test.

## Fix

- Restore full-frame, original-pixel capture and the 1920 × 1080 camera ideals; remove the added frame-rate/exposure constraints.
- One broad reader call on the common path. A valid Numeric result already passes checksum state, raw-byte, digit-pair and AIM `]B1` validation; repeating the same reader supplies no independent evidence.
- Remove automatic crops, contrast processing, thumbnails, two-frame gating and decode-duration-based extra delays. Canvas backing dimensions change only when the stream dimensions change. Retain the reader's existing rotation/inversion handling.
- Schedule the next attempt 150 ms after the previous finishes. Jobs cannot overlap. No worker or new scanning feature was added; remaining WASM work still runs on the main thread.
- Retain the narrowly targeted Alpha/Numeric ambiguity check only after automatic Alpha detection. Reject that frame without stopping the stream or converting its data. A subsequent unambiguous Numeric result can proceed. The observed 14-digit profile is an ambiguity warning, not proof of Numeric mode or a university-wide length rule. Inherently ambiguous symbols still require printed-number/photo verification or manual entry.
- Retain existing optional focus/torch controls and camera selection; no visual design, writer, manual entry, preview, saved display, storage or full-screen changes.

## Automated benchmark

Run the dev server, then `node scripts/benchmark-scanner.mjs`. Results are written to ignored `artifacts/scanner-benchmark.json`. The harness generates synthetic images only, compares identical 1920 × 1080 canvas streams at 10 fps, preloads WASM, alternates pipeline order across three trials, and checks exact value **and** format. Timeout is 1800 ms. Timings include stream startup and stop at the scanner callback, excluding preview/generation. No camera optics or real credential is benchmarked.

Mean time to exact scanner result, milliseconds:

| Synthetic fixture | Regressed | Restored | Exact successes, each pipeline |
| --- | ---: | ---: | --- |
| Telepen Numeric, centered | 456.7 | 203.3 | 3/3 |
| Code 128, centered | 392.9 | 203.2 | 3/3 |
| EAN-13, centered | 397.5 | 187.9 | 3/3 |
| ITF, centered | 396.7 | 187.9 | 3/3 |
| Telepen Numeric, outside old crop | 758.0 | 208.0 | 3/3 |
| Telepen Numeric, rotated | 405.5 | 196.1 | 3/3 |

Centered Telepen required four reader calls across two frames before the fix, versus one call on one frame afterward. Off-center Telepen required six calls across three frames versus one. Blank-frame throughput increased from approximately 3.7 to 4.2 processed frames/second, with reader attempts falling from 12 to about 7.7 per trial. Both pipelines correctly produced no card on blank frames. Ambiguous Telepen produced no saved result in either: the old session stopped, while the restored session kept scanning until the benchmark deadline. This is deliberate rejection, not recognition success.

Chromium CDP `TaskDuration` gives a main-thread busy-time proxy, including fixture painting and setup, not OS CPU utilization: centered Telepen averaged 226.8 → 113.1 ms; blank trials averaged 839.4 → 685.5 ms. Benchmark values vary with machine load. Camera-resolution effects are intentionally excluded by supplying identical source dimensions. There is no claim of physical-device speed from these numbers.

## Development diagnostics

The existing development-only panel now aggregates actual camera resolution, processed-frame rate, mean/max decoder time, mean/max reader attempts per frame, successful/unsuccessful frame counts, Telepen rejection counts and fixed rejection reasons. Aggregate updates are throttled to once per second, with a final snapshot on success/stop. No image or credential enters the metric accumulator. These measurements and the panel are excluded from the production build. Processed-frame rate is the decoder throughput, not camera capture fps.

## Verification and remaining checks

- 31 unit tests, 30 browser tests, TypeScript/Vite production build and local HTTPS camera/cleanup checks passed.
- A production-preview smoke check passed app loading, absence of the diagnostic panel and synthetic manual entry → preview → save → reload.
- Synthetic browser cases still cover reduced resolution, rotation, mild blur, partial glare and shadows without the removed preprocessing. Tests cover immediate acceptance from a single valid frame, ambiguity followed by successful Numeric recovery, format round trips, manual entry, save/reload, replacement/deletion and mobile full-screen view.
- An optional private local check passed photograph import, photograph-fed live camera → preview → save, manual equivalence, displayed-pixel decoding and reload against the privately OCR-verified printed number. It used no trace/video/screenshot files, blocked external/upload requests, deleted isolated stored credentials and removed temporary OCR output. The original ignored photograph remains untouched and is not a fixture.
- The previous photograph-fed software path is verified again. Scanning a photograph displayed on a phone, actual physical-card recognition, focus/exposure behavior and speed still require the user's physical camera/iPhone. The exact real-device contribution to the reported regression is unconfirmed. Authorised library-reader compatibility remains untested.

The earlier `PHYSICAL_CARD_SCANNING.md` describes the superseded experiment; this report records the current pipeline.
