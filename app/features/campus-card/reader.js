// Reads barcodes from a camera frame or a photo: [{ value, format }].
//
// It uses the browser's own barcode reader (BarcodeDetector) where there is one, and the ZXing
// library otherwise. ZXing is downloaded the first time it's needed, and two of its bugs are
// fixed as it loads (see zxing-fixes.js).
//
// For a photo, which is read only once, it tries harder: if the browser's reader finds
// nothing, ZXing has a go too, then reads a large photo at a higher resolution (for a card far
// from the camera), then turned 30° each way (ZXing only reads lines straight across, or
// sideways, so a tilted barcode is otherwise missed).

import { ui } from 'folio';
import { fixZXing } from './zxing-fixes.js';

// Barcode reader for phones whose browser has no built-in one (BarcodeDetector).
const ZXING_LIB = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
// What ZXing tries, in turn: how big the picture is made (its longest side, at most), and
// turned how far.
const TRIES = {
  frame: [{ size: 1280, turn: 0 }],
  photo: [{ size: 1280, turn: 0 }, { size: 2400, turn: 0 }, { size: 1280, turn: 30 }, { size: 1280, turn: -30 }],
};

export class BarcodeReader {
  constructor() {
    this.detector = undefined; // the browser's BarcodeDetector, or null once we know to use ZXing
    this.zxing = null;
  }

  // source: a <video>, an ImageBitmap or a canvas. photo: true for a photo (try harder).
  async read(source, { photo = false } = {}) {
    const found = await this.detect(source);
    if (found.length || (found.tried && !photo)) return found;
    return this.readWithZXing(source, photo ? TRIES.photo : TRIES.frame);
  }

  // The browser's own reader. Returns what it found, marked `tried` if it ran.
  async detect(source) {
    if (this.detector === undefined) {
      try {
        this.detector = 'BarcodeDetector' in window ? new window.BarcodeDetector() : null;
      } catch {
        this.detector = null;
      }
    }
    if (!this.detector) return [];
    try {
      const codes = (await this.detector.detect(source)).map((b) => ({ value: b.rawValue, format: b.format }));
      codes.tried = true;
      return codes;
    } catch {
      this.detector = null;
      return [];
    }
  }

  async readWithZXing(source, tries) {
    if (!window.ZXing) await ui.loadScript(ZXING_LIB);
    const Z = window.ZXing;
    fixZXing(Z);
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
    const { canvas } = this.zxing;
    const done = new Set();
    for (const { size, turn } of tries) {
      const scale = Math.min(1, size / Math.max(w, h));
      const key = `${Math.round(scale * w)}/${turn}`;
      if (done.has(key)) continue; // the photo is smaller than this size already
      done.add(key);
      this.draw(canvas, source, w * scale, h * scale, turn);
      try {
        const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
        const result = this.zxing.reader.decode(bitmap, this.zxing.hints);
        return [{ value: result.getText(), format: Z.BarcodeFormat[result.getBarcodeFormat()] }];
      } catch {
        // nothing readable this way
      }
    }
    return [];
  }

  // Draws the picture onto the canvas at a size, turned by some degrees, on white.
  draw(canvas, source, width, height, turn) {
    const a = (turn * Math.PI) / 180;
    const cos = Math.abs(Math.cos(a));
    const sin = Math.abs(Math.sin(a));
    canvas.width = Math.round(width * cos + height * sin);
    canvas.height = Math.round(width * sin + height * cos);
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.save();
    g.translate(canvas.width / 2, canvas.height / 2);
    g.rotate(a);
    g.drawImage(source, -width / 2, -height / 2, width, height);
    g.restore();
  }
}
