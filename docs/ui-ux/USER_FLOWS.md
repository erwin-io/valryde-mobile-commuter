# User Flows

**Contract state:** UX_CONTRACT_READY

## C-01 — Launch to route discovery

| Step | Screen / user action | Dependency | Failure / alternative | Acceptance test |
|---:|---|---|---|---|
| 1 | Launch app | Runtime config | Offline banner or configuration error | App never stalls on splash |
| 2 | Review location explanation; allow or decline | Geolocation permission | Denied/unavailable uses Cebu map default and settings guidance | Both decisions reach Map |
| 3 | Map loads | Configured MapLibre style | Map error state keeps search/navigation usable | Retry can recreate map |
| 4 | Open route discovery | Agent A public route list | Loading, empty, offline, server error | State is specific and recoverable |

Transition: `Launch → Location explanation (first relevant request) → Map → Routes/Search`.

## C-02 — Search route and inspect geometry

| Step | Screen / user action | Dependency | Failure / alternative | Acceptance test |
|---:|---|---|---|---|
| 1 | Enter route query | Agent A route list `q` | Offline prevents uncached search | Debounce and clear work |
| 2 | Select route result | Route identity | Route removed between calls | Detail 404 returns to results with message |
| 3 | Choose direction | Route detail | No active direction means empty detail state | Selection uses direction ID |
| 4 | View official line | GeoJSON LineString/color | Invalid geometry is rejected and reported, not drawn | Camera fits valid bounds; old layer removed |

Transition: `Map/Routes → Route Search → Route Details → Direction → Map + Sheet`.

## C-03 — Stop to route details

`PROPOSED / STOP_CONTRACT_DEPENDENT`.

Transition target: `Map stop marker → Stop Details → Serving Routes → Route Details`. No runtime entry point ships until an approved formal stop registry/API exists. A missing stop API is not represented with invented coordinates or route membership.

## C-04 — Origin/destination to journey details

For MVP, only backend-approved **direct route discovery** is eligible. Walking legs, transfers, route combinations, fares, schedules, and ETA remain routing-dependent proposals.

Transition target: `Destination Search → Place Candidate → Direct Route Suggestions → Selected Route Details`. Errors distinguish place-search failure, discovery failure, and a successful “No direct route found” response. No multi-transfer screen is exposed.

## C-05 — Route to available jeepneys

`TRACKING_DEPENDENT`.

Transition target: `Selected Route Direction → REST Snapshot → Authorized Realtime → Map Marker/List → Vehicle Details`. On subscribe failure, reconnect, resume, or network recovery, UI enters reconciling state and does not restore “live” until a fresh REST snapshot succeeds. No runtime vehicle data ships before Agent B contract acceptance and tests.

## C-06 — Offline and recovery

| Step | Screen / user action | Dependency | Failure / alternative | Acceptance test |
|---:|---|---|---|---|
| 1 | Connectivity is lost | Browser/Capacitor network signal plus request evidence | Signal may be inaccurate | Failed requests still produce explicit state |
| 2 | App shows offline banner | Local shell | Cached route/map metadata may remain | Live/place features are marked unavailable |
| 3 | User browses available cached context | Approved local cache only | Nothing cached → useful empty state | No cached data is labeled current/live |
| 4 | Connectivity returns | API health/request success | Backend still unavailable | Offline and server-unavailable remain distinct |
| 5 | Retry/reconcile | Agent A now; Agent B later | Retry failure remains recoverable | Current route restores; future vehicles require snapshot before live state |

## Back and deep-link rules

- Android hardware back dismisses the top sheet/modal before leaving its routed page.
- Route detail deep links fetch canonical detail; failure provides a safe return to Routes.
- Switching tabs preserves only lightweight selection/query state, not stale error dialogs.
- Auth-required destinations redirect to Account and return only after a valid COMMUTER session.
