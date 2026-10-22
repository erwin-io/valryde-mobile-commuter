/* Production adapter smoke test. Synthetic route metadata only; no synthetic vehicle in runtime. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http'); const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const root = path.resolve('dist/valryde-mobile-commuter/browser');
const server = http.createServer((req, res) => {
  let file = path.join(root, new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.setHeader('Content-Type', { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    fs.mkdirSync('docs/testing/evidence/tracking-ui', { recursive: true });
    for (const width of [390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 568 }, reducedMotion: 'reduce' });
      const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      const requests = [];
      await page.route('**/*', async route => {
        const url = new URL(route.request().url()); requests.push(url.pathname);
        if (url.origin !== base) return route.fulfill({ json: { version: 8, sources: {}, layers: [] } });
        if (url.pathname === '/api/transit-routes/11111111-1111-4111-8111-111111111111') return route.fulfill({ json: { route: {
          id: '11111111-1111-4111-8111-111111111111', routeCode: '04C', publicName: 'Carbon – Lahug', description: null, routeColorHex: '#137547', status: 'ACTIVE',
          createdAt: '2026-10-23T00:00:00Z', updatedAt: '2026-10-23T00:00:00Z', directions: [{ id: 'd1', routeId: '11111111-1111-4111-8111-111111111111', directionLabel: 'Outbound',
          originName: 'Carbon', destinationName: 'Lahug', geometry: { type: 'LineString', coordinates: [[123.9, 10.29], [123.91, 10.32]] }, corridorM: 100, status: 'ACTIVE', createdAt: '2026-10-23T00:00:00Z', updatedAt: '2026-10-23T00:00:00Z' }] } } });
        if (url.pathname === '/api/transit-routes') return route.fulfill({ json: { routes: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } });
        return route.continue();
      });
      await page.goto(`${base}/tabs/map?route=11111111-1111-4111-8111-111111111111&direction=d1`);
      await page.locator('canvas.maplibregl-canvas').waitFor();
      await page.locator('app-tracking-panel').getByText('Live jeepneys are unavailable.', { exact: true }).waitFor();
      await page.locator('app-route-detail').getByText('Carbon – Lahug', { exact: true }).waitFor();
      assert.equal(await page.locator('app-tracking-panel').innerText().then(t => t.includes('0 available')), false);
      assert.equal(requests.some(p => /snapshot|pusher|traccar|tracking/.test(p)), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `docs/testing/evidence/tracking-ui/CONTROLLED-route-production-gateway-${width}.png` });
      await context.setOffline(true); await page.locator('app-tracking-panel').getByText('You’re offline. Live jeepneys are hidden.', { exact: true }).waitFor();
      await context.setOffline(false); await page.locator('app-tracking-panel').getByText('Live jeepneys are unavailable.', { exact: true }).waitFor();
      assert.deepEqual(errors, []); console.log(`PASS ${width}px: real MapLibre startup, controlled official route, production unavailable adapter/no fabricated count/no tracking endpoint, offline/reconnect, no overflow/page errors`);
      await context.close();
    }
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
