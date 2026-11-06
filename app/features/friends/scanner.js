// Scans a friend's QR code with the camera. Uses the phone's own QR reader (BarcodeDetector)
// where there is one, otherwise jsQR, downloaded the first time it's needed (iPhones have no
// built-in reader in apps). Calls onText with what the code says; the caller works out the
// friend code from it.

import { ui } from 'folio';

const { el } = ui;
const JSQR_LIB = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';

// Opens the camera inside `box`. Returns { stop() }. onProblem gets a sentence to show.
export function startScanner(box, { onText, onProblem }) {
  const video = el('video', { class: 'fr-scan-video', playsinline: '', muted: '', autoplay: '' });
  video.muted = true;
  const frame = el('div', { class: 'fr-scan' }, video, el('span', { class: 'fr-scan-aim', 'aria-hidden': 'true' }));
  box.replaceChildren(frame, ui.hint('Point the camera at your friend\'s QR code (Friends → Show my QR code on their phone).', { small: true }));
  let stream = null;
  let timer = 0;
  let stopped = false;
  const canvas = document.createElement('canvas');

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    for (const track of stream?.getTracks() || []) track.stop();
    video.srcObject = null;
    box.replaceChildren();
  };
  const fail = (text) => {
    stop();
    onProblem(text);
  };

  (async () => {
    if (!navigator.mediaDevices?.getUserMedia) return fail('This phone can\'t open the camera here. Type or paste their code instead.');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch {
      return fail('Couldn\'t open the camera. Allow camera access for this app, or type their code instead.');
    }
    if (stopped) return stop();
    video.srcObject = stream;
    await video.play().catch(() => {});
    let read;
    try {
      read = await reader(canvas);
    } catch {
      return fail('Couldn\'t start the QR reader. It needs the internet the first time. Type their code instead.');
    }
    const tick = async () => {
      if (stopped) return;
      if (video.readyState >= 2) {
        const text = await read(video).catch(() => null);
        if (text && !stopped) {
          stop();
          onText(text);
          return;
        }
      }
      timer = setTimeout(tick, 200);
    };
    tick();
  })();

  return { stop };
}

// A function that reads a QR code from the video, giving its text or null.
async function reader(canvas) {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async (video) => (await detector.detect(video))[0]?.rawValue || null;
      }
    } catch { /* use jsQR */ }
  }
  await ui.loadScript(JSQR_LIB);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    const scale = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data || null;
  };
}
