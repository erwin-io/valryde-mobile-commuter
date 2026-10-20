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
