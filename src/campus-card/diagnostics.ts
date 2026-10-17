import { BARCODE_FORMATS, CREATABLE_BARCODE_FORMATS } from 'zxing-wasm';

export type BarcodeDiagnostic = {
  recognition?:'No candidate detected'|'Candidate unreadable'|'Rejected by validation'|'Telepen ambiguity'|'Valid barcode recognised'|'Capture or processing failure';
  scanningActive?:boolean;
  resolutionProbe?:string;
  framesCaptured?:number;
  captureAverageMs?:number;
  captureMaxMs?:number;
  framesRejected?:boolean;
  scan: 'Not started' | 'Scanning' | 'Succeeded' | 'No barcode detected yet' | 'Failed';
  format: string; variant: string;
  canGenerate: boolean | null;
  generation: 'Not attempted' | 'Succeeded' | 'Failed';
  stage: 'Camera' | 'Decoder' | 'Validation' | 'Generation' | 'Verification' | 'Ready';
  reason: string;
  cameraFrame?: string;
  cameraRequest?: string;
  cameraTrack?: string;
  cameraFocus?: string;
  cameraExposure?: string;
  cameraCapabilities?:string;
  telepenCandidate?: 'Not detected' | 'Detected' | 'Accepted' | 'Rejected';
  processing?: string;
  performance?: {frames:number;fps:number;averageMs:number;maxMs:number;attemptsPerFrame:number;maxAttempts:number;successes:number;failures:number;telepenRejections:number};
  telepenRejection?: string;
  captureMethod?:string;
  captureStatus?:'Capturing'|'Opening image'|'Decoding'|'Succeeded'|'Failed';
  captureFrame?:string;
  captureDecoderInvoked?:boolean;
  photoPipelineInvoked?:boolean;
  captureFormat?:string;
  captureVariant?:string;
  captureReason?:string;
  captureAttempts?:number;
  scanFrequency?:number;
  captureTimeMs?:number;
};
const initial: BarcodeDiagnostic = { scan: 'Not started', format: 'Not detected', variant: 'Not detected', canGenerate: null, generation: 'Not attempted', stage: 'Decoder', reason: 'No scan attempted.' };
let snapshot = initial;
const listeners = new Set<() => void>();
export const diagnosticSnapshot = () => snapshot;
export const subscribeDiagnostics = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function reportDiagnostic(update: Partial<BarcodeDiagnostic>) {
  if (!import.meta.env.DEV) return;
  if (Object.entries(update).every(([key, value]) => snapshot[key as keyof BarcodeDiagnostic] === value)) return;
  snapshot = { ...snapshot, ...update }; listeners.forEach(listener => listener());
}
export function beginDiagnostic() { if (import.meta.env.DEV) { snapshot = initial; reportDiagnostic({ scan: 'Scanning', reason: 'Waiting for a barcode.' }); } }
// Only enum names and the fixed AIM identifier shape cross this boundary. Never payload text/bytes.
export function detectionMetadata(format: string, variant: string) {
  return {
    format: (BARCODE_FORMATS as readonly string[]).includes(format) ? format : 'Unknown format',
    variant: /^\][A-Za-z0-9][0-9]$/.test(variant) ? variant : 'Unknown variant',
    canGenerate: (CREATABLE_BARCODE_FORMATS as readonly string[]).includes(format),
  };
}
