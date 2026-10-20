# Agent C Acceptance Matrix

## UX contract and first shell

| ID | Scenario | Evidence target | Current gate |
|---|---|---|---|
| C-01 | Launch, decide location permission, load map, open route discovery | Unit/component plus phone screenshot | Independent |
| C-02 | Search active route, select direction, draw/focus official geometry | Agent A integration plus map component test | Verified Agent A API available |
| C-03 | Select stop and inspect routes | Contract/E2E | Formal stop registry/API absent; proposed only |
| C-04 | Choose destination and inspect direct route suggestions | Contract/E2E | Place and direct-discovery APIs absent |
| C-05 | Choose direction and inspect available live jeepney | Snapshot/realtime integration | Agent B contract absent |
| C-06 | Lose network, show offline/stale state, recover and reconcile | Unit/E2E with network emulation | Shell independent; tracking reconciliation gated |

## Checklist coverage

| Checklist | Minimum acceptance |
|---:|---|
| 22 | COMMUTER register/verify/login/refresh/logout/recovery/profile happy and error paths; revoked session denied |
| 23 | Map loads or explains failure; current location opt-in, denial fallback, recenter, responsive controls |
| 24–25 | Typed search/list uses pagination; loading/empty/error/offline/retry; no invented routes |
| 26–28 | Route detail and explicit direction; validated official geometry/color; fit-to-route and back behavior |
| 29–35 | Server-filtered public-safe vehicles only; no prediction; stale/off-route removal; details privacy; reconcile after gaps |
| 36 | Server-approved count semantics; favorites persist only through an approved local/backend decision |
| 37 | Normalized place candidates and direct routes; no-direct-route state; no multi-transfer implication |

## Automated quality gates

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- Android sync/build once the Android platform is added and the local SDK is available
- `git diff --check`

## Visual and manual gates

- Required screenshots are listed in `docs/ui-ux/VISUAL_ACCEPTANCE.md`.
- Verify Ionic back behavior, safe areas, 200% text, keyboard focus, screen-reader labels, contrast, and reduced motion.
- Record browser/device, viewport, OS, backend revision, map style, and network condition with evidence.
- Mark untested physical-device, OAuth, Pusher, and provider behavior as owner/operator pending.
