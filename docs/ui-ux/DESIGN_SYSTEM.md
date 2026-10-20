# VALRYDE Commuter Design System

**Contract state:** UX_CONTRACT_READY  
**Direction:** map-first Philippine transit utility using native Ionic patterns

## Principles

1. **Map and task first.** The primary action is finding or inspecting transport, not reading a dashboard.
2. **Compact, legible transit hierarchy.** Route code, direction, endpoints, and current data state are visually distinct.
3. **Truthful confidence.** Offline, stale, unavailable, and prototype-only states are labeled; no inferred ETA or live status.
4. **Native familiarity.** Use Ionic headers, search bars, lists, segments, sheets, tabs, alerts, toasts, and platform back behavior.
5. **Accessible by default.** Text is resizable, touch targets are at least 44 px, focus is visible, color is never the only status cue, and map information has a list alternative.

The public Sakay.ph store listing emphasizes place-to-place discovery, route comparison, and step hierarchy. VALRYDE adopts those general transit-information patterns only where its approved checklist supports them. Sakay.ph branding, layouts, artwork, content, and proprietary route data are not copied. References: [official App Store listing](https://apps.apple.com/ph/app/sakay-ph-commute-directions/id937998546) and [Sakay.ph terms](https://www.sakay.ph/terms).

## Color roles

| Token | Default | Use |
|---|---:|---|
| `--valryde-primary` | `#0B6E4F` | Primary actions, selected navigation, focus |
| `--valryde-primary-strong` | `#07563E` | Pressed/active primary state |
| `--valryde-surface` | `#FFFFFF` | Sheets, cards, controls |
| `--valryde-background` | `#F4F6F5` | Page background outside the map |
| `--valryde-text` | `#17211D` | Primary text |
| `--valryde-muted` | `#5E6B65` | Secondary metadata |
| `--valryde-border` | `#D7DEDA` | Dividers and component boundaries |
| `--valryde-warning` | `#9A5A00` | Stale/offline/permission-limited |
| `--valryde-danger` | `#B42318` | Failed/destructive state |
| `--valryde-info` | `#175CD3` | Informational state |

Admin-defined route colors are content, not interface tokens. Route badges pair color with route code and accessible labels. No decorative gradients are permitted.

## Typography and spacing

- Use the platform system font stack through Ionic.
- Page title: 24/30, semibold; section title: 18/24, semibold; body: 16/24; metadata: 14/20; label: 12/16, medium.
- Use a 4 px spacing grid. Common gaps: 8, 12, 16, 24, 32 px.
- Long route and place names wrap to two lines before truncation; critical direction endpoints never rely on truncation alone.

## Shape and elevation

- Controls: 10–12 px corner radius; sheets: 20 px top corners; route chips: pill only when semantically a compact filter.
- One restrained shadow level is allowed for controls floating above a map. Avoid stacked cards and glass effects.

## Motion

- Navigation and sheets use Ionic defaults.
- Marker movement may interpolate only between received valid fixes; it must not extrapolate.
- Respect reduced-motion preferences. Avoid decorative continuous animation.

## Data-state language

| State | User-facing language |
|---|---|
| Loading | “Loading routes…” or task-specific equivalent |
| Empty | Explain what is absent and the next useful action |
| Offline | “You’re offline. Live vehicles and place search are unavailable.” |
| Stale | “Last update …” plus a stale label; never “live” |
| Server unavailable | “VALRYDE is temporarily unavailable” with Retry |
| Permission denied | Explain how map browsing still works and how to enable location later |

## Map composition

- Search entry is anchored below the safe-area header.
- Recenter is a single 44 px button above sheet/tab obstructions.
- Route details use an Ionic sheet with clear collapsed and expanded breakpoints.
- Attribution remains visible and unobstructed.
- A text/list equivalent exposes selected route and future vehicle information to assistive technology.
