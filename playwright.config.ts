import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/browser', globalSetup: './tests/browser/setup.ts', timeout: 90000, workers: 1, retries: 0, use: { baseURL: 'http://localhost:3001', browserName: 'chromium', headless: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' } });
