import { readBarcodes } from 'zxing-wasm';
import { BarcodeProcessingError, cardFromResult, decodeBarcode } from '../../src/campus-card/barcode';
import { reportDiagnostic } from '../../src/campus-card/diagnostics';

// Only the live path changes. Photo import, generation and manual validation stay intact.
// Frozen pre-fix baseline; counter is benchmark-only instrumentation.
export const benchmarkCounters={attempts:0};
export async function decodeLiveFrame(image: ImageData) {
  benchmarkCounters.attempts++;
  const card=await decodeBarcode(image);
  if (!card || (card.format!=='TelepenNumeric' && card.format!=='TelepenAlpha')) return card;
  benchmarkCounters.attempts++;
  const numeric=await readBarcodes(image,{ formats:['TelepenNumeric'], textMode:'Plain', tryHarder:true, tryRotate:true, tryInvert:true });
  if (card.format==='TelepenNumeric') {
    if (numeric.length!==1 || !numeric[0].isValid || numeric[0].error || numeric[0].symbologyIdentifier!==']B1' || numeric[0].text!==card.value) {
      reportDiagnostic({ stage:'Validation',reason:'Explicit Telepen Numeric verification did not agree with automatic decoding.' });
      throw new BarcodeProcessingError('The barcode interpretation is uncertain. Hold steady and retry.');
    }
    cardFromResult(numeric[0]); // verifies numeric digit pairs, raw bytes, checksum state and AIM variant
  } else if (numeric.some(result => result.isValid && !result.error && result.symbologyIdentifier===']B1' && /^\d{14}$/.test(result.text))) {
    // START 1 permits two meanings. The known 14-digit profile is not proof of mode.
    reportDiagnostic({ stage:'Validation',reason:'Alpha and the known Numeric card profile are both possible. Printed-number verification is required; no conversion was attempted.' });
    throw new BarcodeProcessingError('Telepen interpretation is ambiguous. Enter the printed number or verify with a photo.');
  }
  return card;
}

