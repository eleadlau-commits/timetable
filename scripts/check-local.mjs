import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { createHash, X509Certificate } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const base = new URL('../', import.meta.url);
const lan = JSON.parse(readFileSync(new URL('.dev-run/5443.json', base), 'utf8'));
const ca = readFileSync(new URL('.dev-certs/root-ca.pem', base));
function get(url, secure = false) {
  return new Promise((resolve, reject) => {
    const req = (secure ? https : http).get(url, secure ? { ca } : {}, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(5000, () => req.destroy(new Error('Local request timed out'))); req.on('error', reject);
  });
}
const httpsURL = `https://${lan.host}:5443`;
for (const [url, secure] of [['http://127.0.0.1:5173/', false], [`${httpsURL}/`, true]]) {
  const result = await get(url, secure); assert.equal(result.status, 200); assert.match(result.body.toString(), /Durham Campus Card/);
}
assert.equal((await get(`${httpsURL}/.dev-certs/root-ca.key`, true)).status, 403);
assert.equal((await get(`${httpsURL}/.dev-run/5443.json`, true)).status, 403);
const download = await get(`http://${lan.host}:5442/campus-card-dev-ca.cer`);
assert.equal(download.status, 200); assert.deepEqual(download.body, new X509Certificate(ca).raw);
assert.equal((await get(`http://${lan.host}:5442/.dev-certs/root-ca.key`)).status, 404);
console.log('HTTP/HTTPS loading, CA chain and hostname validation, certificate download and private-file blocking passed.');

// Pin only our leaf key for this automated browser. No system trust store changes.
const certificate = new X509Certificate(readFileSync(new URL('.dev-certs/server.pem', base)));
const pin = createHash('sha256').update(certificate.publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
const browser = await chromium.launch({ args: [`--ignore-certificate-errors-spki-list=${pin}`, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(httpsURL);
  await page.getByRole('heading', { name: 'Campus Card', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => isSecureContext), true);
  await page.getByRole('button', { name: 'Scan barcode', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0);
  await page.evaluate(() => { window.__cameraTestTracks = document.querySelector('video').srcObject.getTracks(); });
  await page.getByRole('button', { name: 'Cancel scan', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__cameraTestTracks.every(track => track.readyState === 'ended')), true);
  assert.deepEqual(errors, []);
  console.log('HTTPS browser secure context, native getUserMedia preview (synthetic device), cancellation and camera cleanup passed.');
} finally { await browser.close(); }
