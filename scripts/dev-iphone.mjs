import { createServer as createViteServer } from 'vite';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes, X509Certificate } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(root, '.dev-certs');
const privateIPv4 = ip => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
const interfaces = Object.entries(networkInterfaces()).flatMap(([name, entries]) => (entries ?? []).filter(e => e.family === 'IPv4' && !e.internal && privateIPv4(e.address)).map(e => ({ name, address: e.address })));
const requested = process.env.CAMPUS_CARD_LAN_IP;
const selected = requested ? interfaces.find(i => i.address === requested) : interfaces.find(i => /wi-?fi|wireless|en0/i.test(i.name)) ?? interfaces.find(i => !/virtual|vethernet|docker|wsl/i.test(i.name));
if (!selected) throw new Error('No private LAN IPv4 address found. Connect to Wi-Fi, or set CAMPUS_CARD_LAN_IP to a private address on this computer.');
const address = selected.address;
const candidates = [process.env.OPENSSL_PATH, 'openssl', 'C:/Program Files/Git/usr/bin/openssl.exe', 'C:/Program Files/Git/mingw64/bin/openssl.exe'].filter(Boolean);
const openssl = candidates.find(candidate => spawnSync(candidate, ['version'], { windowsHide: true, stdio: 'ignore' }).status === 0);
if (!openssl) throw new Error('OpenSSL is required. Install Git for Windows (includes OpenSSL), or set OPENSSL_PATH to an existing OpenSSL executable.');
mkdirSync(directory, { recursive: true });
function run(args) {
  const result = spawnSync(openssl, args, { cwd: directory, windowsHide: true, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`OpenSSL certificate setup failed: ${result.stderr || result.error?.message}`);
}
const caFile = resolve(directory, 'root-ca.pem');
if (!existsSync(caFile)) {
  run(['req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-keyout', 'root-ca.key', '-out', 'root-ca.pem', '-days', '365', '-sha256', '-subj', '/CN=Campus Card Local Development CA', '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0', '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
}
const ca = new X509Certificate(readFileSync(caFile));
if (Date.parse(ca.validTo) <= Date.now() + 86400000) throw new Error('Development CA expired or expires tomorrow. Rename .dev-certs, run again and reinstall the new CA on your test devices.');
const certFile = resolve(directory, 'server.pem');
let renew = true;
if (existsSync(certFile)) {
  const cert = new X509Certificate(readFileSync(certFile));
  renew = !cert.checkIP(address) || !cert.verify(ca.publicKey) || Date.parse(cert.validTo) < Date.now() + 86400000;
}
if (renew) {
  writeFileSync(resolve(directory, 'server.ext'), `basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost,IP:127.0.0.1,IP:${address}\n`);
  run(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'server.key', '-out', 'server.csr', '-sha256', '-subj', '/CN=Campus Card Local Development']);
  run(['x509', '-req', '-in', 'server.csr', '-CA', 'root-ca.pem', '-CAkey', 'root-ca.key', '-set_serial', `0x${randomBytes(16).toString('hex')}`, '-out', 'server.pem', '-days', '30', '-sha256', '-extfile', 'server.ext']);
}
run(['x509', '-in', 'root-ca.pem', '-outform', 'DER', '-out', 'campus-card-dev-ca.cer']);

const certificateDownload = createServer((req, res) => {
  if (req.method !== 'GET' || req.url !== '/campus-card-dev-ca.cer') { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="campus-card-dev-ca.cer"', 'Cache-Control': 'no-store' });
  res.end(readFileSync(resolve(directory, 'campus-card-dev-ca.cer')));
});
const vite = await createViteServer({ root, server: { host: address, port: 5443, strictPort: true, https: { key: readFileSync(resolve(directory, 'server.key')), cert: readFileSync(certFile) } } });
try {
  await vite.listen();
  await new Promise((resolve, reject) => { certificateDownload.once('error', reject); certificateDownload.listen(5442, address, resolve); });
} catch (error) { certificateDownload.close(); await vite.close(); throw error; }
console.log(`\nCampus Card private Wi-Fi HTTPS: https://${address}:5443\nInstall test CA on iPhone: http://${address}:5442/campus-card-dev-ca.cer\nCA SHA-256 fingerprint: ${ca.fingerprint256}\nOnly the public CA certificate is served over HTTP. Private keys stay in .dev-certs.\nPress Ctrl+C to stop both servers.\n`);
let stopping = false;
async function stop() { if (stopping) return; stopping = true; certificateDownload.close(); await vite.close(); }
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
