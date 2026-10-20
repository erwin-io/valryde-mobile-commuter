# Screen Inventory

**Contract state:** UX_CONTRACT_READY  
**Legend:** `APPROVED` is in checklist 22–37; `GATED` needs an unavailable approved backend contract; `PROPOSED` is not committed product scope.

| Screen / state | Scope | Purpose and entry | Navigation / actions | Data dependency | Acceptance criteria |
|---|---|---|---|---|---|
| Launch / bootstrap | APPROVED (23) | Establish runtime configuration and connectivity at cold start | Continues to Map; Retry on fatal configuration/server state | Local configuration; optional health check | Never blocks indefinitely; offline and unavailable-server states are distinguishable |
| Location explanation | APPROVED (23) | Explain why location improves nearby map context before prompting | Allow location; Not now; settings guidance after denial | Capacitor/browser geolocation | Denial still reaches browsable map; no repeated prompt loop |
| Main transit map | APPROVED (23, 28) | Map-first home for current location and selected official route | Search, recenter, select/clear route, open details | Map style; Agent A route geometry | Map loading/error states exist; attribution visible; controls do not obscure sheet/tab areas |
| Route search | APPROVED (24) | Find active routes by code/name/origin/destination metadata supported by API | Type query, clear, retry, select result | `GET /api/transit-routes?q=&page=&pageSize=` | Debounced query; loading/no-results/error; selection preserves route identity |
| Route list | APPROVED (25) | Browse active registered routes | Paginate/refresh; select route | Agent A route list | Pagination envelope honored; no fake routes when empty |
| Route details sheet/page | APPROVED (26–28) | Show route code/name, description, direction endpoints and geometry | Switch direction, fit route, favorite, dismiss/back | Agent A route detail | Selected direction is explicit; route color/geometry match API; sheet has accessible page fallback |
| Direction chooser | APPROVED (27) | Prevent ambiguous live/map context | Select one active direction | Agent A direction array | One selected identity; switching updates line and camera without stale layers |
| Favorites | APPROVED (36), persistence GATED | Access frequently used routes | Open/remove saved route | Persistence contract to be approved | Empty state is useful; no cross-device claim until backend support exists |
| Account / auth | APPROVED (22) | Register, verify, sign in, recover, view/update profile and sign out | Reactive forms and verified Agent A operations | Agent A auth/profile API | COMMUTER role only for registration; validation and revoked-session recovery are explicit |
| Place destination search | APPROVED (37), GATED | Search normalized POIs and choose destination | Query, select candidate, retry | Backend place adapter absent at revision `711f4c4` | Must not call Photon directly; unavailable state does not imply zero results |
| Direct-route suggestions | APPROVED (37), GATED | Show route directions near origin and destination | Select suggestion; no-direct-route state | Backend/PostGIS direct-discovery API absent | No transfer route or ETA claim; no-direct-route is distinct from request failure |
| Live available vehicles | APPROVED (29–35), GATED | Display only server-eligible vehicles for selected direction | Select marker/list row; refresh/retry | Agent B public snapshot/realtime absent | Public-safe allowlist only; stale/off-route entries are not shown as available |
| Vehicle details sheet | APPROVED (32–35), GATED | Plate, physical color, route, direction, movement/status, last update | Dismiss/back; reconcile | Agent B contract absent | No driver/operator identity; freshness label is explicit |
| Stop details | PROPOSED / GATED | Inspect a formal stop and routes serving it | Select stop/route; back to map | No approved stop registry/API | Must not ship as data-backed functionality without scope/contract approval |
| Journey details | PROPOSED / ROUTING_DEPENDENT | Present supported direct journey context | Inspect steps/map segments | No journey planner, walking, transfer, fare, schedule, or ETA API | Prototype must be isolated and labeled; multi-transfer behavior cannot enter MVP |
| About / privacy / help | APPROVED supporting UI | Explain product, location use, data freshness, and support boundaries | Open external policy/help when configured | Static reviewed content | No unsupported privacy promise or support channel is invented |

## Primary navigation

Tabs: **Map · Routes · Favorites · Account**. Search opens from Map or Routes. Route selection returns to Map with a routed sheet, preserving normal back behavior. Gated screens are specifications only and are not exposed as functional navigation destinations.
