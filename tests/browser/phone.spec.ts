import { test, expect, type Page, type Locator } from '@playwright/test';

const from = (page: Page) => page.getByRole('combobox', { name: 'From', exact: true });
const to = (page: Page) => page.getByRole('combobox', { name: 'To', exact: true });
const pin = (page: Page, which: 'origin' | 'destination') => page.getByRole('button', { name: `Place ${which} on map` });
const marker = (page: Page, which: 'Origin' | 'Destination') => page.getByRole('button', { name: new RegExp(`^${which} marker`) });
async function example(page: Page) {
  await page.goto('http://localhost:3001');
  await page.getByRole('button', { name: 'About Durham Journeys' }).click();
  await page.getByRole('button', { name: /Load verified/ }).click();
}
async function mapTap(page: Page, fraction: number, y: number, touch = false) {
  const box = (await page.locator('.map').boundingBox())!;
  const options = { position: { x: box.width * fraction, y } };
  if (touch) await page.locator('.map').tap(options); else await page.locator('.map').click(options);
}
async function dragMouse(page: Page, node: Locator, dx: number, dy: number) {
  const b = (await node.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 12 }); await page.mouse.up();
}

test('desktop remains a narrow phone-sized map, without banner, swap or zoom controls', async ({ page }) => {
  await page.goto('http://localhost:3001');
  expect((await page.locator('.app').boundingBox())!.width).toBeLessThanOrEqual(430);
  await expect(page.locator('header,.app-header,.swap-control,.swap-space,.swap-gap,.leaflet-control-zoom')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Recenter on current location' })).toBeVisible();
  await expect(page.locator('.search-icon')).toHaveCount(2);
  await expect(page.locator('.location-dot')).toHaveCount(0);
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: 'artifacts/phone-desktop.png' });
});

test('live bus journey keeps waiting, walking alternatives and geometry', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-12T08:20:00Z') });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await example(page);
  const response = page.waitForResponse(r => r.url().endsWith('/api/journeys') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Find route' }).click();
  const received = await response; expect(received.status()).toBe(200);
  const result = await received.json(); expect(result.bus.length).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Routes', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Walking journey/ })).toBeVisible();
  const index = result.bus.slice(0, 5).findIndex((i: any) => i.legs[0].mode === 'WALK' && i.initialWaitSeconds > 60);
  expect(index).toBeGreaterThanOrEqual(0);
  const itinerary = result.bus[index]; const firstBus = itinerary.legs.findIndex((l: any) => l.mode === 'BUS');
  const walking = itinerary.legs.slice(0, firstBus).reduce((s: number, l: any) => s + (l.endTime - l.startTime) / 1000, 0);
  const fullWait = (itinerary.legs[firstBus].startTime - Date.parse(result.requestedDeparture)) / 1000 - walking;
  const card = page.getByRole('button', { name: /^Bus journey/ }).nth(index);
  await card.click();
  await expect(card.locator('..').locator('.wait-leg .leg-heading>span').first()).toHaveText(fullWait < 60 ? `${Math.ceil(fullWait)} sec` : `${Math.round(fullWait / 60)} min`);
  await expect(page.locator('.leaflet-overlay-pane path').first()).toBeAttached();
  await card.click(); await expect(page.locator('.leaflet-overlay-pane path').first()).toBeAttached();
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/phone-journey-desktop.png' });
});

test('search drafts restore selected coordinates, and keyboard suggestions commit only one field', async ({ page }) => {
  await example(page);
  const config = await (await page.request.get('http://localhost:3001/api/config')).json();
  await from(page).click(); await expect(from(page)).toHaveValue(''); await from(page).fill('Invalid unselected draft');
  await to(page).click(); await expect(from(page)).toHaveValue(config.example.from.name);
  await to(page).fill('Invalid destination'); await to(page).press('Escape'); await expect(to(page)).toHaveValue(config.example.to.name);
  const sent = page.waitForRequest(r => r.url().endsWith('/api/journeys') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Find route' }).click();
  expect((await sent).postDataJSON().from).toEqual({ lat: config.example.from.lat, lon: config.example.from.lon });
  await page.locator('.sheet-body').evaluate(el => { el.scrollTop = 0; });
  await to(page).click(); await to(page).fill('Bill Bryson');
  await expect(page.getByRole('option').first()).toBeVisible(); await to(page).press('ArrowDown'); await to(page).press('Enter');
  await expect(to(page)).toHaveValue('Bill Bryson Library'); await expect(from(page)).toHaveValue(config.example.from.name);
});

test('one-tap placement deselects immediately, and existing markers drag without active tools', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await pin(page, 'origin').click(); await mapTap(page, .3, 130);
  await expect(pin(page, 'origin')).toHaveAttribute('aria-pressed', 'false');
  const origin = await from(page).inputValue(); await mapTap(page, .4, 160); await expect(from(page)).toHaveValue(origin);
  await pin(page, 'destination').click(); await mapTap(page, .7, 180);
  await expect(pin(page, 'destination')).toHaveAttribute('aria-pressed', 'false');
  const destination = await to(page).inputValue();
  await dragMouse(page, marker(page, 'Destination'), -35, -25);
  await expect(to(page)).not.toHaveValue(destination); await expect(from(page)).toHaveValue(origin);
  await pin(page, 'origin').click(); await mapTap(page, .4, 200);
  await expect(marker(page, 'Origin')).toHaveCount(1); await expect(marker(page, 'Destination')).toHaveCount(1);
  await marker(page, 'Origin').focus(); const before = await from(page).inputValue(); await marker(page, 'Origin').press('ArrowRight');
  await expect(from(page)).not.toHaveValue(before);
  await page.getByRole('button', { name: 'Clear from' }).click(); await expect(marker(page, 'Origin')).toHaveCount(0);
});

test('GPS recenter changes only the map, preserves selections, and permission errors are graceful', async ({ page }) => {
  await example(page);
  const config = await (await page.request.get('http://localhost:3001/api/config')).json();
  const gpsPoint = { lat: config.example.from.lat + .002, lon: config.example.from.lon + .002 };
  await page.evaluate(point => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (ok: (p: any) => void) => ok({ coords: { latitude: point.lat, longitude: point.lon, accuracy: 10 } }) } }), gpsPoint);
  await page.getByRole('button', { name: 'Recenter on current location' }).click();
  await expect(from(page)).toHaveValue(config.example.from.name); await expect(to(page)).toHaveValue(config.example.to.name);
  const map = (await page.locator('.map').boundingBox())!, sheet = (await page.locator('.planner').boundingBox())!;
  await pin(page, 'origin').click();
  await page.locator('.map').click({ position: { x: map.width / 2, y: (map.height - sheet.height) / 2 } });
  const point = (await from(page).inputValue()).match(/\((-?[\d.]+), (-?[\d.]+)\)/)!;
  // Leaflet rounds projected positions to screen pixels at zoom 14.
  expect(Math.abs(Number(point[1]) - gpsPoint.lat)).toBeLessThan(.0001);
  expect(Math.abs(Number(point[2]) - gpsPoint.lon)).toBeLessThan(.0001);
  await page.evaluate(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) => fail({ code: 1 }) } }));
  await page.getByRole('button', { name: 'Recenter on current location' }).click();
  await expect(page.locator('.map-message')).toContainText('Location unavailable');
  await page.getByRole('button', { name: 'Use my location', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not access your location');
});

test.describe('phone touch gestures', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('bottom sheet drags between collapsed, mid and expanded positions', async ({ page }) => {
    await page.goto('http://localhost:3001');
    const session = await page.context().newCDPSession(page);
    async function swipeHandle(dy: number) {
      const box = (await page.getByRole('button', { name: 'Resize journey panel' }).boundingBox())!;
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      for (let i = 1; i <= 12; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dy * i / 12, id: 1 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await expect(page.locator('.planner')).toHaveAttribute('data-state', 'mid');
    await swipeHandle(-320); await expect(page.locator('.planner')).toHaveAttribute('data-state', 'expanded');
    await swipeHandle(660); await expect(page.locator('.planner')).toHaveAttribute('data-state', 'collapsed');
    await expect(from(page)).not.toBeVisible();
    await page.getByRole('button', { name: 'Resize journey panel' }).press('ArrowUp');
    await expect(page.locator('.planner')).toHaveAttribute('data-state', 'mid'); await expect(from(page)).toBeVisible();
    await session.detach();
  });

  test('menu long-press drops and touch marker drags work with one-shot placement', async ({ page }) => {
    await page.goto('http://localhost:3001');
    const session = await page.context().newCDPSession(page);
    const box = (await pin(page, 'origin').boundingBox())!;
    const map = (await page.locator('.map').boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await expect(page.locator('.menu-pin-preview')).toBeAttached();
    for (let i = 1; i <= 12; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (map.x + 100 - x) * i / 12, y: y + (map.y + 150 - y) * i / 12, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(from(page)).toHaveValue(/Map point/); await expect(pin(page, 'origin')).toHaveAttribute('aria-pressed', 'false');
    await pin(page, 'destination').tap(); await mapTap(page, .7, 190, true);
    const before = await to(page).inputValue(); const markerBox = (await marker(page, 'Destination').boundingBox())!;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: markerBox.x + 22, y: markerBox.y + 22, id: 1 }] });
    for (let i = 1; i <= 8; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: markerBox.x + 22 - i * 3, y: markerBox.y + 22 - i * 3, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
    await expect(to(page)).not.toHaveValue(before); await expect(marker(page, 'Origin')).toHaveCount(1); await expect(marker(page, 'Destination')).toHaveCount(1);
  });

  test('mobile route search and touch suggestions preserve the timing breakdown', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-12T08:20:00Z') }); await example(page);
    await to(page).tap(); await expect(to(page)).toHaveValue(''); await to(page).fill('Bill Bryson');
    await page.getByRole('option').filter({ hasText: 'Bill Bryson Library' }).first().tap(); await expect(to(page)).toHaveValue('Bill Bryson Library');
    await page.getByRole('button', { name: 'Find route' }).tap();
    await expect(page.getByRole('heading', { name: 'Routes', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Walking journey/ })).toBeVisible();
    await page.getByRole('button', { name: /^Bus journey/ }).first().tap(); await expect(page.locator('.bus-leg').first()).toBeVisible();
    await expect(page.locator('.leaflet-overlay-pane path').first()).toBeAttached();
    await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: 'artifacts/phone-mobile-journey.png' });
  });
});

test('320px layout remains usable and time-only departures convert overnight', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await page.clock.install({ time: new Date('2026-10-12T20:00:00Z') }); await example(page);
  await page.getByLabel('Departure hour').selectOption('02'); await page.getByLabel('Departure minute').selectOption('00');
  const sent = page.waitForRequest(r => r.url().endsWith('/api/journeys') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Find route' }).click();
  expect((await sent).postDataJSON().departure).toEqual({ date: '2026-10-13', time: '02:00:00', occurrence: 'earlier' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: 'artifacts/phone-320px.png' });
});
