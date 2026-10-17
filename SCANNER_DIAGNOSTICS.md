# Scanner error investigation

**Latest evidence:** the supplied physical card is now confirmed as Telepen Numeric / `]B1`, START 1 / STOP 1. See [DURHAM_BARCODE_FINDINGS.md](DURHAM_BARCODE_FINDINGS.md) for the printed-number and independent bar-pattern comparison. Earlier missing-evidence notes below are historical; the general Telepen ambiguity remains relevant.

The original message, `This barcode format or variant cannot be reproduced safely. Import a sharp photo to retry.`, came from the catch block in `src/campus-card/scanner.ts` around frame capture and `decodeBarcode()`. The camera capture loop has been retained; this work adds diagnostic/error classification and fixes verified validation/rendering bugs.

## What can be concluded about the reported incident

1. The old message alone **does not prove a successful decode**. It covered canvas capture errors, decoder exceptions and validation rejections. A frame with no detected barcode normally returned null and continued scanning, rather than displaying this message.
2. The exact detected format/variant cannot be recovered retrospectively: it was neither retained nor logged, and the public internet sample URL has not been provided. No credential logging has been added to recover it.
3. The message occurred before calling the renderer. In the usual rejected-result path, WASM successfully decoded a symbol, `cardFromResult()`/`validateCard()` rejected it, `decodeBarcode()` swallowed the reason, and the scanner replaced the failure with a generic message. Other processing exceptions could reach the same catch.
4. Renderer capability cannot be inferred from that message. The installed WASM writer supports the accepted Code 128, EAN-13, ITF and Telepen variants. It also supports some formats intentionally excluded from the campus-card model, such as QR Code. The library's `OtherBarcode` category is readable but not creatable; diagnostics explicitly report this capability difference.
5. Two incorrect rejections were reproduced with synthetic examples: printable alphanumeric ordinary Code 128 (`]C0`) and Telepen Alpha (`]B0`). Both decoded and generated correctly, but the app's digit-only validation rejected them. Validation now accepts printable ASCII for these ordinary variants. Programming/ECI symbols, control characters and GS1/unhandled AIM variants remain explicitly rejected rather than converted.

## Diagnostic display

### Follow-up: supplied public Code 11 example

The user subsequently supplied `https://nationwidebarcode.com/wp-content/uploads/2011/09/code-11.jpg`. The publisher identifies this as a Code 11 example: https://nationwidebarcode.com/1d-barcode-format/code-11/ . This identifies the published sample, not a decoder-detected format or checksum variant.

The exact image was fetched in memory and tested with the installed WASM reader and through the app's actual browser photo-import path. Both returned **no decoded barcode**. The visible development panel showed `No barcode detected yet`, format/variant `Not detected`, generation `Not attempted`, stage `Decoder`, and `No barcode decoded in this image/frame.` No payload was printed, stored as a fixture or added to this report.

The installed `READABLE_BARCODE_FORMATS` and `CREATABLE_BARCODE_FORMATS` contain no Code 11 support. Thus this sample exposes an unsupported decoder/writer format, not a verified camera initialization or renderer-generation failure. The direct-photo test did not reproduce the historical camera catch message; a historical frame's exception or false detection cannot be recovered retrospectively. No automatic conversion or Code 11 support was added.

The synthetic Code 128/EAN-13/ITF/Telepen tests remain valid supported-format tests, but this Code 11 image cannot be used to measure success for those formats.

Run `npm.cmd run dev` and open http://127.0.0.1:5173/. The development-only Barcode diagnostics panel shows:

- Whether a scan succeeded, failed, is pending or has not detected a barcode yet.
- Canonical detected format and AIM variant.
- Whether the installed library can generate that format, separately from whether app validation accepts the particular barcode.
- Whether generation was attempted/succeeded/failed.
- The processing stage and specific safe rejection reason.

A valid unsupported QR example now reports **Scanning: Succeeded**, **format: QRCode**, **variant: ]Q1**, **Library can generate format: Yes**, **Generation: Not attempted**, **Stage: Validation**, and a reason explaining the app's 1D-card format policy. It is not described as a failed scan or an incapable writer.

Only enum format names, AIM-shaped identifiers, statuses and fixed reason messages enter the diagnostic state. No barcode text, bytes, images, payload length, checksum value, arbitrary library error string or camera identifiers enter it. Diagnostics are ephemeral, not logged or persisted. The display and reporting are gated by `import.meta.env.DEV`; a real production-preview check confirmed the panel is absent.

Unexpected frame/decoder failures now receive distinct messages. Known successful decodes rejected by app validation explicitly say that decoding succeeded. Writer and round-trip failures are diagnosed separately. A sharper photo is no longer suggested as a universal remedy for a deterministic validation rejection.

## Additional verified display bug

A dense printable Telepen Alpha example passed full-resolution generation/redecode but failed decoding after the UI stretched it to fill the card width. Fractional bar-module sizes changed the displayed pattern. The canvas now selects an integer number of device pixels per module and stays centred in the same white panel. It redraws when its container is resized; it keeps the original proportions and quiet zones. An oversized symbol scrolls instead of being silently compressed below one device pixel per module. Full-screen/landscape remains useful for long symbols. Actual displayed pixels now decode in the tests, including the previously failing Telepen Alpha case.

## Verification (synthetic data only)

### New 14-digit investigation: physical evidence required

The subsequent Durham identification task supplied only text. No photograph or private reference value was found in the project or its task attachment. Existing project images were generated planner screenshots, not campus cards. A 14-digit length and Telepen-branded reader do not establish a symbology, so no Durham format or printed-number mapping was selected.

An explicitly synthetic 14-digit test without a leading zero exposed a Telepen interpretation ambiguity in the installed zxing-wasm 3.1.5 build:

| Generated symbol | Reader selection | Reported format/AIM | Matches the synthetic input |
| --- | --- | --- | --- |
| Telepen Numeric | Automatic | Telepen Alpha / ]B0 | No |
| Telepen Numeric | Telepen Numeric only | Telepen Numeric / ]B1 | Yes |
| Telepen Numeric | Telepen Alpha only | Telepen Alpha / ]B0 | No |
| Telepen Alpha | Automatic or Alpha only | Telepen Alpha / ]B0 | Yes |
| Telepen Alpha | Numeric only | Telepen Numeric / ]B1 | No |
| Code 128 | Automatic | Code128 / ]C0 | Yes |
| ITF | Automatic | ITF / ]I0 | Yes |

All listed Telepen interpretations were reported checksum-valid. This shows why forcing Numeric merely because the printed number has 14 digits is unsafe, and why a writer-to-reader round trip with a forced format is not independent evidence of the original format. The existing synthetic workflow suite still passes its chosen samples; it does not establish unambiguous automatic identification for all Telepen data.

The upstream reader explicitly describes real-world START 1 / STOP 1 symbols containing compressed numeric data and uses a heuristic to distinguish them from Alpha: https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/oned/ODTelepenReader.cpp . Actual installed-build behavior was tested locally above; the source helps explain the ambiguity rather than identifying the Durham card.

No camera acquisition changes, guessed format, hardcoded length or unrestricted manual reconstruction were introduced in this investigation. The next required evidence is a sharp local crop of the physical card's complete barcode, white quiet zones and printed number, with other personal details excluded. It can be placed in the already-ignored `credentials/` directory and referenced by local filename. Keep any private reference value there as well; verification must report matches/format/checksum metadata only, never print the value. Real-card decoding and bar-pattern comparisons remain outstanding.

| Requested and detected format | AIM variant | Scan → preview → save → display → reload | Displayed pixels decode |
| --- | --- | --- | --- |
| Ordinary Code 128, printable alphanumeric | ]C0 | Passed | Passed |
| Ordinary Code 128, numeric | ]C0 | Passed | Passed |
| EAN-13 | ]E0 | Passed | Passed |
| ITF | ]I0 | Passed | Passed |
| Telepen Numeric | ]B1 | Passed | Passed |
| Telepen Alpha, printable alphanumeric | ]B0 | Passed | Passed |

- `npm.cmd test`: **26 passed**.
- `npm.cmd run test:browser`: **19 passed**, including all existing card regressions, the six per-format workflows and rejected-format diagnostic/privacy checks.
- `npm.cmd run build`: **passed**.
- Private HTTPS camera/secure-context/cleanup smoke test: **passed**.
- Production-preview app loading and diagnostic-panel exclusion: **passed**.

No production storage policy, manual-number verification rule or camera acquisition strategy was rewritten. The separate Journey Planner was not modified. This investigation does not identify the user's unseen example or establish Durham gate acceptance. Re-scan the public example with the development panel open to identify its exact format/variant and rejection stage.
