# Map Integration Contract

## Provider boundary

MapLibre GL JS renders a configurable compatible style. The style URL is environment configuration so OpenFreeMap can be replaced without rewriting feature code. Map attribution remains visible and provider terms must be reviewed before distribution or offline caching.

## Coordinate and geometry rules

- Agent A direction geometry is GeoJSON `LineString` in WGS84 longitude/latitude order.
- Validate finite coordinates, bounds, type, and at least two positions before drawing.
- Admin geometry is authoritative; the client does not snap, simplify, or repair it into a different route.
- Source/layer IDs derive from stable direction IDs and are removed before switching identity.

## Map states

1. `initializing`: container present; progress is announced.
2. `ready`: base style loaded and controls enabled.
3. `style-error`: explanatory panel and Retry; route/search navigation remains usable.
4. `offline`: cached style behavior is provider/platform dependent and must not be promised until tested.

## Layers

| Layer | Source | Availability |
|---|---|---|
| Base vector map | Configured style | First shell |
| User location | Capacitor/browser geolocation | First shell; permission-controlled |
| Selected official route | Agent A direction geometry/color | After route slice |
| Unselected routes | Agent A list/detail as requested | Optional; avoid map clutter |
| Stops | No approved source | Gated |
| Vehicles | Agent B public contract | Gated |

Selected route uses a casing/outline plus route color for contrast. Fit bounds includes responsive padding for safe areas, tabs, and sheet height. Empty or invalid geometry never triggers world-scale camera movement.

## Lifecycle and performance

- Construct one map per mounted map component and call `remove()` on destroy.
- Update GeoJSON sources in place when identity is unchanged.
- Do not rebuild markers or layers on unrelated Angular change detection.
- Batch future vehicle updates; use source/layer rendering instead of many DOM markers when scale requires it.
- Pause nonessential rendering when the app is backgrounded and resize after view re-entry.

## Location privacy

Request foreground location only after contextual explanation or explicit recenter action. The first shell uses location for on-device camera context and does not transmit it. Any future origin-based API request must be documented and consent-aligned.

## Implementation notes (checklists 23–28)

- **Worker:** MapLibre 6 resolves its worker relative to its own module, which bundling breaks. `angular.json` copies `maplibre-gl-worker.mjs` to `/maplibre/`, and `MAP_FACTORY` calls `setWorkerUrl` before creating a map.
- **Route layers:** one GeoJSON source `valryde-route` with a white casing layer (9 px) under the route-color line (5 px), added before the user-location layer so the dot stays on top.
- **Geometry gate:** `drawableCoordinates()` accepts only a `LineString` with at least 2 finite positions within ±180/±90. Anything else is not drawn and the sheet says the line can't be shown.
- **Fit-to-route:** runs once per direction id, with padding for the search bar (top) and the sheet at its initial 0.5 breakpoint (bottom). It is deferred until the map container is large enough, because a route chosen from the Routes tab arrives while the map tab is hidden; the existing `ResizeObserver` retries it.
- **Selection state:** `?route=<id>&direction=<id>` query parameters drive `RouteSelectionService`, so selections are deep-linkable and back-navigable; closing the sheet clears them.

## Follow mode, camera and offline (independent UI batch)

- **Fit-to-route jumps** (duration 0). MapLibre's `resize()`, triggered by Ionic tab transitions, calls `stop()` and abandoned animated fits; hidden or backgrounded WebViews also pause animation frames.
- **Follow mode** starts only from an explicit recenter tap: foreground `watchPosition` updates move the dot and camera (keeping zoom). It ends when the user pans by gesture (`dragstart` with `originalEvent`), taps again, leaves the Map tab, selects a route, or permission is revoked. The watch is always cleared. The position stays on the device.
- **Route sheet** is presented only while the Map tab is the active Ionic page; a hide for a tab change keeps the selection.
- **Admin color**: `#RRGGBB` only; anything else renders in neutral `#5E6B65` and is never passed to CSS or MapLibre.
- **Offline route data**: see `RouteCacheService`: unfiltered first list page and up to 25 route details, 3-day expiry, 1.5 M-char cap with oldest-first eviction, removal on 404/400, used only when the network fails and always labelled with its save time. No offline search or routing.
