/* Real VALRYDE acceptance only. No route interception, injected payloads, or provider stubs.
 * Optional credentials must come from process environment, never a repository .env file.
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const backend = new URL(process.env.VALRYDE_ACCEPTANCE_API_ORIGIN || 'http://127.0.0.1:3000');
assert.ok(
  ['http:', 'https:'].includes(backend.protocol) &&
    !backend.username &&
    !backend.password &&
    !backend.search &&
    !backend.hash,
);
assert.ok(
  ['127.0.0.1', 'localhost', '[::1]'].includes(backend.hostname) && backend.port === '3000',
  'Only the approved loopback development API is permitted.',
);
const root = path.resolve('dist/valryde-mobile-commuter/browser');
const directory = path.resolve('docs/testing/evidence/rapid-004');
const report = {
  executedAt: new Date().toISOString(),
  backendOrigin: backend.origin,
  mode: 'REAL_BACKEND_NO_MOCKS',
  checks: [],
  gaps: [],
  apiResponses: [],
};
report.database = {
  name: 'valryde_ui_dev',
  verification: 'Tech Lead attested; health endpoint does not expose database identity',
};
let browser, server, accessToken, refreshToken, providerResults;
const browserRefreshTokens = new Set();
const email = process.env.VALRYDE_FIXTURE_EMAIL;
let password = process.env.VALRYDE_FIXTURE_PASSWORD;
report.credentialsStatus =
  email && password ? 'CONFIGURED_FOR_CHILD_PROCESS' : 'CREDENTIALS_NOT_CONFIGURED';
// Avoid passing credentials from this process to browser/other child processes.
delete process.env.VALRYDE_FIXTURE_EMAIL;
delete process.env.VALRYDE_FIXTURE_PASSWORD;
async function check(name, execute) {
  try {
    await execute();
    report.checks.push({ name, result: 'PASSED' });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, result: 'FAILED', errorType: error.name });
    throw new Error(name);
  }
}
async function api(endpoint, options = {}) {
  const response = await fetch(new URL(endpoint, backend), {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  report.apiResponses.push({
    method: options.method || 'GET',
    path: new URL(endpoint, backend).pathname,
    status: response.status,
  });
  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json(),
    headers: response.headers,
  };
}
(async () => {
  fs.mkdirSync(directory, { recursive: true });
  await check('backend-health', async () => {
    const r = await api('/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ok');
    assert.equal(r.body.database, 'ok');
  });
  let routes, direction, first, last;
  await check('real-seeded-route-list-and-detail', async () => {
    const r = await api('/api/transit-routes?page=1&pageSize=20');
    assert.equal(r.status, 200);
    routes = r.body.routes;
    assert.ok(Array.isArray(routes) && routes.length > 0);
    assert.ok(r.body.pagination.total >= routes.length);
    const detail = await api(`/api/transit-routes/${encodeURIComponent(routes[0].id)}`);
    assert.equal(detail.status, 200);
    direction = detail.body.route.directions.find(
      (d) => d.status === 'ACTIVE' && d.geometry.coordinates.length >= 2,
    );
    assert.ok(direction);
    first = direction.geometry.coordinates[0];
    last = direction.geometry.coordinates.at(-1);
  });
  await check('place-search-auth-boundary', async () => {
    const r = await api('/api/places/search?q=Ayala&limit=5');
    assert.equal(r.status, 401);
    assert.equal(r.body.error.code, 'AUTH_REQUIRED');
  });
  await check('real-direct-discovery-forward-travel-order', async () => {
    const params = new URLSearchParams({
      lat: first[1],
      lng: first[0],
      destinationLat: last[1],
      destinationLng: last[0],
      maxWalkM: 500,
      limit: 5,
    });
    const r = await api(`/api/transit-routes/discover?${params}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.directRouteFound, true);
    assert.ok(
      r.body.candidates.some((c) => c.route.id === routes[0].id && c.direction.id === direction.id),
    );
    for (const candidate of r.body.candidates) {
      assert.ok(candidate.originDistanceM >= 0 && candidate.destinationDistanceM >= 0);
      assert.ok(candidate.route.routeCode && candidate.direction.directionLabel);
    }
  });
  await check('real-direct-discovery-empty', async () => {
    const r = await api(
      '/api/transit-routes/discover?lat=4&lng=116&destinationLat=4.01&destinationLng=116.01&maxWalkM=50&limit=5',
    );
    assert.equal(r.status, 200);
    assert.equal(r.body.directRouteFound, false);
    assert.deepEqual(r.body.candidates, []);
  });
  await check('real-discovery-invalid-coordinates', async () => {
    const r = await api(
      '/api/transit-routes/discover?lat=0&lng=0&destinationLat=0&destinationLng=0',
    );
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'VALIDATION_ERROR');
  });
  if (email && password) {
    assert.equal(
      email,
      'dev.commuter@valryde.test',
      'Only the approved seeded commuter account is permitted.',
    );
    assert.equal(
      process.env.VALRYDE_ACCEPTANCE_DATABASE,
      'valryde_ui_dev',
      'Explicit isolated fixture database confirmation required for authenticated tests.',
    );
    report.credentialsStatus = 'CONFIGURED_FOR_CHILD_PROCESS';
    await check('real-fixture-login-and-commuter-profile', async () => {
      const r = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      assert.equal(r.status, 200);
      accessToken = r.body.accessToken;
      refreshToken = r.body.refreshToken;
      assert.ok(accessToken && refreshToken);
      assert.ok(r.body.user.roles.includes('COMMUTER'));
      assert.equal(r.body.user.email, 'dev.commuter@valryde.test');
      assert.equal(r.body.user.id, 'd1000000-0000-4000-8000-000000000001');
      const me = await api('/api/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      assert.equal(me.status, 200);
      assert.ok(me.body.user.emailVerified);
    });
    await check('real-fixture-profile-update-and-restore', async () => {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const before = await api('/api/auth/me', { headers });
      const originalName = before.body.user.displayName;
      try {
        const changed = await api('/api/auth/me', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ displayName: 'Commuter acceptance 004' }),
        });
        assert.equal(changed.status, 200);
        assert.equal(changed.body.user.displayName, 'Commuter acceptance 004');
      } finally {
        const restored = await api('/api/auth/me', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ displayName: originalName }),
        });
        assert.equal(restored.status, 200);
        assert.equal(restored.body.user.displayName, originalName);
      }
    });
    await check('real-authenticated-G6-place-response', async () => {
      providerResults = await api('/api/places/search?q=Ayala&limit=5', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (providerResults.status === 503) {
        assert.equal(providerResults.body.error.code, 'GEOCODER_UNAVAILABLE');
        report.providerState = 'GEOCODER_UNAVAILABLE_503';
        report.gaps.push(
          'Live provider-enabled place candidates, attribution and place-empty acceptance unavailable; authenticated provider returned 503.',
        );
      } else {
        assert.equal(providerResults.status, 200);
        assert.ok(Array.isArray(providerResults.body.places));
        assert.ok(
          typeof providerResults.body.attribution === 'string' &&
            providerResults.body.attribution.length > 0,
        );
        for (const place of providerResults.body.places) {
          assert.deepEqual(Object.keys(place).sort(), ['id', 'label', 'lat', 'lng', 'name']);
          assert.ok(place.lat >= 4 && place.lat <= 21.5 && place.lng >= 116 && place.lng <= 127);
        }
        report.providerState = providerResults.body.places.length
          ? 'NORMALIZED_CANDIDATES_200'
          : 'EMPTY_PLACES_200';
      }
    });
  } else {
    report.credentialsStatus = 'CREDENTIALS_NOT_CONFIGURED';
    report.gaps.push(
      'Authenticated acceptance CREDENTIALS_NOT_CONFIGURED; neither passed nor failed.',
    );
  }
  server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const upstream = await fetch(new URL(url.pathname + url.search, backend), {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
            ...(request.headers.authorization
              ? { Authorization: request.headers.authorization }
              : {}),
          },
          ...(request.method !== 'GET' && request.method !== 'HEAD'
            ? { body: Buffer.concat(chunks) }
            : {}),
          signal: AbortSignal.timeout(15000),
        });
        report.apiResponses.push({
          method: request.method,
          path: url.pathname,
          status: upstream.status,
          via: 'browser-proxy',
        });
        response.writeHead(upstream.status, {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          ...(upstream.headers.has('retry-after')
            ? { 'Retry-After': upstream.headers.get('retry-after') }
            : {}),
        });
        response.end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      let file = path.join(root, decodeURIComponent(url.pathname));
      if (
        !file.startsWith(root + path.sep) ||
        !fs.existsSync(file) ||
        fs.statSync(file).isDirectory()
      )
        file = path.join(root, 'index.html');
      response.setHeader(
        'Content-Type',
        {
          '.js': 'text/javascript',
          '.mjs': 'text/javascript',
          '.css': 'text/css',
          '.html': 'text/html',
          '.json': 'application/json',
        }[path.extname(file)] || 'application/octet-stream',
      );
      fs.createReadStream(file).pipe(response);
    } catch {
      response.writeHead(502, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: { code: 'ACCEPTANCE_PROXY_UNREACHABLE' } }));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--deny-permission-prompts'],
  });
  for (const width of [390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 568 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', () => pageErrors.push('pageerror'));
    await check(`real-browser-route-list-detail-map-${width}`, async () => {
      await page.goto(`${base}/tabs/routes`);
      await page.getByText(routes[0].publicName, { exact: true }).click();
      await page.waitForURL('**/tabs/map?route=*');
      await page.locator('canvas.maplibregl-canvas').waitFor();
      await page
        .locator('app-route-detail')
        .getByText(routes[0].publicName, { exact: true })
        .waitFor();
      // Provider style must load. This run does not stub tiles/styles or hide provider failures.
      await page.waitForFunction(
        () => !document.querySelector('app-transit-map')?.textContent.includes('Loading map'),
        { timeout: 20000 },
      );
      assert.equal(await page.getByText('The map couldn’t load', { exact: true }).count(), 0);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      assert.deepEqual(pageErrors, []);
      await page.screenshot({ path: path.join(directory, `REAL-route-map-${width}.png`) });
    });
    await check(`real-browser-map-permission-denial-and-pitch-${width}`, async () => {
      await page.getByRole('button', { name: 'Close route details', exact: true }).click();
      await page.getByRole('button', { name: 'Tilt map', exact: true }).click();
      await page.getByRole('button', { name: 'Use 2D map', exact: true }).click();
      await page.getByRole('button', { name: 'Show and follow my location', exact: true }).click();
      await page.getByText('Show where you are?', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Allow', exact: true }).click();
      await page
        .getByText(
          'Location is off for VALRYDE. You can still browse the map, or turn location on in your device settings.',
          { exact: true },
        )
        .waitFor();
      const permission = await page.evaluate(
        async () => (await navigator.permissions.query({ name: 'geolocation' })).state,
      );
      assert.equal(permission, 'denied');
      assert.equal(
        await page.getByRole('button', { name: 'Stop following my location', exact: true }).count(),
        0,
      );
    });
    await check(`real-browser-offline-metadata-and-reconnect-${width}`, async () => {
      await page.locator('ion-tab-button[tab=routes]').click();
      await context.setOffline(true);
      await page
        .locator('ion-refresher')
        .evaluate((element) =>
          element.dispatchEvent(new CustomEvent('ionRefresh', { bubbles: true })),
        );
      await page.locator('.offline-note').waitFor();
      await page.getByText(routes[0].publicName, { exact: true }).click();
      await page.locator('app-route-detail .offline').waitFor();
      const reconciledResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/transit-routes/${routes[0].id}` &&
          response.status() === 200,
      );
      await context.setOffline(false);
      await reconciledResponse;
      // A cached route must reconcile without requiring a new route selection.
      await page.waitForFunction(() => !document.querySelector('app-route-detail .offline'), {
        timeout: 20000,
      });
      await page.getByRole('button', { name: 'Close route details', exact: true }).click();
      await page.locator('ion-tab-button[tab=routes]').click();
      await page
        .locator('ion-refresher')
        .evaluate((element) =>
          element.dispatchEvent(new CustomEvent('ionRefresh', { bubbles: true })),
        );
      await page.waitForFunction(() => !document.querySelector('.offline-note'));
    });
    if (email && password) {
      await check(`real-browser-auth-profile-and-G6-${width}`, async () => {
        await page.goto(`${base}/tabs/account/sign-in`);
        await page.locator('input[type=email]').fill(email);
        await page.locator('input[type=password]').fill(password);
        const loginResponse = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/api/auth/login' &&
            response.request().method() === 'POST',
        );
        await page.locator('ion-button[type=submit]').click();
        const actualLogin = await loginResponse;
        assert.equal(actualLogin.status(), 200);
        const browserBundle = await actualLogin.json();
        if (browserBundle.refreshToken) browserRefreshTokens.add(browserBundle.refreshToken);
        await page.waitForURL('**/tabs/account');
        await page.getByText('Profile', { exact: true }).waitFor();
        await page.locator('ion-tab-button[tab=routes]').click();
        await page.locator('ion-segment-button[value=trip]').click();
        await page.locator('app-trip-planner input').fill('Ayala');
        const placeResponse = page.waitForResponse(
          (response) => new URL(response.url()).pathname === '/api/places/search',
        );
        await page.getByRole('button', { name: 'Search places', exact: true }).click();
        const actualPlaces = await placeResponse;
        const placeBody = await actualPlaces.json();
        if (actualPlaces.status() === 503) {
          await page
            .getByText('Place search is temporarily unavailable', { exact: true })
            .waitFor();
          await page
            .getByText('Try again, or use Find a route to search route codes and names.', {
              exact: true,
            })
            .waitFor();
        } else {
          assert.equal(actualPlaces.status(), 200);
          await page.getByText(placeBody.attribution, { exact: true }).waitFor();
          if (placeBody.places.length) {
            const place = placeBody.places[0];
            await page
              .locator('app-trip-planner ion-item[button]')
              .filter({ hasText: place.label })
              .first()
              .click();
            await page.getByText(place.name, { exact: true }).waitFor();
            // The actual place was selected; permission/current-location is a separate native acceptance gate.
          } else
            await page
              .getByText('No places found. Try a nearby landmark or a more specific name.', {
                exact: true,
              })
              .waitFor();
        }
        await page.locator('ion-tab-button[tab=account]').click();
        await page.getByRole('button', { name: 'Sign out', exact: true }).click();
        await page.getByText('Your VALRYDE account', { exact: true }).waitFor();
      });
    }
    await context.close();
  }
  if (accessToken && process.env.VALRYDE_ACCEPTANCE_RATE_LIMIT === '1') {
    await check('real-fixture-place-rate-limit', async () => {
      let limited = false;
      for (let attempt = 0; attempt < 21; attempt++) {
        const r = await api('/api/places/search?q=Ayala&limit=5', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (r.status === 429) {
          assert.equal(r.body.error.code, 'RATE_LIMITED');
          assert.ok(r.headers.get('retry-after'));
          limited = true;
          break;
        }
        assert.ok([200, 503].includes(r.status));
      }
      assert.equal(limited, true);
    });
  } else if (accessToken)
    report.gaps.push(
      'Real place-search rate-limit probe NOT_RUN; use wrapper -TestRateLimit for the bounded fixture-account probe.',
    );
  if (refreshToken) {
    await check('real-refresh-rotation-and-logout', async () => {
      const oldRefresh = refreshToken;
      const rotated = await api('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
      assert.equal(rotated.status, 200);
      accessToken = rotated.body.accessToken;
      refreshToken = rotated.body.refreshToken;
      assert.notEqual(refreshToken, oldRefresh);
      const logout = await api('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
      assert.equal(logout.status, 204);
      const revoked = await api('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
      assert.equal(revoked.status, 401);
      refreshToken = null;
      accessToken = null;
    });
  }
  if (email && password) {
    await check('real-refresh-replay-race-revokes-own-family', async () => {
      const login = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      assert.equal(login.status, 200);
      refreshToken = login.body.refreshToken;
      const replayedToken = refreshToken;
      const results = await Promise.all(
        [0, 1].map(() =>
          api('/api/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken: replayedToken }),
          }),
        ),
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
      refreshToken = results.find((r) => r.status === 200).body.refreshToken;
      const family = await api('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
      assert.equal(family.status, 401);
      refreshToken = null;
    });
  }
  report.gaps.push(
    'Registration/verification/recovery/email-change NOT_RUN until approved test inbox/sink is supplied.',
  );
  report.gaps.push(
    'Google OAuth/native links/offline tile rights/native target acceptance require approved configuration/target.',
  );
})()
  .catch(() => {
    process.exitCode = 1;
    console.error('FAIL real-backend acceptance; only sanitized named-check results are recorded.');
  })
  .finally(async () => {
    for (const browserRefreshToken of browserRefreshTokens) {
      try {
        await api('/api/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: browserRefreshToken }),
        });
      } catch {
        report.gaps.push('Browser fixture-session cleanup request failed; token was not logged.');
      }
    }
    browserRefreshTokens.clear();
    if (refreshToken) {
      try {
        await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
      } catch {
        report.gaps.push('Fixture-session cleanup request failed; token was not logged.');
      }
    }
    accessToken = null;
    refreshToken = null;
    password = null;
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(
        directory,
        report.credentialsStatus === 'CREDENTIALS_NOT_CONFIGURED'
          ? 'real-backend-public-results.json'
          : 'real-backend-authenticated-results.json',
      ),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(
      `Acceptance summary: ${report.checks.filter((c) => c.result === 'PASSED').length} passed, ${report.checks.filter((c) => c.result === 'FAILED').length} failed, ${report.gaps.length} explicit gaps.`,
    );
  });
