import { useEffect, useRef, useState } from 'react';
import { manualCard, type Card } from './model';
import { cardStorage, type CardStorage } from './storage';
import { decodePhoto, renderBarcode, verifyBarcode } from './barcode';
import { Capacitor } from '@capacitor/core';
import { startScanner, type CameraTools } from './scanner';
import BarcodeDiagnostics from './BarcodeDiagnostics';
import './card.css';

function Barcode({ card }: { card: Card }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const draw = () => { void renderBarcode(canvas.current!, card).then(() => { if (active) setFailed(false); }).catch(() => { if (active) setFailed(true); }); };
    draw();
    const observer = new ResizeObserver(draw);
    if (canvas.current?.parentElement) observer.observe(canvas.current.parentElement);
    return () => { active = false; observer.disconnect(); };
  }, [card]);
  return failed ? <p role="alert">Unable to display this card. Please use your physical card.</p> : <canvas ref={canvas} role="img" aria-label="Campus card barcode"/>;
}

function Scanner({ onCard, onError, onClose }: { onCard: (c: Card) => void; onError: (e: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [tools, setTools] = useState<CameraTools | null>(null);
  const [torch, setTorch] = useState(false);
  const [hint, setHint] = useState('Fit the whole barcode inside the guide');
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState('');
  useEffect(() => {
    let active = true;
    setTools(null); setTorch(false);
    const stop = startScanner(video.current!, onCard, onError, { deviceId, onHint: message => { if (active) setHint(message); }, onReady: cameraTools => {
      if (active) setTools(cameraTools);
      void navigator.mediaDevices.enumerateDevices().then(found => { if (active) setDevices(found.filter(d => d.kind === 'videoinput')); }).catch(() => {});
    } });
    const hide = () => { if (document.hidden) { stop(); onClose(); } };
    document.addEventListener('visibilitychange', hide);
    const timeout = setTimeout(() => { stop(); onError('No supported barcode found. Retry in good light or use your physical card.'); }, 30000);
    return () => { active = false; stop(); clearTimeout(timeout); document.removeEventListener('visibilitychange', hide); };
  }, [deviceId]);
  async function focus(clientX: number, clientY: number) {
    const element = video.current;
    if (!element?.videoWidth || !tools?.focusAvailable) return;
    const box = element.getBoundingClientRect();
    const scale = Math.min(box.width/element.videoWidth, box.height/element.videoHeight);
    const width = element.videoWidth*scale, height = element.videoHeight*scale;
    const x = (clientX-box.left-(box.width-width)/2)/width;
    const y = (clientY-box.top-(box.height-height)/2)/height;
    if (x<0 || x>1 || y<0 || y>1) return;
    if (await tools.focusAt(x,y)) setHint('Hold steady');
  }
  return <><div className="camera-preview"><video ref={video} muted playsInline autoPlay onClick={e => void focus(e.clientX,e.clientY)}/><div className="scan-guide" aria-hidden="true"/></div><button className="primary-card-button" disabled={!tools || capturing} onClick={async () => { if (!tools || capturing) return; setCapturing(true); setCaptureError(''); try { await tools.captureBarcode(); } catch { setCaptureError('Barcode not recognised. Try again.'); } finally { setCapturing(false); } }}>{capturing ? 'Capturing barcode...' : 'Capture barcode'}</button>{captureError && <p role="alert">{captureError}</p>}<p role="status" aria-live="polite">{hint}</p>{tools?.focusAvailable && <p>Tap the barcode to focus.</p>}{tools?.torchAvailable && <button type="button" aria-pressed={torch} onClick={async () => { if (await tools.setTorch(!torch)) setTorch(!torch); else setHint('Torch unavailable. Try brighter, even lighting.'); }}>{torch ? 'Turn off torch' : 'Turn on torch'}</button>}{devices.length > 1 && <label>Camera<select aria-label="Camera" value={deviceId} onChange={e => setDeviceId(e.target.value)}><option value="">Automatic rear camera</option>{devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}</select></label>}<button onClick={onClose}>Cancel scan</button></>;
}

export default function CampusCard({ storage = cardStorage, showLegacyControls = false }: { storage?: CardStorage; showLegacyControls?: boolean }) {
  const [card, setCard] = useState<Card | null>(null);
  const [candidate, setCandidate] = useState<Card | null>(null);
  const [mode, setMode] = useState<'view' | 'setup' | 'scan' | 'manual'>('view');
  const [verified, setVerified] = useState<Card | null>(null);
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [confirmation, setConfirmation] = useState<'save' | 'delete' | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const fullDialog = useRef<HTMLDialogElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  async function load() {
    setBusy(true); setError('');
    try { const saved = await storage.load(); if (saved) await verifyBarcode(saved); setCard(saved); setVerified(saved); setLoaded(true); }
    catch { setError('Could not load your saved card. Retry before making changes.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [storage]);
  useEffect(() => { if (confirmation) dialog.current?.showModal(); else dialog.current?.close(); }, [confirmation]);
  useEffect(() => { if (fullscreen) fullDialog.current?.showModal(); else fullDialog.current?.close(); }, [fullscreen]);
  async function scanned(c: Card) {
    setMode('view'); setBusy(true); setError('');
    try {
      await verifyBarcode(c);
      setCandidate(c);
      if (!showLegacyControls) {
        try { await storage.save(c); setCard(c); setVerified(c); setCandidate(null); setDigits(''); }
        catch { setError('Could not save the card. Your previous card has been kept.'); }
      }
    } catch { setError('This barcode could not be reproduced accurately. Please use your physical card.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!candidate || busy) return;
    setBusy(true); setConfirmation(null); setError('');
    try { await storage.save(candidate); setCard(candidate); setVerified(candidate); setCandidate(null); setDigits(''); }
    catch { setError('Could not save the card. Your previous card has been kept.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (busy) return;
    setBusy(true); setConfirmation(null); setError('');
    try { await storage.remove(); setCard(null); setCandidate(null); setVerified(null); setDigits(''); setLoaded(true); setMode('view'); }
    catch { setError('Could not delete the saved card. Please retry.'); }
    finally { setBusy(false); }
  }
  const closeScan = () => setMode('view');
  const scanError = (message: string) => { setError(message); setMode('view'); };
  async function importPhoto(file: File) {
    setBusy(true); setError('');
    try {
      const decoded = await decodePhoto(file);
      await verifyBarcode(decoded);
      if (mode === 'manual') {
        setVerified(decoded);
        if (digits) { setCandidate(manualCard(digits, decoded)); setMode('view'); }
      } else { setCandidate(decoded); setMode('view'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read this photo. Try another image.'); }
    finally { setBusy(false); }
  }
  return <section className={`campus-card${showLegacyControls ? '' : ' wallet'}`} aria-label="Campus Card">
    {showLegacyControls && <h1>Campus Card</h1>}
    <div className={showLegacyControls ? undefined : 'wallet-content'}>
    {error && <p role="alert" className="card-error">{error}</p>}
    {busy && <p role="status">Checking card…</p>}
    {!loaded && !busy && <><button onClick={() => void load()}>Retry loading card</button><button onClick={() => setConfirmation('delete')}>Delete local card</button></>}
    <input ref={photoInput} hidden={!showLegacyControls} className="photo-input" type="file" accept="image/*" aria-label="Barcode photograph" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void importPhoto(file); }}/>
    {loaded && !busy && <>
      {mode === 'scan' ? <><Scanner onCard={c => void scanned(c)} onError={scanError} onClose={closeScan}/>{showLegacyControls && <button onClick={() => { setMode('setup'); photoInput.current?.click(); }}>Import barcode photo</button>}</> : !showLegacyControls ? <div className="wallet-main">
        {card && <div className="barcode-panel wallet-barcode"><Barcode card={card}/></div>}
        <button className="primary-card-button" onClick={() => { setCandidate(null); setError(''); setMode('scan'); }}>Scan barcode</button>
        {candidate && error && <button onClick={() => void save()}>Retry saving card</button>}
      </div> : mode === 'manual' ? <form onSubmit={e => { e.preventDefault(); try { const c = manualCard(digits, verified); void scanned(c); } catch (e) { setError((e as Error).message); } }}>
        <label htmlFor="barcode-number">Number underneath the barcode</label>
        <input id="barcode-number" type="text" inputMode="numeric" autoComplete="off" spellCheck={false} value={digits} onChange={e => { setDigits(e.target.value); setError(''); }}/>
        <p>Use the number underneath the barcode, rather than your student ID.</p>
        {!verified && <p>For cards matching the verified Durham barcode. You can also verify with a photo.</p>}
        <button type="button" onClick={() => photoInput.current?.click()}>Verify with photo</button>
        <button type="submit">Preview barcode</button><button type="button" onClick={() => { setMode('view'); setDigits(''); setError(''); }}>Cancel</button>
      </form> : candidate ? <>
        <h2>Preview your card</h2><div className="barcode-panel"><Barcode card={candidate}/></div>
        <p>Confirm this was scanned from your own physical campus card.</p>
        <button onClick={() => card ? setConfirmation('save') : void save()}>Save card</button>
        <button onClick={() => { setCandidate(null); setMode('scan'); }}>Retry scan</button>
        <button onClick={() => setCandidate(null)}>Cancel</button>
      </> : card && mode === 'view' ? <>
        <div className="barcode-panel"><Barcode card={card}/></div>
        <button className="primary-card-button" onClick={() => setFullscreen(true)}>Full-screen barcode</button>
        <div className="card-actions"><button onClick={() => { setMode('setup'); setError(''); }}>Replace</button>
        <button className="card-delete" onClick={() => setConfirmation('delete')}>Delete</button></div>
      </> : <>
        <button onClick={() => { setMode('scan'); setError(''); }}>Scan barcode</button>
        <button onClick={() => { setMode('manual'); setError(''); }}>Enter code manually</button>
        <button className="photo-action" onClick={() => photoInput.current?.click()}>Import barcode photo</button>
        {card && <button onClick={() => setMode('view')}>Back to saved card</button>}
      </>}
    </>}
    </div>
    <dialog ref={dialog} className="card-confirm" onCancel={() => setConfirmation(null)} onClose={() => setConfirmation(null)}>
      <h2>{confirmation === 'delete' ? 'Delete saved card?' : 'Replace saved card?'}</h2>
      <p>{confirmation === 'delete' ? 'This removes the credential from this device.' : 'Your current card will be replaced after the new card is saved.'}</p>
      <button disabled={busy} onClick={() => confirmation === 'delete' ? void remove() : void save()}>{confirmation === 'delete' ? 'Delete card' : 'Replace card'}</button>
      <button onClick={() => setConfirmation(null)}>Cancel</button>
    </dialog>
    <dialog ref={fullDialog} className="card-fullscreen" onCancel={() => setFullscreen(false)} onClose={() => setFullscreen(false)}>
      {card && <Barcode card={card}/>}
      <button onClick={() => setFullscreen(false)}>Back to campus card</button>
      <p>Increase screen brightness in Control Centre if needed.</p>
    </dialog>
    {import.meta.env.DEV && <BarcodeDiagnostics expanded={showLegacyControls}/>}
    {showLegacyControls && !Capacitor.isNativePlatform() && <details className="storage-note"><summary>Browser development storage</summary><p>Saved on this browser using encryption. Same-origin scripts can still access it; this is not production Keychain security. Clearing site data deletes your card.</p></details>}
  </section>;
}
