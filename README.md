# Valryde Commuter Mobile

The consumer-facing Valryde mobile application repository, owned by Agent C for MVP checklist IDs 22–37.

## Current state

The checklist 23 map-first shell is implemented: Ionic tabs (Map, Routes, Favorites, Account), a MapLibre map with a configurable style, opt-in current location with a recenter control, and map-loading, map-error and offline states. Routes, Favorites and Account show an honest "not available yet" state until their slices land. No backend API, vehicle, or realtime data is used yet.

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
