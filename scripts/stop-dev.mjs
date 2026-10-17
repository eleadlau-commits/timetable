import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import https from 'node:https';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(root, '.dev-run');
if (!existsSync(directory)) { console.log('No Campus Card development servers recorded.'); process.exit(0); }
for (const file of readdirSync(directory).filter(name => /^\d+\.json$/.test(name))) {
  const entry = JSON.parse(readFileSync(resolve(directory, file), 'utf8'));
  if (![5173, 5443].includes(entry.port)) continue;
  await new Promise(resolve => {
    const transport = entry.https ? https : http;
    const req = transport.request({ hostname: entry.host, port: entry.port, path: '/__campus-card-dev/stop', method: 'POST', headers: { Authorization: `Bearer ${entry.token}` }, ...(entry.https ? { ca: readFileSync(new URL('../.dev-certs/root-ca.pem', import.meta.url)) } : {}) }, res => {
      res.resume(); console.log(res.statusCode === 202 ? `Stopped Campus Card on port ${entry.port}.` : `No matching Campus Card server on port ${entry.port}; left it untouched.`); resolve();
    });
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
    req.on('error', () => { console.log(`Campus Card on port ${entry.port} is not reachable.`); resolve(); });
    req.end();
  });
}
