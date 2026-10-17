import { useSyncExternalStore } from 'react';
import { diagnosticSnapshot, subscribeDiagnostics } from './diagnostics';

export default function BarcodeDiagnostics() {
  const diagnostic = useSyncExternalStore(subscribeDiagnostics, diagnosticSnapshot, diagnosticSnapshot);
  return <details open className="storage-note barcode-diagnostics" aria-label="Barcode diagnostics">
    <summary>Barcode diagnostics · development only</summary>
    <dl>
      <dt>Scanning</dt><dd>{diagnostic.scan}</dd>
      <dt>Detected format</dt><dd>{diagnostic.format}</dd>
      <dt>Detected variant (AIM)</dt><dd>{diagnostic.variant}</dd>
      <dt>Library can generate format</dt><dd>{diagnostic.canGenerate === null ? 'Unknown' : diagnostic.canGenerate ? 'Yes' : 'No'}</dd>
      <dt>Generation</dt><dd>{diagnostic.generation}</dd>
      <dt>Stage</dt><dd>{diagnostic.stage}</dd>
      <dt>Rejection reason</dt><dd>{diagnostic.reason}</dd>
      {diagnostic.cameraFrame && <><dt>Camera frame</dt><dd>{diagnostic.cameraFrame}</dd></>}
      {diagnostic.cameraRequest && <><dt>Requested camera resolution</dt><dd>{diagnostic.cameraRequest}</dd></>}
      {diagnostic.cameraTrack && <><dt>Reported stream resolution</dt><dd>{diagnostic.cameraTrack}</dd></>}
      {diagnostic.cameraFocus && <><dt>Reported focus mode</dt><dd>{diagnostic.cameraFocus}</dd></>}
      {diagnostic.cameraExposure && <><dt>Reported exposure mode</dt><dd>{diagnostic.cameraExposure}</dd></>}
      {diagnostic.telepenCandidate && <><dt>Telepen candidate (latest frame)</dt><dd>{diagnostic.telepenCandidate}</dd></>}
      {diagnostic.processing && <><dt>Live processing</dt><dd>{diagnostic.processing}</dd></>}
      {diagnostic.performance && <>
        <dt>Processed frames / second</dt><dd>{diagnostic.performance.fps.toFixed(1)} ({diagnostic.performance.frames} frames)</dd>
        <dt>Decode time average / maximum</dt><dd>{diagnostic.performance.averageMs.toFixed(1)} / {diagnostic.performance.maxMs.toFixed(1)} ms</dd>
        <dt>Reader attempts per frame average / maximum</dt><dd>{diagnostic.performance.attemptsPerFrame.toFixed(1)} / {diagnostic.performance.maxAttempts}</dd>
        <dt>Successful / unsuccessful frames</dt><dd>{diagnostic.performance.successes} / {diagnostic.performance.failures}</dd>
        <dt>Telepen variant rejections</dt><dd>{diagnostic.performance.telepenRejections}</dd>
      </>}
      {diagnostic.telepenRejection && <><dt>Last Telepen ambiguity rejection</dt><dd>{diagnostic.telepenRejection}</dd></>}
    </dl>
  </details>;
}
