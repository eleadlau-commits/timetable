import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/card-browser', timeout: 30000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', viewport: { width: 390, height: 844 }, trace: 'off' },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
