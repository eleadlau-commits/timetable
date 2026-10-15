// Campus card: scan the barcode on a campus card (camera, photo, or typed in) and show it on
// screen, in case the card is lost. Independent of the timetable: it works on its own.
//
// Saved data: 'card' → { format, value }

import { Feature, ui } from 'folio';
import { FORMATS, drawableFormat, checkBarcode, barcodeSVG } from './barcode.js';

const { el } = ui;
// Barcode reader for phones whose browser has no built-in one (BarcodeDetector).
const ZXING_LIB = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';

export default class CampusCard extends Feature {
  start() {
    this.card = this.storage.get('card');
    this.importOldData();
    this.replacing = false;
    this.scan = null; // { stream, timer } while the camera is looking for a barcode
    this.wakeLock = null;
    this.detector = undefined; // the browser's BarcodeDetector, or null once we know to use ZXing
    this.zxing = null;
    this.photos = ui.filePicker('image/*');
    this.add('header.buttons', { id: 'campus-card', label: 'Campus card', icon: 'card', order: 30, onClick: () => this.openWindow() });
  }

  // Before this app used Folio, the card was saved in "tt.prefs".
  importOldData() {
    this.storage.once('import-from-v1', () => {
      const old = this.app.storage.rawJSON('tt.prefs', {})?.card;
      if (old && !this.card) {
        this.card = old;
        this.storage.set('card', old);
      }
    });
  }

  // ---- The window ----

  buildWindow() {
    this.window = ui.dialog({
      title: 'Campus card',
      onClose: () => {
        this.stopScan();
        this.keepAwake(false);
        this.replacing = false;
      },
    });
    const page = this.template('window');
    const part = (name) => page.querySelector(`[data-part="${name}"]`);
    this.parts = {};
    for (const name of ['show', 'code', 'number', 'type', 'add', 'scan', 'video', 'manual', 'format', 'back']) this.parts[name] = part(name);
    const errorBox = part('error');
    this.showError = (message) => { errorBox.textContent = message || ''; errorBox.hidden = !message; };

    for (const [value, label] of Object.entries(FORMATS)) this.parts.format.append(el('option', { value }, label));
    part('camera').addEventListener('click', () => this.startScan());
    part('stop').addEventListener('click', () => this.stopScan());
    part('photo').addEventListener('click', async () => {
      const file = await this.photos.pick();
      if (file) this.readPhoto(file);
    });
    part('save').addEventListener('click', () => this.saveTyped());
    this.parts.manual.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.saveTyped(); });
    part('replace').addEventListener('click', () => {
      this.replacing = true;
      this.showError(null);
      this.render();
    });
    this.parts.back.addEventListener('click', () => {
      this.stopScan();
      this.replacing = false;
      this.showError(null);
      this.render();
    });
    part('remove').addEventListener('click', () => {
      if (!confirm('Remove the campus card from this phone?')) return;
      this.card = null;
      this.storage.remove('card');
      this.replacing = false;
      this.render();
    });
    this.window.setContent(page.querySelector('.card-window'));
  }

  openWindow() {
    if (!this.window) this.buildWindow();
    this.replacing = false;
    this.showError(null);
    this.render();
    this.window.open();
    this.keepAwake(true);
  }

  render() {
    const c = this.card;
    const showing = !!c && !this.replacing;
    this.parts.show.hidden = !showing;
    this.parts.add.hidden = showing;
    this.parts.back.hidden = !c;
    if (!showing) return;
    try {
      this.parts.code.replaceChildren(barcodeSVG(c.format, c.value));
    } catch {
      this.parts.code.replaceChildren(ui.hint("This barcode can't be drawn. Scan the card again."));
    }
    // Codabar's start/stop letters (A–D) aren't part of the printed number.
    this.parts.number.textContent = c.format === 'codabar' ? c.value.replace(/^[A-D](.+)[A-D]$/, '$1') : c.value;
    this.parts.type.textContent = FORMATS[c.format] || '';
  }

  save(format, value) {
    // Code 39 and Codabar only have capital letters; lower case typed in means the same thing.
    this.card = { format, value: format === 'code_128' ? value : value.toUpperCase() };
    this.storage.set('card', this.card);
    this.stopScan();
    this.replacing = false;
    this.showError(null);
    this.render();
    this.toast('Campus card saved');
  }

  saveTyped() {
    const format = this.parts.format.value;
    const value = this.parts.manual.value.trim();
    try {
      checkBarcode(format, value);
    } catch (err) {
      this.showError(err.message);
      return;
    }
    this.save(format, value);
  }

  // ---- Reading barcodes ----

  // Barcodes found in a video frame, image or canvas: [{ value, format }].
  async readCodes(source) {
    if (this.detector === undefined) {
      try {
        this.detector = 'BarcodeDetector' in window ? new window.BarcodeDetector() : null;
      } catch {
        this.detector = null;
      }
    }
    if (this.detector) {
      try {
        return (await this.detector.detect(source)).map((b) => ({ value: b.rawValue, format: b.format }));
      } catch {
        this.detector = null;
      }
    }
    if (!window.ZXing) await ui.loadScript(ZXING_LIB);
    const Z = window.ZXing;
    if (!this.zxing) {
      const hints = new Map();
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
        Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.CODABAR,
        Z.BarcodeFormat.ITF, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.QR_CODE,
      ]);
      hints.set(Z.DecodeHintType.TRY_HARDER, true);
      this.zxing = { reader: new Z.MultiFormatReader(), hints, canvas: document.createElement('canvas') };
    }
    const w = source.videoWidth || source.width;
    const h = source.videoHeight || source.height;
    const scale = Math.min(1, 1280 / w);
    const { canvas } = this.zxing;
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    try {
      const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
      const result = this.zxing.reader.decode(bitmap, this.zxing.hints);
      return [{ value: result.getText(), format: Z.BarcodeFormat[result.getBarcodeFormat()] }];
    } catch {
      return []; // nothing readable in this frame
    }
  }

  // Saves the first barcode we can redraw. Returns true if one was saved.
  accept(codes) {
    for (const c of codes) {
      const format = drawableFormat(c.format);
      if (!format || !c.value) continue;
      try {
        checkBarcode(format, c.value);
      } catch (err) {
        this.showError(err.message);
        continue;
      }
      this.save(format, c.value);
      return true;
    }
    if (codes.length) {
      const name = String(codes[0].format).replace(/_/g, ' ').toLowerCase();
      this.showError(`That's a ${name} barcode, which this app can't redraw. Keep looking for the long thin barcode, or type the number instead.`);
    }
    return false;
  }

  async startScan() {
    this.showError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      this.showError("This device can't open the camera here. Choose a photo of the card instead.");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch {
      this.showError("Couldn't open the camera. Allow camera access for this app, or choose a photo of the card instead.");
      return;
    }
    const video = this.parts.video;
    video.srcObject = stream;
    await video.play().catch(() => {});
    this.parts.scan.hidden = false;
    const scan = { stream, timer: 0 };
    this.scan = scan;
    const tick = async () => {
      if (this.scan !== scan) return;
      if (video.readyState >= 2) {
        try {
          if (this.accept(await this.readCodes(video))) return;
        } catch {
          if (this.scan === scan) {
            this.stopScan();
            this.showError("Couldn't start the barcode reader. It needs an internet connection the first time. You can also choose a photo or type the number.");
          }
          return;
        }
      }
      if (this.scan === scan) scan.timer = setTimeout(tick, 250);
    };
    tick();
  }

  stopScan() {
    if (this.scan) {
      clearTimeout(this.scan.timer);
      for (const track of this.scan.stream.getTracks()) track.stop();
      this.scan = null;
    }
    if (this.parts) {
      this.parts.video.srcObject = null;
      this.parts.scan.hidden = true;
    }
  }

  async readPhoto(file) {
    this.showError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const codes = await this.readCodes(bitmap);
      bitmap.close?.();
      if (!this.accept(codes) && !codes.length) {
        this.showError("Couldn't find a barcode in that photo. Take it closer, in good light, with the barcode filling most of the picture. Or type the number instead.");
      }
    } catch {
      this.showError("Couldn't read barcodes on this device. Check your internet connection and try again, or type the number instead.");
    }
  }

  // Keeps the screen on while the card is showing, so a scanner can read it.
  async keepAwake(on) {
    try {
      if (on && !this.wakeLock) this.wakeLock = await navigator.wakeLock?.request('screen');
      else if (!on && this.wakeLock) {
        await this.wakeLock.release();
        this.wakeLock = null;
      }
    } catch {
      this.wakeLock = null;
    }
  }
}
