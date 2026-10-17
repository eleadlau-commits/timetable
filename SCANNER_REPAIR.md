# Scanner frame-delivery repair

## Confirmed defect

The live loop used `getVideoPlaybackQuality().totalVideoFrames`, or `video.currentTime`, to decide whether it should capture a frame. If the optional statistics API returned a constant positive count, the scanner captured the initial image and skipped every later image even though video pixels continued changing. A blank initial image therefore prevented all subsequent barcodes from reaching the reader. There was no stuck decoder promise in this reproduction: the decoder completed once, and the frame-admission check starved it afterward.

This is a demonstrated code defect, not confirmation of the browser behavior on the user's device. Device/browser details and a physical-camera retest are still needed to attribute that reported failure conclusively.

## Available history and investigation

`git status` confirms that this directory is not a Git repository. A project-local search found the frozen regressed scanner/decoder in `tests/benchmarks/` and the existing investigation notes, but no earlier known-working source backup or diff. That snapshot also contains the statistics gate; it is not a suitable working restoration target. No historical implementation was invented, and no project reset was performed.

The notes record an earlier successful full-frame pipeline. Inspection of the current code found full-frame native capture, a local bundled WASM decoder, sequential asynchronous calls, a 150 ms post-completion timer, no worker, no image preprocessing and no repeated Numeric reader pass on the common path. Telepen `]B1` checksum/byte validation and the existing ambiguity rejection are unchanged. Camera ideals remain 1920 × 1080. These paths were not rewritten for this repair.

## Selective repair

Remove the playback-statistics/timestamp gate. Every scheduled iteration with a ready video and nonzero dimensions can capture and decode. The next iteration is still scheduled only after the current decoder call completes; attempts cannot overlap. Existing stop checks, stream cleanup and restart behavior remain active. No new scanner feature, physical-card optimization, worker, fallback or preprocessing was added. Manual entry, verified Numeric generation, preview, saved-card display, persistence and full-screen presentation are untouched.

## Regression evidence

New tests in `tests/card-browser/scanner-liveness.spec.ts` supply a synthetic moving video stream while deliberately reporting a constant playback-statistics counter. They first wait for a blank frame to be processed, then introduce a known-good Code 128 or Telepen Numeric barcode.

- **Before repair:** both tests failed to reach preview; subsequent frames were not captured.
- **After repair:** both pass, assert more than one captured/completed frame, verify successful delivery through preview and save, and scan again after restarting. No browser page errors, console errors or failed WASM requests were observed in these test contexts.
- A focused desktop Chromium run measured two completed frames each: Code 128 average/max decode time **49.4 / 63.1 ms**; Telepen Numeric **46.1 / 56.5 ms**. These include the initial blank frame, exclude camera startup and rendering, and are synthetic single-run measurements, not device benchmarks.
- **31 unit tests and 32 browser tests passed.** Production TypeScript/Vite build and local HTTP/HTTPS secure-context, camera-initialization and cleanup checks passed. Existing format, denial, ambiguity, manual-entry, persistence and mobile-display tests remain green.

The original private photograph was not accessed or modified in this repair, and no real credential is in the new tests or report.

## Required real-device check

Reload the app to fetch the repaired module, start scanning, and test the same supported Google Images barcode and campus-card photograph that previously worked. A real-device test has **not** been performed remotely. Neither restoration of that experience nor physical-card scanning/library-reader compatibility is claimed. Existing unsupported formats remain unsupported, and intrinsically ambiguous Telepen results remain rejected rather than silently converted.

No further physical-card optimization is included in this repair.
