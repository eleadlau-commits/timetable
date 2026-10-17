# Physical-card live scanning

**Superseded experiment:** crop/contrast retries, two-frame confirmation and the higher camera ideals below were removed after a measured regression. See [SCANNER_PERFORMANCE.md](SCANNER_PERFORMANCE.md) for the current implementation, comparison and limitations.

Updated 15 October 2026. The verified encoder, manual entry, storage and saved-card presentation are unchanged.

## Diagnosis

Photo import and live scanning used the same WASM reader with rotation enabled. Telepen Numeric was already enabled. There is no evidence of an encoder defect or a missing Numeric reader. A screen can provide more even lighting and contrast than a reflective physical card; a still photograph can contain more useful bar detail than a moving camera frame. The exact physical-device cause cannot be established remotely.

The previous live loop repeatedly decoded whole frames without a lighting retry, frame agreement or optional camera controls. The revised live pipeline requests a rear-facing 2560 × 1440 stream at up to 30 fps, with a selection-only fallback if constraints are refused. Actual resolution is device-dependent and visible only in development diagnostics.

## Changes

- Decode source pixels directly, without JPEG compression or resizing: horizontal guide crop, full-frame fallback and vertical crop. Rotation and inversion remain enabled.
- Retry failed cropped frames with local grayscale percentile contrast stretching. Raw pixels are always tried first. Fully erased bars cannot be recovered.
- Never overlap decode jobs; adapt the pause to decode time. Require matching value, format and AIM variant from two distinct recent video frames before preview.
- Request continuous autofocus and exposure when advertised. Offer tap focus and torch only when the relevant capabilities exist. Optional-control failure does not prevent scanning; cancellation releases camera tracks and requests torch shutdown.
- Retain the visual guide and provide short movement/glare/steadiness hints. These are image heuristics, not a calibrated focus or distance measurement.
- Explicitly recheck automatic Numeric results using the Numeric reader, including valid checksum state, digit-pair constraints, raw bytes and AIM `]B1`. START 1 / STOP 1 can support ambiguous Alpha interpretations: when automatic Alpha also yields the known 14-digit Numeric card profile, reject rather than silently convert. This profile check does not impose a university-wide length on manual entry or prove the mode by digit count. Other formats and the existing QR save policy remain unchanged.
- Keep resolution, processing and rejection details development-only, without credential values.

The verified Telepen Numeric writer and its checksum/start/stop generation were not modified. Import processing is unchanged. All processing remains local.

## Verification and limits

Synthetic browser coverage includes rotated, reduced-resolution, shadowed, partially glare-obscured and mildly blurred Telepen Numeric video frames; scan → preview → save; distinct-frame confirmation; ambiguous Alpha rejection; optional focus/exposure/torch requests and cleanup; unsupported controls; constraint refusal; and control failures. Existing coverage checks manual entry, format round trips, imported photographs, permission denial, saved-card reload, replacement/deletion and mobile full-screen presentation. Synthetic distortions are not evidence of physical-card reliability.

Run `npm.cmd test`, `npm.cmd run test:browser`, `npm.cmd run build` and, with development servers running, `npm.cmd run test:local`. No real credential is used in these tests.

An actual iPhone must still verify rear-lens choice, readable bar resolution at its minimum focus distance, autofocus, optional tap focus/torch availability, reflection handling, scan latency and physical-card success. Use the trusted private Wi-Fi HTTPS endpoint documented in README; allow camera access. Try positioning the entire barcode within the guide, hold steady and tilt the card slightly to remove reflections. Controls depend on Safari/device support. See [Media Capture constraints](https://www.w3.org/TR/mediacapture-streams/) and [Image Capture capabilities](https://www.w3.org/TR/image-capture/).

Physical-card scanning and authorised library-reader compatibility have not been confirmed on a real device. A photograph cannot establish camera performance. Production web storage remains subject to the development-storage limitations in CAMPUS_CARD.md.
