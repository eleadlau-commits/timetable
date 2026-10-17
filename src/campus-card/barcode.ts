import { prepareZXingModule, readBarcodes, writeBarcode, type ReadResult } from 'zxing-wasm';
import wasmURL from 'zxing-wasm/full/zxing_full.wasm?url';
import { CardValidationError, validateCard, type Card } from './model';
import { beginDiagnostic, detectionMetadata, reportDiagnostic } from './diagnostics';
import type { CaptureMethod } from './capture';

export class BarcodeProcessingError extends Error {}

// Never use the library's default CDN loader, and never print decoder diagnostics.
prepareZXingModule({ overrides: { locateFile: () => wasmURL, print: () => {}, printErr: () => {} } });
export const prepareDecoder = () => prepareZXingModule({ fireImmediately: true });
export function cardFromResult(result: ReadResult, source: 'scan' | 'photo' = 'scan'): Card {
  if (!result.isValid || result.error) throw new CardValidationError('The barcode checksum could not be verified.');
  if (result.readerInit || result.hasECI) throw new CardValidationError('Programming symbols and ECI control information are not supported for card reproduction.');
  return validateCard({ version: 1, value: result.text, format: result.format, bytes: Array.from(result.bytes), symbologyIdentifier: result.symbologyIdentifier, source, savedAt: new Date().toISOString() });
}
export async function decodeBarcode(input: Blob | ImageData, source: 'scan' | 'photo' = 'scan'): Promise<Card | null> {
  let results: ReadResult[];
  try { results = await readBarcodes(input, { tryHarder: true, tryRotate: true, tryInvert: true, maxNumberOfSymbols: 4, textMode: 'Plain' }); }
  catch {
    reportDiagnostic({recognition:'Capture or processing failure',framesRejected:true, scan: 'Failed', stage: 'Decoder', reason: 'The decoder could not process the image/frame. No successful decode is available.' });
    throw new BarcodeProcessingError('The barcode reader could not process this image. Retry scanning or import another photo.');
  }
  if (!results.length) { reportDiagnostic({recognition:'No candidate detected',framesRejected:false, scan: 'No barcode detected yet', stage: 'Decoder', telepenCandidate:'Not detected', reason: 'No candidate returned. An unreadable symbol may also produce no result.' }); return null; }
  const accepted: Card[] = [];
  for (const result of results) {
    const metadata = detectionMetadata(result.format, result.symbologyIdentifier);
    reportDiagnostic({ ...metadata, scan: result.isValid && !result.error ? 'Succeeded' : 'Failed', stage: 'Validation', generation: 'Not attempted', telepenCandidate:result.format.startsWith('Telepen')?'Detected':'Not detected' });
    try { accepted.push(cardFromResult(result, source)); }
    catch (error) { reportDiagnostic({recognition:result.isValid&&!result.error?'Rejected by validation':'Candidate unreadable',framesRejected:true, telepenCandidate:result.format.startsWith('Telepen')?'Rejected':'Not detected', reason: !metadata.canGenerate ? 'The decoder recognised this format, but the installed writer cannot generate it. No generation was attempted.' : error instanceof CardValidationError ? error.message : 'Unexpected validation failure. Payload details are hidden.' }); }
  }
  const unique = accepted.filter((c, i) => accepted.findIndex(x => x.value === c.value && x.format === c.format) === i);
  if (unique.length !== 1) {
    if (unique.length) reportDiagnostic({recognition:'Rejected by validation',framesRejected:true, stage: 'Validation', reason: 'Multiple different accepted barcodes were decoded. Crop to one barcode.' });
    throw new BarcodeProcessingError(unique.length ? 'More than one barcode decoded. Crop the photo to your card barcode.' : results.some(result => result.isValid && !result.error) ? 'Barcode decoded, but this format or variant cannot be reproduced safely by this app.' : 'A barcode was detected, but its checksum could not be verified.');
  }
  reportDiagnostic({recognition:'Valid barcode recognised',framesRejected:false, ...detectionMetadata(unique[0].format, unique[0].symbologyIdentifier), scan: 'Succeeded', stage: 'Validation', telepenCandidate:unique[0].format.startsWith('Telepen')?'Accepted':'Not detected', reason: 'Validation passed. Generation has not been attempted.' });
  return unique[0];
}
type PixelOptions={isCancelled?:()=>boolean;onDecode?:()=>void;validateResult?:(image:ImageData,card:Card)=>Promise<Card>};
// Shared native pixels: identical reader options and validation for files and video.
export async function decodePixels(pixels:ImageData,source:'scan'|'photo'='scan',options?:PixelOptions):Promise<Card|null>{
  if(options?.isCancelled?.())return null;
  options?.onDecode?.();
  let card=await decodeBarcode(pixels,source);
  if(options?.isCancelled?.())return null;
  if(card&&options?.validateResult)card=await options.validateResult(pixels,card);
  return card;
}
export async function decodePhoto(file: Blob, captureMethod?:CaptureMethod, isCancelled?:()=>boolean, automatic?:PixelOptions): Promise<Card> {
  if(!captureMethod)beginDiagnostic();
  if(import.meta.env.DEV&&captureMethod)reportDiagnostic({captureMethod,captureStatus:'Opening image',captureDecoderInvoked:false,photoPipelineInvoked:true});
  if (file.size > 25 * 1024 * 1024) { reportDiagnostic({ scan: 'Failed', stage: 'Decoder', reason: 'The photo exceeds the supported file size.' }); throw new Error('Choose a photo smaller than 25 MB.'); }
  // Browser image decoding avoids the WASM file decoder's format limitations.
  const bitmap = await createImageBitmap(file).catch(() => { reportDiagnostic({ scan: 'Failed', stage: 'Decoder', reason: 'The browser could not open the photo.' }); throw new Error('This photo cannot be opened. Try a JPEG or PNG image.'); });
  const canvas = document.createElement('canvas');
  try {
    if(isCancelled?.())throw new Error('Capture cancelled.');
    if(import.meta.env.DEV&&captureMethod)reportDiagnostic({captureFrame:`${bitmap.width} × ${bitmap.height}`});
    if (bitmap.width * bitmap.height > 48000000) { reportDiagnostic({reason:'Photo dimensions exceed the supported 48-million-pixel limit.'}); throw new Error('This photo is too large. Crop it to the barcode first.'); }
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0);
    if(import.meta.env.DEV&&captureMethod)reportDiagnostic({captureFrame:`${bitmap.width} × ${bitmap.height}`,captureDecoderInvoked:true,captureStatus:'Decoding'});
    const pixels=ctx.getImageData(0, 0, canvas.width, canvas.height);
    const card = await decodePixels(pixels,'photo',{...automatic,isCancelled});
    if (!card) throw new Error('No readable barcode found. Try a sharp, well-lit photo cropped around the barcode.');
    if(isCancelled?.())throw new Error('Capture cancelled.');
    if(import.meta.env.DEV&&captureMethod)reportDiagnostic({captureStatus:'Succeeded',captureFormat:card.format,captureVariant:card.symbologyIdentifier,captureReason:'None'});
    return card;
  } finally { bitmap.close(); canvas.width = canvas.height = 0; }
}
export async function renderBarcode(canvas: HTMLCanvasElement, input: Card, diagnose = false): Promise<void> {
  const card = validateCard(input);
  if (diagnose) reportDiagnostic({ ...detectionMetadata(card.format, card.symbologyIdentifier), stage: 'Generation', generation: 'Not attempted', reason: 'Attempting generation in the detected format.' });
  let bitmap: ImageBitmap;
  try {
    const result = await writeBarcode(new Uint8Array(card.bytes), { format: card.format, scale: 3, addQuietZones: true, addHRT: false });
    if (result.error || !result.image) throw new Error();
    bitmap = await createImageBitmap(result.image);
  } catch {
    if (diagnose) reportDiagnostic({ stage: 'Generation', generation: 'Failed', reason: 'The writer could not generate an image for this data and format.' });
    throw new BarcodeProcessingError('Barcode decoded, but generation failed for the recorded format.');
  }
  try {
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false; ctx.drawImage(bitmap, 0, 0);
    const parent = canvas.parentElement;
    if (parent?.clientWidth) {
      const style = getComputedStyle(parent);
      const available = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const density = window.devicePixelRatio || 1;
      const moduleWidth = bitmap.width / 3;
      // Avoid fractional bar modules when CSS scales a dense symbol to the card width.
      // If one module cannot fit, keep it sharp and let the existing panel scroll.
      const scale = Math.max(1, Math.floor(available * density / moduleWidth));
      canvas.style.width = `${moduleWidth * scale / density}px`;
      canvas.style.marginInline = 'auto';
    }
  } finally { bitmap.close(); }
  if (diagnose) reportDiagnostic({ generation: 'Succeeded', reason: 'Generation succeeded; verifying the result.' });
}
export async function verifyBarcode(card: Card): Promise<void> {
  const canvas = document.createElement('canvas');
  try {
    await renderBarcode(canvas, card, true);
    reportDiagnostic({ stage: 'Verification' });
    const ctx = canvas.getContext('2d')!;
    let results: ReadResult[];
    try { results = await readBarcodes(ctx.getImageData(0, 0, canvas.width, canvas.height), { formats: [card.format], textMode: 'Plain' }); }
    catch { reportDiagnostic({ reason: 'The decoder could not verify the generated image.' }); throw new Error(); }
    if (results.length !== 1) { reportDiagnostic({ reason: 'The generated image did not decode to exactly one barcode.' }); throw new Error(); }
    let decoded: Card;
    try { decoded = cardFromResult(results[0]); }
    catch (error) { reportDiagnostic({ reason: error instanceof CardValidationError ? error.message : 'Generated barcode validation failed.' }); throw new Error(); }
    if (decoded.value !== card.value || decoded.format !== card.format || decoded.symbologyIdentifier !== card.symbologyIdentifier || decoded.bytes.some((b, i) => b !== card.bytes[i]) || decoded.bytes.length !== card.bytes.length) { reportDiagnostic({ reason: 'The generated image decoded to a different format, variant or payload.' }); throw new Error(); }
    reportDiagnostic({ stage: 'Ready', reason: 'None. Generation and exact round-trip verification passed.' });
  } catch { throw new Error('This barcode could not be reproduced accurately. Please use your physical card.'); }
  finally { canvas.width = canvas.height = 0; }
}
