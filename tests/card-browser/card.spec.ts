import {test,expect} from './legacy-ui.fixture';
import type {Page} from '@playwright/test';
import { readFileSync } from 'node:fs';
import { prepareZXingModule, writeBarcode, type WriteInputBarcodeFormat } from 'zxing-wasm';
prepareZXingModule({ overrides: { wasmBinary: readFileSync('node_modules/zxing-wasm/dist/full/zxing_full.wasm'), print: () => {}, printErr: () => {} } });
const value = '00123456789012345678'; // Synthetic only.
async function png(format: WriteInputBarcodeFormat = 'TelepenNumeric', text = value) {
  const generated = await writeBarcode(text, { format, scale: 3, addQuietZones: true });
  if (!generated.image || generated.error) throw new Error('Synthetic barcode generation failed');
  return Buffer.from(await generated.image.arrayBuffer());
}
async function syntheticCamera(page: Page, format: WriteInputBarcodeFormat = 'TelepenNumeric', text = value) {
  const image = (await png(format, text)).toString('base64');
  await page.evaluate(async image => {
    const bitmap = new Image(); bitmap.src = `data:image/png;base64,${image}`; await bitmap.decode();
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0);
    setInterval(() => context.drawImage(bitmap, 0, 0), 100);
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async constraints => {
      (window as any).__constraints = constraints;
      const stream = canvas.captureStream(10); (window as any).__stream = stream; return stream;
    } });
  }, image);
}
async function upload(page: Page, image: Buffer, name = 'synthetic.png') {
  await page.getByLabel('Barcode photograph', { exact: true }).setInputFiles({ name, mimeType: name.endsWith('jpg') ? 'image/jpeg' : 'image/png', buffer: image });
}
async function scanAndSave(page: Page) {
  await syntheticCamera(page);
  await page.getByRole('button', { name: 'Scan barcode', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Preview your card' })).toBeVisible();
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Full-screen barcode', exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Scan barcode', exact: true })).toBeVisible();
});

test('camera initialises, requests rear/high resolution, scans Telepen, previews and saves', async ({ page }) => {
  await scanAndSave(page);
  expect(await page.evaluate(() => (window as any).__stream.getTracks().every((t: MediaStreamTrack) => t.readyState === 'ended'))).toBe(true);
  const constraints = await page.evaluate(() => (window as any).__constraints);
  expect(constraints.video.width.ideal).toBeGreaterThanOrEqual(1920);
  expect(constraints.video.facingMode.ideal).toBe('environment');
  const saved = await page.evaluate(async () => (await import('/src/campus-card/storage.ts')).cardStorage.load());
  expect(saved?.format).toBe('TelepenNumeric'); expect(saved?.value).toBe(value);
});

test('photo decoding works on a rotated compressed synthetic photograph entirely locally', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', r => { if (r.method() === 'POST' || !new URL(r.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) requests.push(r.url()); });
  const image = (await png()).toString('base64');
  const jpeg = await page.evaluate(async image => {
    const img = new Image(); img.src = `data:image/png;base64,${image}`; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.height + 100; canvas.height = img.width + 100;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#eee'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(Math.PI / 2); ctx.drawImage(img, -img.width / 2, -img.height / 2);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', .82));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, image);
  await upload(page, Buffer.from(jpeg), 'synthetic-photo.jpg');
  await expect(page.getByRole('heading', { name: 'Preview your card' })).toBeVisible();
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Full-screen barcode', exact: true })).toBeVisible();
  expect(requests).toEqual([]);
});

test('manual entry with optional photo verification previews, saves and survives reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Enter code manually' }).click();
  const input = page.getByLabel('Number underneath the barcode');
  await expect(input).toHaveAttribute('inputmode', 'numeric');
  await input.fill('00x'); await page.getByRole('button', { name: 'Preview barcode', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('only the digits');
  await input.fill('123'); await page.getByRole('button', { name: 'Preview barcode', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('even number');
  await input.fill(value);
  await expect(input).toHaveValue(value);
  await upload(page, await png());
  await expect(page.getByRole('heading', { name: 'Preview your card' })).toBeVisible();
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Full-screen barcode', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Full-screen barcode', exact: true })).toBeVisible();
  expect(await page.evaluate(async () => (await (await import('/src/campus-card/storage.ts')).cardStorage.load())?.source)).toBe('manual');
});

test('manual Durham profile works without a photo and preserves zeros through reload', async ({ page }) => {
  const synthetic = '00123456789012';
  await page.getByRole('button', { name: 'Enter code manually' }).click();
  await page.getByLabel('Number underneath the barcode').fill(synthetic);
  await page.getByRole('button', { name: 'Preview barcode', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Preview your card' })).toBeVisible();
  const panel = page.getByLabel('Barcode diagnostics', { exact: true });
  await expect(panel).toContainText('TelepenNumeric'); await expect(panel).toContainText(']B1');
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Full-screen barcode', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Full-screen barcode', exact: true })).toBeVisible();
  const saved = await page.evaluate(async () => (await import('/src/campus-card/storage.ts')).cardStorage.load());
  expect(saved?.value).toBe(synthetic); expect(saved?.format).toBe('TelepenNumeric'); expect(saved?.source).toBe('manual');
});

test('all accepted formats round trip with exact bytes and variant', async ({ page }) => {
  expect(await page.evaluate(async () => {
    const { scannedCard } = await import('/src/campus-card/model.ts');
    const { verifyBarcode } = await import('/src/campus-card/barcode.ts');
    for (const format of ['TelepenNumeric', 'TelepenAlpha', 'Code128', 'Code39', 'ITF']) await verifyBarcode(scannedCard('001234567890', format));
    await verifyBarcode(scannedCard('0012345678905', 'EAN13'));
    await verifyBarcode(scannedCard('00123457', 'EAN8'));
    return true;
  })).toBe(true);
});

test('saved credential is encrypted in IndexedDB and survives reload as default screen', async ({ page }) => {
  await scanAndSave(page);
  const encrypted = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('campus-card-development'); r.onsuccess = () => resolve(r.result); });
    const record = await new Promise<any>(resolve => { const r = db.transaction('credentials').objectStore('credentials').get('card'); r.onsuccess = () => resolve(r.result); }); db.close();
    return { extractable: record.key.extractable, text: new TextDecoder().decode(record.ciphertext), fields: Object.keys(record).sort() };
  });
  expect(encrypted.extractable).toBe(false); expect(encrypted.text).not.toContain(value); expect(encrypted.fields).toEqual(['ciphertext', 'iv', 'key']);
  await page.reload(); await expect(page.getByRole('button', { name: 'Full-screen barcode', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scan barcode', exact: true })).toHaveCount(0);
});

test('replacement and deletion require confirmation and deletion survives reload', async ({ page }) => {
  await scanAndSave(page);
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await upload(page, await png('Code128', '00998877665544332211'));
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  expect(await page.evaluate(async () => (await (await import('/src/campus-card/storage.ts')).cardStorage.load())?.value)).toBe(value);
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await page.getByRole('button', { name: 'Replace card', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Full-screen barcode', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete card', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Scan barcode', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('button', { name: 'Scan barcode', exact: true })).toBeVisible();
});

test('full-screen phone view preserves aspect ratio and works offline in session', async ({ page, context }) => {
  await scanAndSave(page);
  // Decode the displayed pixels at phone size, not just the original full-resolution canvas.
  await page.setViewportSize({ width: 320, height: 844 });
  const displayed = await page.getByRole('img', { name: 'Campus card barcode', exact: true }).screenshot();
  const decoded = await page.evaluate(async bytes => {
    const { decodePhoto } = await import('/src/campus-card/barcode.ts');
    return (await decodePhoto(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))).value;
  }, Array.from(displayed));
  expect(decoded).toBe(value);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Full-screen barcode', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  for (const width of [320,390,430]) {
    await page.setViewportSize({ width, height: 844 });
    const ratio = await page.locator('dialog canvas').evaluate((canvas: HTMLCanvasElement) => { const b = canvas.getBoundingClientRect(); return { actual: b.width / b.height, expected: canvas.width / canvas.height, fits: b.right <= innerWidth && b.bottom <= innerHeight }; });
    expect(ratio.actual).toBeCloseTo(ratio.expected, 1); expect(ratio.fits).toBe(true);
  }
  await page.getByRole('button', { name: 'Back to campus card', exact: true }).click();
});

test('permission denial and missing secure context are actionable', async ({ page }) => {
  await page.evaluate(() => Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => { throw new DOMException('Denied', 'NotAllowedError'); } }));
  await page.getByRole('button', { name: 'Scan barcode', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Camera permission denied');
  await page.evaluate(() => Object.defineProperty(window, 'isSecureContext', { value: false }));
  await page.getByRole('button', { name: 'Scan barcode', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('secure connection');
});

test('unsupported barcode photo, unreadable photo and unsupported camera scan are rejected', async ({ page }) => {
  await upload(page, await png('QRCode', 'SYNTHETIC-UNSUPPORTED'));
  await expect(page.getByRole('alert')).toContainText('cannot be reproduced safely');
  await upload(page, Buffer.from('not an image'));
  await expect(page.getByRole('alert')).toContainText('cannot be opened');
  await syntheticCamera(page, 'QRCode', 'SYNTHETIC-UNSUPPORTED');
  await page.getByRole('button', { name: 'Scan barcode', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('cannot be reproduced safely');
});

test('storage failure keeps candidate for retry', async ({ page }) => {
  await upload(page, await png());
  await expect(page.getByRole('heading', { name: 'Preview your card' })).toBeVisible();
  await page.evaluate(() => { IDBObjectStore.prototype.put = function() { throw new DOMException('Synthetic storage failure', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save');
  await expect(page.getByRole('heading', { name: 'Preview your card' })).toBeVisible();
});

test('cancelling scanning releases all tracks', async ({ page }) => {
  await page.evaluate(() => Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { const c = document.createElement('canvas'); c.width=640; c.height=480; const s=c.captureStream(10); (window as any).__stream=s; return s; } }));
  await page.getByRole('button', { name: 'Scan barcode', exact: true }).click();
  await expect(page.locator('video')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel scan', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__stream.getTracks().every((t: MediaStreamTrack) => t.readyState === 'ended'))).toBe(true);
});

test('camera selection restarts capture and releases the old camera', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__streams = [];
    (window as any).__requests = [];
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: async () => [{ kind:'videoinput', deviceId:'rear', label:'Rear camera' }, { kind:'videoinput', deviceId:'other', label:'Other camera' }] });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async constraints => {
      const c=document.createElement('canvas'); c.width=640; c.height=480; const ctx=c.getContext('2d')!; ctx.fillStyle='white'; ctx.fillRect(0,0,640,480); const s=c.captureStream(10); setInterval(() => ctx.fillRect(0,0,640,480), 100);
      (window as any).__streams.push(s); (window as any).__requests.push(constraints); return s;
    } });
  });
  await page.getByRole('button', { name: 'Scan barcode', exact: true }).click();
  await page.getByLabel('Camera', { exact: true }).selectOption('other');
  await expect.poll(() => page.evaluate(() => (window as any).__requests.at(-1)?.video.deviceId?.exact)).toBe('other');
  expect(await page.evaluate(() => (window as any).__streams.slice(0, -1).every((s: MediaStream) => s.getTracks().every(t => t.readyState === 'ended')))).toBe(true);
  await page.getByRole('button', { name: 'Cancel scan', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__streams.every((s: MediaStream) => s.getTracks().every(t => t.readyState === 'ended')))).toBe(true);
});

for (const [format, text, variant] of [
  ['Code128', 'SYNTHETIC-ABC123', ']C0'],
  ['Code128', '001234567890', ']C0'],
  ['EAN13', '5901234123457', ']E0'],
  ['ITF', '001234567890', ']I0'],
  ['TelepenNumeric', '001234567890', ']B1'],
  ['TelepenAlpha', 'SYNTHETIC-ABC123', ']B0'],
] as const) {
  test(`${format} ${text.startsWith('SYNTHETIC') ? 'alphanumeric' : 'numeric'} scan, generation, preview, save and display retain exact data`, async ({ page }) => {
    await syntheticCamera(page, format, text);
    await page.getByRole('button', { name: 'Scan barcode', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Preview your card' })).toBeVisible();
    const panel = page.getByLabel('Barcode diagnostics', { exact: true });
    for (const [label, expected] of [['Scanning', 'Succeeded'], ['Detected format', format], ['Detected variant (AIM)', variant], ['Library can generate format', 'Yes'], ['Generation', 'Succeeded'], ['Stage', 'Ready']]) {
      await expect(panel.locator('dt').filter({ hasText: new RegExp(`^${label.replace(/[()]/g, '\\$&')}$`) }).locator('xpath=following-sibling::dd[1]')).toHaveText(expected);
    }
    expect(await panel.textContent()).not.toContain(text);
    await page.getByRole('button', { name: 'Save card', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Full-screen barcode', exact: true })).toBeVisible();
    const displayed = await page.getByRole('img', { name: 'Campus card barcode', exact: true }).screenshot();
    const decoded = await page.evaluate(async bytes => {
      const { decodePhoto } = await import('/src/campus-card/barcode.ts');
      const card = await decodePhoto(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      return { value: card.value, format: card.format, variant: card.symbologyIdentifier };
    }, Array.from(displayed));
    expect(decoded).toEqual({ value: text, format, variant });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Full-screen barcode', exact: true })).toBeVisible();
  });
}

test('valid unsupported format reports decoding success and writer capability separately', async ({ page }) => {
  const payload = 'SYNTHETIC-DIAGNOSTIC-PRIVATE';
  await syntheticCamera(page, 'QRCode', payload);
  await page.getByRole('button', { name: 'Scan barcode', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Barcode decoded');
  const panel = page.getByLabel('Barcode diagnostics', { exact: true });
  await expect(panel).toContainText('QRCode'); await expect(panel).toContainText(']Q1');
  await expect(panel.locator('dt').filter({ hasText: /^Scanning$/ }).locator('xpath=following-sibling::dd[1]')).toHaveText('Succeeded');
  await expect(panel.locator('dt').filter({ hasText: /^Library can generate format$/ }).locator('xpath=following-sibling::dd[1]')).toHaveText('Yes');
  await expect(panel.locator('dt').filter({ hasText: /^Generation$/ }).locator('xpath=following-sibling::dd[1]')).toHaveText('Not attempted');
  await expect(panel).toContainText('only accepts its supported 1D card formats');
  expect(await panel.textContent()).not.toContain(payload);
});
