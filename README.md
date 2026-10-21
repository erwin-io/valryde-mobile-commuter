# Valryde Commuter Mobile

The consumer-facing Valryde mobile application repository, owned by Agent C for MVP checklist IDs 22–37.

## Current state

- **Map (23):** MapLibre with a configurable style, opt-in current location, recenter, map-loading/error and offline states.
- **Routes (24–28):** route search and paginated list from the Agent A public API; a route sheet over the map with direction choice and the official route line.
- **Account (22):** commuter registration, email verification, sign-in, profile, change email/password, sign-out and password reset against the Agent A auth API. The refresh token is kept in the iOS Keychain / Android Keystore on native builds and in memory only in the browser.
- **Gated:** "Plan a trip" (place search and direct discovery, backend gap G6) and live jeepneys (Agent B). Favorites shows "not available yet".

To use real data locally, run `valryde-api` on `127.0.0.1:3000`; `npm start` proxies `/api` to it (`proxy.conf.json`).

## Developer setup

Requires Node 22 and npm 10 (`packageManager` is pinned in `package.json`).

```bash
npm ci
npm start            # http://localhost:4200
npm run lint
npm run typecheck
npm test
npm run build        # dist/valryde-mobile-commuter/browser (Capacitor webDir)
```

Map style, default center and zoom live in `src/environments/environment.ts`. The Android platform has not been added yet (`npx cap add android` requires a local Android SDK).

## Approved baseline

- Ionic Framework, Angular, Capacitor, and TypeScript
- MapLibre with configurable map styles; OpenFreeMap is the approved MVP reference
- Transit-first, native Ionic interaction patterns inspired by Sakay.ph
- REST reconciliation plus approved Pusher realtime contracts
- Backend-normalized place search and direct transit discovery
- Installed GPS tracker data as the vehicle-location authority

## Repository guidance

- Start with [`AGENTS.md`](./AGENTS.md).
- Read the [Agent C handoff](./handoffs/AGENT_C_COMMUTER_MOBILE_HANDOFF.md).
- Follow the synchronized [status reporting policy](./docs/00_SHARED_AGENT_STATUS_REPORTING_POLICY.md).
- Maintain the single canonical [Agent C status](./docs/agent-status/AGENT_C_STATUS.md).
- Keep architecture, UI/UX, integration, and test documentation in their corresponding folders under `docs/`.

The canonical backend (`valryde-api`) and infrastructure (`valryde-infra`) repositories are read-only references for Agent C. Do not invent or locally duplicate unapproved shared API, DTO, realtime, or geospatial contracts.
