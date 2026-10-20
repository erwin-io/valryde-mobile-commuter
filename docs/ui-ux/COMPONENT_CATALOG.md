# Component Catalog

**Contract state:** UX_CONTRACT_READY

| Component | Responsibility | Key inputs / outputs | Required states |
|---|---|---|---|
| `AppShell` | Safe areas, top-level outlet, connectivity banner | connectivity state | online, offline, server unavailable |
| `PrimaryTabs` | Map/Routes/Favorites/Account navigation | active route | selected, unselected, badge-free by default |
| `TransitMap` | MapLibre instance and declarative layer updates | style URL, route geometry/color, user location; emits load/error/camera | loading, ready, style error, reduced motion |
| `MapSearchButton` | Opens route/place search without obscuring map | label, mode; emits activate | enabled, disabled/offline for place mode |
| `RecenterButton` | Camera to last permitted user location | location availability; emits recenter/request | ready, permission needed, locating |
| `RouteListItem` | Compact route identity and endpoint summary | route code/name/color, directions; emits select | default, pressed, skeleton |
| `DirectionSelector` | Explicit route-direction identity | direction list/selected ID; emits change | single, multiple, empty |
| `RouteDetailSheet` | Route summary and direction actions over map | selected route/direction | collapsed, expanded, loading, error |
| `RouteLineLayer` | Adds/updates/removes official LineString | source ID, geometry, color | valid, hidden, rejected geometry |
| `StatePanel` | Standard loading/empty/error/offline explanation | icon, title, body, action | semantic state variants |
| `FreshnessLabel` | Communicates timestamp confidence | status, timestamp | live/fresh, stopped, stale, unavailable, reconciling |
| `VehicleMarker` | Future public vehicle representation | approved allowlisted fields only | moving, stopped, selected; stale removed from availability |
| `VehicleDetailSheet` | Future public-safe details | approved snapshot | loading, fresh, unavailable |
| `SearchField` | Reactive route/place query | control, placeholder; emits clear/submit | idle, typing, loading, invalid |
| `PermissionExplainer` | Context before native prompt | permission type; emits continue/not-now | initial, denied, permanently denied |
| `OfflineBanner` | Persistent loss-of-connectivity message | state; emits retry | offline, reconnecting, server unavailable |

## Reuse rules

- Presentational components receive typed data and do not call APIs.
- MapLibre objects remain inside the map feature.
- Sheets use Ionic breakpoints and include an accessible full-page route where content is substantial.
- Standard Ionic controls are wrapped only when VALRYDE semantics or consistent state handling require it.
