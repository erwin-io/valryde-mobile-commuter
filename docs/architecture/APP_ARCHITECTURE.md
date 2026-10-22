# Agent C Application Architecture

**Status:** UX contract baseline\
**Scope:** Checklist IDs 22–37\
**Decision gate:** Tech Lead review required before expanding beyond the reversible shell

## Goals

- Keep the map visible and responsive while search, route details, account, and network states change independently.
- Separate verified API contracts from unavailable or proposed integrations.
- Use Angular standalone components, strict TypeScript, Reactive Forms, Angular Router, Ionic navigation, and Capacitor boundaries.
- Make loading, empty, error, offline, permission-denied, stale, and reconnecting states explicit.

## Feature-oriented structure

```text
src/app/
  core/             configuration, HTTP, connectivity, errors
  shell/            tabs and application-level navigation
  features/
    map/             MapLibre lifecycle and camera behavior
    routes/          verified public route list/detail contracts
    search/          route search now; places when contract exists
    account/         verified Agent A auth/profile contracts
    favorites/       UI boundary; persistence decision remains gated
    tracking/        contract boundary only until Agent B acceptance
  shared/            reusable presentational components and state views
```

## State boundaries

| Boundary | Owns | Must not own |
|---|---|---|
| Map renderer | MapLibre instance, sources/layers, camera, resize and cleanup | Search rules, HTTP, route eligibility, realtime authorization |
| Route repository | Typed Agent A route list/detail requests and DTO mapping | Map objects or tracking state |
| Search feature | Query form, debounce, results, no-results/error state | Provider-specific Photon calls |
| Tracking adapter | Future sanitized snapshots/events and reconciliation | Traccar credentials or route-compliance calculation |
| Device location | Permission request and user-location state | Vehicle location or background tracking |
| Shell | Tabs, top-level outlets, offline banner | Feature business logic |

## Data-source policy

Production UI states must identify their source. Verified Agent A endpoints may use `real`; isolated prototypes use `prototype` and cannot masquerade as network data. No sample vehicle, ETA, fare, schedule, stop, or journey data appears in the runtime shell.

## Runtime configuration

- `apiBaseUrl` is environment-controlled and must support browser, Android emulator, and physical-device values.
- `mapStyleUrl` is environment-controlled and must use a MapLibre-compatible style with attribution.
- Secrets, Traccar credentials, Pusher secrets, and provider credentials are never client configuration.

## Navigation

Primary tabs are Map, Routes, Favorites, and Account. Details open as routed pages or Ionic sheets so platform back behavior remains deterministic. A sheet may be dismissed to return to its unchanged map context; a full page uses router history.

## Error and recovery policy

- HTTP errors map to typed UI states; raw server details are not rendered.
- Offline state retains only previously cached non-live route/map metadata when available.
- Reconnect or app resume invalidates any future realtime confidence and reconciles from REST before displaying vehicles as live.
- Map-style failure leaves search/navigation usable and offers retry.

## Security and privacy

Access tokens remain memory-first; refresh-token secure storage requires a reviewed Capacitor implementation. Public vehicle UI will allowlist only approved fields. The client never derives hidden operator/driver data, compliance, or eligibility.

## Shell implementation decisions (checklist 23 slice)

- **Versions:** Angular 21.2 LTS line (patched `21.2.25`/CLI `21.2.27`), Ionic `9.0.8`, Capacitor `8.5.3`, MapLibre GL JS `6.15.0`; all pinned exactly in `package.json` and the lockfile.
- **Change detection:** zone-based (`provideZoneChangeDetection`) because Ionic declares `zone.js` as a peer dependency. Revisit when Ionic documents zoneless support.
- **Ionic imports:** components and controllers are imported from per-component entry points (`@ionic/angular/ion-button`, etc.) so esbuild code-splits them; importing the `@ionic/angular` barrel put every Ionic component in the initial bundle (~750 kB).
- **Bundle budget:** initial warning budget raised from 500 kB to 600 kB (error remains 1 MB). The Ionic + Angular baseline is ~535 kB raw / ~140 kB transfer and Capacitor serves it from the device. MapLibre stays in the lazy Map chunk.
- **MapLibre worker:** MapLibre 6 resolves its worker relative to its own module URL, which bundling breaks. `angular.json` copies `maplibre-gl-worker.mjs` to `/maplibre/` and `MAP_FACTORY` calls `setWorkerUrl` before creating a map.
- **Testability seams:** `MAP_FACTORY` (MapLibre construction) and `GEOLOCATION` (Capacitor plugin) are injection tokens so components are tested without WebGL or device APIs.
- **Capacitor `appId`:** `com.valryde.commuter` is provisional until the owner confirms the store identifier.

## Session and token storage (checklist 22)

- **Access token:** memory only, in `SessionService`; refreshed 30 s before its stated expiry.
- **Refresh token:** `REFRESH_TOKEN_STORE`. Native builds use `capacitor-secure-storage-plugin@0.13.0` (iOS Keychain, Android Keystore). The browser uses an in-memory store, because the plugin's web fallback is `localStorage`, which the Agent A handoff forbids; a browser reload therefore signs the user out.
- **Refresh:** single-flight (concurrent callers share one rotation); 400/401/403 clear the session, while network errors, 5xx and rate limits keep the token for a later retry ("Can't restore your session" with Retry).
- **Interceptor:** attaches `Authorization` only to requests carrying the `REQUIRES_AUTH` context flag; a 401 triggers one refresh and one retry.
- **Launch:** `provideAppInitializer` starts `restore()` without blocking the map.
- **Forms:** every `<form>` uses `[formGroup]`; a bare form with `(ngSubmit)` performs a native GET, which reloads the app and drops the in-memory session.

## Offline route cache (checklists 24–28)

- Storage: WebView `localStorage` key `valryde.routeCache.v1`, public route DTOs only. Credentials, profile data and vehicle state are never stored there (tested).
- Bounds: 25 details, unfiltered first list page, 3-day expiry, 1.5 M UTF-16 chars; oldest details evicted first, then the list; quota errors clear the cache.
- Invalidation: fresh responses overwrite; 404/400 remove a detail; expired entries are dropped on write and ignored on read; corrupt payloads are discarded; bump the key version on shape changes.
- Use: only for network failures and timeouts (15 s), never for server errors or missing routes, and always shown with "saved <time>".

## Favorite routes (checklist 36)

- Store: `@capacitor/preferences` key `valryde.favorites.v1` (native key-value store; `localStorage` on the web). Deliberately separate from the secure refresh-token store.
- Contents: only `{ routeId, directionId | null, savedAt }`, newest first, one entry per route, at most 50; malformed or duplicate entries are dropped on load; writes are serialized.
- Reliability: a mutation becomes visible in memory only after its serialized Preferences write succeeds. A failed write leaves the prior state intact, surfaces retry-safe copy, and does not block later operations.
- Display: each favorite is resolved through `GET /api/transit-routes/{id}`; 404/400 shows "Route no longer available" with removal; network errors offer retry. Opening a favorite uses the normal `/tabs/map?route=&direction=` flow, dropping a direction the route no longer has.
- Scope: device-local and not synchronized across accounts or devices. Available jeepney counts are not shown (Agent B gate).
- Accessibility: Ionic buttons copy `aria-*` into their shadow button once, so state-dependent labels use one button per state rather than `[attr.aria-*]`.
