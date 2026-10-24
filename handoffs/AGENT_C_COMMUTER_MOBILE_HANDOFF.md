# VALRYDE — Agent C Commuter Mobile Handoff

**Agent:** C — Commuter Mobile\
**Checklist IDs:** 22–37\
**Repository:** `valryde-mobile-commuter`\
**Baseline:** Version 1.0 MVP\
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

## Current reverse handoff — 2026-10-22 parallel release

The bootstrap language above is retained as historical context. Current canonical `main` is `131944f6576c71f28b797977805b264c729f4e59` and contains the accepted/merged account, map, route-discovery, and device-local Favorites baseline through PR #6.

Codex completed directive `VALRYDE-CODEX-C-PARALLEL-RELEASE-002` in five isolated branches from that revision:

| Package | Review artifact | Source head | Resume point |
|---|---|---|---|
| C1 account/session hardening | PR #11 | `2d732f03bf0d8931f4b537f79a9b3c9bfca06f08` | Review bounded auth timeout, secure-storage failure handling and session race regressions. |
| C2 map/location hardening | PR #7 | `c2e33acc33a1d26847f1e5be0be5537f07f409b0` | Review optional pitch, hidden-tab camera lifecycle and foreground location cleanup. Offline tiles remain blocked. |
| C3 transit hardening | PR #10 | `a03c01ec558a193ff3920003acb158ac50ef0f0d` | Review request cancellation, serialized pagination and shifted-boundary de-duplication. No unsupported filter was added. |
| C4 Android readiness | PR #8 | `6554906a48f5662d93fece19629bdcb2e136ccc1` plus coordination status/handoff | Review native project, permissions, backup policy, Gradle evidence and owner gates. |
| C5 tracking test foundation | PR #9 | `c24e055a92c2e7729f89bd05a1e9ddb14fde68e9` | Review contract-neutral utilities/privacy tests only. Do not turn fixtures into a live feature. |

All package lint, strict typecheck, complete tests, production builds, runtime audits and diff checks pass. C4 also passes Capacitor sync and the actual Gradle Android unit/lint/debug build. Full npm audit findings are development-tooling-only (3 high, 3 moderate, 1 low); runtime audit is clean.

Still gated: Agent B public snapshot/realtime/count contracts for IDs 29–35 and count 36; Agent A G6 for ID 37; Google OAuth and native deep links; approved native API origin/CORS; final app ID/signing/art; Android Studio supported-version upgrade; owner-operated physical-device evidence. `valryde-api` PR #16 remains open, so no merged canonical mobile-testing-policy synchronization is claimed.

Do not self-merge. Resume by checking the current heads/checks and Tech Lead decisions on PRs #7–#11, then preserve this status/history when rebasing any later package onto newly merged main.

## Current reverse handoff — 2026-10-22 independent UI closure

PRs #7–#11 are now merged in integrated `origin/main` `fec717e60ebb58f9cc1489e60088aa5a8db6b7af`. The final combined audit found and corrected two independent gaps: emailed one-time tokens are now removed from the current URL/history entry after capture, and a failed Favorites store read can no longer masquerade as an empty list or permit a destructive overwrite. App-restart Favorites coverage and a real Chrome-engine regression were added to the verification evidence.

The combined web and Android gates pass; see `docs/testing/INDEPENDENT_UI_CLOSURE.md` and `docs/testing/ANDROID_BUILD_READINESS.md`. Do not extend IDs 29–35, the available-count portion of 36, or ID 37 until their named Agent B/Agent A contracts are approved. Owner-only physical-device, OAuth, deep-link, app identity/signing and native API-origin gates remain explicit. The closure PR is for Tech Lead review and must not be self-merged.

## Rapid delivery — tracking UI adapter, 2026-10-23

ID 37 is submitted independently in PR #13 (`codex/37-destination-discovery`, tested source `570bb1b8e4f76cdbdc25e463c67c5045b647b9f2`). This branch starts from main and advances IDs 29–36 behind a testable internal gateway. See `docs/testing/TRACKING_UI_ADAPTER.md`: actual marker/label/details/status/count/interpolation UI exists, but production intentionally reports unavailable until the approved Agent B wire adapter is supplied. Synthetic vehicles are restricted to specs. No API/shared DTO/channel invented. IDs 22/23 reuse merged work; no three-item acceptance claim before required live/provider/owner/Tech Lead evidence. Preserve the latest status log from both independent PRs if resolving their documentation overlap. Do not self-merge or deploy.
