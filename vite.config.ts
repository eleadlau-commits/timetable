import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
export default defineConfig({
  plugins: [react(), {
    name: 'campus-card-local-stop', apply: 'serve',
    configureServer(server) {
      const token = randomBytes(32).toString('hex');
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address();
        if (!address || typeof address === 'string') return;
        const directory = resolve(server.config.root, '.dev-run');
        mkdirSync(directory, { recursive: true });
        writeFileSync(resolve(directory, `${address.port}.json`), JSON.stringify({ host: address.address, port: address.port, https: !!server.config.server.https, token }));
      });
      server.middlewares.use('/__campus-card-dev/stop', (req, res) => {
        if (req.method !== 'POST' || req.headers.authorization !== `Bearer ${token}`) { res.statusCode = 403; res.end(); return; }
        res.statusCode = 202; res.end('Stopping Campus Card development server.');
        setTimeout(() => process.kill(process.pid, 'SIGTERM'), 150);
      });
    },
  }],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.git-backup/**', '**/.dev-certs/**', '**/.dev-run/**', '**/credentials/**', '**/secrets/**'] },
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
