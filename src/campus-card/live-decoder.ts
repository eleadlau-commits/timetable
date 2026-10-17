import { readBarcodes } from 'zxing-wasm';
import { BarcodeProcessingError, decodeBarcode } from './barcode';
import { reportDiagnostic } from './diagnostics';

// Only the live path changes. Photo import, generation and manual validation stay intact.
export class TelepenFrameRejection extends BarcodeProcessingError {}
export async function decodeLiveFrame(image: ImageData, onAttempt?: () => void) {
  onAttempt?.();
  const card=await decodeBarcode(image);
  // The common path already verifies checksum, digit pairs, bytes and ]B1.
  // Re-decoding a valid Numeric result adds no independent evidence.
  if (!card || card.format!=='TelepenAlpha') return card;
  onAttempt?.();
  const numeric=await readBarcodes(image,{ formats:['TelepenNumeric'], textMode:'Plain', tryHarder:true, tryRotate:true, tryInvert:true });
  if (numeric.some(result => result.isValid && !result.error && result.symbologyIdentifier===']B1' && /^\d{14}$/.test(result.text))) {
    // START 1 permits two meanings. The known 14-digit profile is not proof of mode.
    reportDiagnostic({ stage:'Validation',telepenCandidate:'Rejected',reason:'Alpha and the known Numeric card profile are both possible. Printed-number verification is required; no conversion was attempted.' });
    throw new TelepenFrameRejection('Telepen interpretation is ambiguous. Enter the printed number or verify with a photo.');
  }
  return card;
}
