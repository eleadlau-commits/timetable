import { readBarcodes } from 'zxing-wasm';
import { BarcodeProcessingError } from './barcode';
import type { Card } from './model';
import { reportDiagnostic } from './diagnostics';

// Retain the established automatic-scan ambiguity guard; not a second broad decoder.
export class TelepenFrameRejection extends BarcodeProcessingError {}
export async function validateLiveInterpretation(image: ImageData, card:Card, onAttempt?: () => void) {
  // The common path already verifies checksum, digit pairs, bytes and ]B1.
  // Re-decoding a valid Numeric result adds no independent evidence.
  if (card.format!=='TelepenAlpha') return card;
  onAttempt?.();
  const numeric=await readBarcodes(image,{ formats:['TelepenNumeric'], textMode:'Plain', tryHarder:true, tryRotate:true, tryInvert:true });
  if (numeric.some(result => result.isValid && !result.error && result.symbologyIdentifier===']B1' && /^\d{14}$/.test(result.text))) {
    // START 1 permits two meanings. The known 14-digit profile is not proof of mode.
    reportDiagnostic({ recognition:'Telepen ambiguity',framesRejected:true,stage:'Validation',telepenCandidate:'Rejected',reason:'Alpha and the known Numeric card profile are both possible. Printed-number verification is required; no conversion was attempted.' });
    throw new TelepenFrameRejection('Telepen interpretation is ambiguous. Enter the printed number or verify with a photo.');
  }
  return card;
}
