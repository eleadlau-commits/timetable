// Optional local-only verification. Never use this as an automated real-data fixture.
// No screenshots, traces, videos, payloads or raw exceptions are written.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm';
let browser;
try {
  const buffer = readFileSync(process.argv[2] ?? 'credentials/durham-card-reference.jpg');
  prepareZXingModule({ overrides: { wasmBinary: readFileSync('node_modules/zxing-wasm/dist/full/zxing_full.wasm'), print: () => {}, printErr: () => {} } });
  const results = await readBarcodes(new Uint8Array(buffer), { formats: ['TelepenNumeric'], textMode: 'Plain' });
  const ocr = JSON.parse(readFileSync('credentials/private-ocr-result.json', 'utf8'));
  if (results.length !== 1 || !ocr.some(x => x.lines.some(line => line.replace(/\s/g, '') === results[0].text))) throw new Error();
  const expected = results[0].text;
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let blockedRequests = 0;
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || route.request().method() !== 'GET') { blockedRequests++; return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  let browserErrors = 0; page.on('pageerror', () => browserErrors++);
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Scan barcode', exact: true }).waitFor();
  await page.getByLabel('Barcode photograph', { exact: true }).setInputFiles({ name: 'local-reference.jpg', mimeType: 'image/jpeg', buffer });
  await page.getByRole('heading', { name: 'Preview your card' }).waitFor();
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await page.getByRole('button', { name: 'Full-screen barcode', exact: true }).waitFor();
  async function matchesStored() {
    return page.evaluate(async expected => {
      const { cardStorage } = await import('/src/campus-card/storage.ts');
      const saved = await cardStorage.load();
      return saved?.value === expected && saved?.format === 'TelepenNumeric' && saved?.symbologyIdentifier === ']B1';
    }, expected);
  }
  if (!await matchesStored()) throw new Error();
  await page.reload(); await page.getByRole('button', { name: 'Full-screen barcode', exact: true }).waitFor();
  if (!await matchesStored()) throw new Error();
  const image = await page.getByRole('img', { name: 'Campus card barcode', exact: true }).screenshot();
  const displayMatches = await page.evaluate(async ({ bytes, expected }) => {
    const { decodePhoto } = await import('/src/campus-card/barcode.ts');
    const decoded = await decodePhoto(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    return decoded.value === expected && decoded.format === 'TelepenNumeric' && decoded.symbologyIdentifier === ']B1';
  }, { bytes: Array.from(image), expected });
  if (!displayMatches) throw new Error();
  await page.getByRole('button', { name: 'Full-screen barcode', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Back to campus card', exact: true }).click();
  async function deleteCard() {
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete card', exact: true }).click();
    await page.getByRole('button', { name: 'Scan barcode', exact: true }).waitFor();
  }
  await deleteCard();
  await page.getByRole('button', { name: 'Enter code manually', exact: true }).click();
  await page.getByLabel('Number underneath the barcode').fill(expected);
  await page.getByRole('button', { name: 'Preview barcode', exact: true }).click();
  await page.getByRole('heading', { name: 'Preview your card' }).waitFor();
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await page.getByRole('button', { name: 'Full-screen barcode', exact: true }).waitFor();
  if (!await matchesStored()) throw new Error();
  await deleteCard();
  await page.evaluate(async image => {
    const bitmap = new Image(); bitmap.src = `data:image/jpeg;base64,${image}`; await bitmap.decode();
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
    setInterval(() => ctx.drawImage(bitmap, 0, 0), 150);
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => canvas.captureStream(8) });
  }, buffer.toString('base64'));
  await page.getByRole('button', { name: 'Scan barcode', exact: true }).click();
  await page.getByRole('heading', { name: 'Preview your card' }).waitFor();
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await page.getByRole('button', { name: 'Full-screen barcode', exact: true }).waitFor();
  if (!await matchesStored()) throw new Error();
  await deleteCard();
  if (blockedRequests || browserErrors) throw new Error();
  console.log(JSON.stringify({ photoPreviewSaveDisplay: true, reloadMatches: true, displayedPixelsMatch: true, manualMatches: true, fullScreenOpened: true, photographFedCameraPipelineMatches: true, privateCredentialDeleted: true, noExternalOrUploadRequests: true }));
} catch { console.error('Private workflow verification did not complete; credential and exception details were suppressed.'); process.exitCode = 1; }
finally { await browser?.close(); }
