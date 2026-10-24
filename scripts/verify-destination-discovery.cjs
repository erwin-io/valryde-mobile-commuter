/* Controlled-contract browser regression; no real account or external provider is used. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve('dist/valryde-mobile-commuter/browser');
const evidence = path.resolve('docs/testing/evidence/destination-37');
const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
};
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.join(root, pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
    file = path.join(root, 'index.html');
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const start = { id: 'osm:N:1', name: 'Carbon', label: 'Carbon, Cebu City', lat: 10.29, lng: 123.9 };
const end = { id: 'osm:N:2', name: 'Ayala', label: 'Ayala, Cebu City', lat: 10.32, lng: 123.91 };
const candidate = {
  route: {
    id: '11111111-1111-4111-8111-111111111111',
    routeCode: '04C',
    publicName: 'Carbon – Lahug',
    routeColorHex: '#123456',
  },
  direction: {
    id: '22222222-2222-4222-8222-222222222222',
    directionLabel: 'Outbound',
    originName: 'Carbon',
    destinationName: 'Lahug',
  },
  originDistanceM: 120,
  destinationDistanceM: 340,
};
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  try {
    fs.mkdirSync(evidence, { recursive: true });
    for (const width of [390, 320]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 568 },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('framenavigated', frame => { if (frame === page.mainFrame()) console.log('NAV', new URL(frame.url()).pathname); });
      page.on('pageerror', (e) => errors.push(e.message));
      const discoveryCalls = [];
      let providerDown = false;
      let noRoute = false;
      await page.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== base)
          return route.fulfill({ json: { version: 8, sources: {}, layers: [] } });
        if (!url.pathname.startsWith('/api/')) return route.continue();
        if (url.pathname.endsWith('/auth/login'))
          return route.fulfill({
            json: {
              accessToken: 'synthetic-browser-access',
              refreshToken: 'synthetic-browser-refresh',
              accessTokenExpiresIn: 900,
              refreshTokenExpiresAt: '2099-01-01T00:00:00.000Z',
              user: {
                id: 'test-user',
                email: 'commuter@example.test',
                displayName: 'Test commuter',
                status: 'ACTIVE',
                emailVerified: true,
                roles: ['COMMUTER'],
                createdAt: '2026-10-23T00:00:00Z',
                updatedAt: '2026-10-23T00:00:00Z',
              },
            },
          });
        if (url.pathname.endsWith('/places/search')) {
          assert.equal(request.headers().authorization, 'Bearer synthetic-browser-access');
          if (providerDown)
            return route.fulfill({
              status: 503,
              json: { error: { code: 'GEOCODER_UNAVAILABLE' } },
            });
          return route.fulfill({
            json: {
              places: [url.searchParams.get('q') === 'Carbon' ? start : end],
              attribution: '© OpenStreetMap contributors',
            },
          });
        }
        if (url.pathname.endsWith('/transit-routes/discover')) {
          assert.equal(request.headers().authorization, undefined);
          assert.equal(url.searchParams.get('lat'), String(start.lat));
          assert.equal(url.searchParams.get('destinationLng'), String(end.lng));
          discoveryCalls.push(url.pathname);
          return route.fulfill({
            json: { candidates: noRoute ? [] : [candidate], directRouteFound: !noRoute },
          });
        }
        if (url.pathname === '/api/transit-routes')
          return route.fulfill({
            json: { routes: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
          });
        return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
      });
      await page.goto(`${base}/tabs/routes`);
      await page.locator('ion-segment-button[value=trip]').click();
      await page.getByText('Sign in to search places', { exact: true }).waitFor();
      await page.getByRole('link', { name: 'Sign in', exact: true }).click();
      await page.locator('input[type=email]').fill('commuter@example.test');
      await page.locator('input[type=password]').fill('synthetic-browser-password');
      await page.locator('ion-button[type=submit]').click();
      await page.waitForURL('**/tabs/account');
      await page.locator('ion-tab-button[tab=routes]').click();
      await page.locator('ion-segment-button[value=trip]').click();
      await page.getByRole('button', { name: 'Change start', exact: true }).click();
      await page.locator('app-trip-planner input').fill('Carbon');
      await page.getByRole('button', { name: 'Search places', exact: true }).click();
      await page.getByText('Carbon, Cebu City', { exact: true }).click();
      await page.getByRole('button', { name: 'Change destination', exact: true }).click();
      await page.locator('app-trip-planner input').fill('Ayala');
      providerDown = true;
      await page.getByRole('button', { name: 'Search places', exact: true }).click();
      await page.getByText('Place search is temporarily unavailable', { exact: true }).waitFor();
      providerDown = false;
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.getByText('Ayala, Cebu City', { exact: true }).waitFor();
      await page.getByText('© OpenStreetMap contributors', { exact: true }).waitFor();
      await page.getByText('Ayala, Cebu City', { exact: true }).click();
      noRoute = true;
      await page.getByRole('button', { name: 'Find direct routes', exact: true }).click();
      await page.getByText('No direct route found', { exact: true }).waitFor();
      noRoute = false;
      await page.getByRole('button', { name: 'Find direct routes', exact: true }).click();
      await page.getByText('04C · Carbon – Lahug', { exact: true }).waitFor();
      await page
        .getByText('Route proximity: 120 m from start · 340 m from destination', { exact: true })
        .scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.screenshot({
        path: path.join(evidence, `CONTROLLED-direct-results-${width}.png`),
        fullPage: true,
      });
      await page.getByText('04C · Carbon – Lahug', { exact: true }).click();
      await page.waitForURL(
        `**/tabs/map?route=${candidate.route.id}&direction=${candidate.direction.id}`,
      );
      assert.equal(discoveryCalls.length, 2);
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${width}px: normal login, authenticated place search, provider failure/retry, attribution, no-direct-route, discovery without bearer, exact route/direction map handoff, no horizontal overflow/page errors`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
