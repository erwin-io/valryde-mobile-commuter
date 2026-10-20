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
