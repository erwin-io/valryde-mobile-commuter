# VALRYDE — Agent C Commuter Mobile Handoff

**Agent:** C — Commuter Mobile  
**Checklist IDs:** 22–37  
**Repository:** `valryde-mobile-commuter`  
**Baseline:** Version 1.0 MVP  
**Bootstrap date:** 2026-10-21

## Mission

Build the consumer-facing Valryde application for discovering approved jeepney routes, selecting a direction, and viewing eligible live jeepneys. This repository owns the commuter experience only; it does not own backend business rules, Traccar integration, operator workflows, or admin tooling.

## Assigned checklist

| ID | Approved feature |
|---:|---|
| 22 | Commuter signup, login, and profile |
| 23 | Landing, main transit map, and current location |
| 24 | Route/transit search |
| 25 | Route/transit list |
| 26 | Route details drawer/filter |
| 27 | Route direction selection |
| 28 | Official route line on map |
| 29 | Live available jeepneys |
| 30 | Real-time jeepney movement |
| 31 | Route-filtered availability |
| 32 | Transit label/route name on jeepney |
| 33 | Jeepney details and plate number |
| 34 | Color-coded jeepney marker |
| 35 | Tracking status, last update, and direction |
| 36 | Available jeepney count and favorite routes |
| 37 | Destination place search and direct transit discovery |

## Locked boundaries

- Stack: Ionic, Angular, Capacitor, TypeScript, and MapLibre with configurable styles.
- UX: transit-first, compact, native Ionic patterns; Sakay.ph is directional inspiration, not a license to copy assets or unapproved behavior.
- Map: 2D default; official route line uses Admin-managed geometry and color.
- Realtime: approved Pusher consumer contract plus REST snapshot/reconciliation; never connect directly to Traccar.
- Availability and compliance are backend-authoritative. Do not reproduce route-compliance calculations in the client.
- Place search uses a normalized backend adapter. Do not call Photon from the mobile app.
- ID 37 covers direct route directions only; no multi-transfer planner or anonymous share links.
- Public UI must not expose driver or operator identity.
- Limited cached map/route metadata may support a degraded offline view, but fresh vehicles and place search require connectivity.

## Dependencies at bootstrap

- Agent A owns authentication, RBAC, public transit, direction, and business-domain contracts. Its status reports IDs 1–11 as `READY_FOR_REVIEW`; downstream clients must not treat that work as accepted or merged until canonical Git/Tech Lead evidence confirms it.
- Agent A has documented a paginated public transit list contract (`q`, `page`, `pageSize`, and a `pagination` response envelope) and route-detail behavior, but integration must be verified against the eventual merged OpenAPI/source before implementation.
- Agent B owns latest vehicle state, compliance, sanitized public snapshots, Pusher channel/event authorization, and reconciliation behavior. The bootstrap inspection found no approved public consumer DTO/channel contract yet.
- The tracking-bridge document inspected during bootstrap is explicitly `PROPOSED`; it must not be used as an application contract.
- The standalone approved system-documentation file and standalone 71-item checklist were not present in the inspected local reference repositories. The approved Agent C handoff provides the current checklist baseline, but feature development must obtain any missing canonical references required by governance.

## Development handoff

No application feature or dependency scaffold has been created. On receipt of the Agent C development directive:

1. Re-read governance and this handoff.
2. Confirm canonical `main`, Agent C status, and merged Tech Lead decisions.
3. Obtain and verify the required Agent A/Agent B OpenAPI, DTO, error, auth/session, Pusher, and reconciliation contracts.
4. Create a focused implementation branch for the authorized checklist slice.
5. Implement and test the smallest vertical slice, update status, and submit it for Tech Lead review without self-merging.

## Out of scope for this bootstrap

Application scaffolding, dependencies, screens, UI components, API clients, maps, authentication, realtime subscriptions, device builds, tests, deployment, and feature implementation.
