import { test, expect } from '@playwright/test';

const place = { id: 'library', name: 'Bill Bryson Library', lat: 54.767, lon: -1.571, category: 'Library', source: 'Search' };
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/config') ? { operators: [], feed: { version: 'test', downloadedAt: '2026-10-13T00:00:00Z', startDate: '2026-10-01', endDate: '2026-10-31' }, example: {} }
      : path.endsWith('/places') ? { places: [place] }
      : path.endsWith('/journeys') ? { bus: [], walking: null, warnings: [], fastestId: null }
      : { ready: true };
    await route.fulfill({ json: body });
  });
});

test('GPS defaults remain editable, cancelled drafts restore, and selected coordinates replace GPS', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: {
    getCurrentPosition: (ok: any) => ok({ coords: { latitude: 54.775, longitude: -1.575, accuracy: 10 } }),
  } }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const from = page.getByRole('combobox', { name: 'From', exact: true });
  const to = page.getByRole('combobox', { name: 'To', exact: true });
  await expect(from).toHaveValue('Current location'); await expect(to).toHaveValue('');
  await from.click(); await expect(from).toHaveValue('');
  await from.fill('Unselected draft'); await from.press('Escape');
  await expect(from).toHaveValue('Current location');
  await from.click(); await from.fill('Another draft'); await to.click();
  await expect(from).toHaveValue('Current location');
  await from.click(); await from.fill('Bill Bryson');
  await expect(page.getByRole('option', { name: /Bill Bryson/ })).toBeVisible();
  await from.press('ArrowDown'); await from.press('Enter');
  await expect(from).toHaveValue(place.name); await expect(to).toHaveValue('');
  await to.click(); await to.fill('Bill Bryson');
  await page.getByRole('option', { name: /Bill Bryson/ }).click();
  const request = page.waitForRequest(r => r.url().endsWith('/api/journeys'));
  await page.getByRole('button', { name: 'Find route' }).click();
  expect((await request).postDataJSON().from).toEqual({ lat: place.lat, lon: place.lon });
  await page.getByRole('button', { name: 'Use my location', exact: true }).click();
  await expect(from).toHaveValue('Current location'); await expect(to).toHaveValue(place.name);
  await expect(page.getByRole('button', { name: 'Place origin on map' })).toBeVisible();
});

test('a late initial GPS response preserves a manually selected origin', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: {
    getCurrentPosition: (ok: any) => { (window as any).finishGPS = () => ok({ coords: { latitude: 54.775, longitude: -1.575, accuracy: 10 } }); },
  } }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const from = page.getByRole('combobox', { name: 'From', exact: true });
  await from.fill('Bill Bryson'); await page.getByRole('option', { name: /Bill Bryson/ }).click();
  await page.evaluate(() => (window as any).finishGPS());
  await expect(from).toHaveValue(place.name);
});

test('GPS denial leaves search available without an initial error', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: {
    getCurrentPosition: (_ok: any, fail: any) => fail({ code: 1 }),
  } }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('alert')).toHaveCount(0);
  const from = page.getByRole('combobox', { name: 'From', exact: true });
  await from.fill('Bill Bryson'); await page.getByRole('option', { name: /Bill Bryson/ }).click();
  await expect(from).toHaveValue(place.name);
});
