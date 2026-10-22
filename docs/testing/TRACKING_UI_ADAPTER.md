# Rapid tracking UI adapter — IDs 29–36

This package implements real commuter UI behind a testable internal gateway boundary. It does not define Agent B's API, Pusher events, authorization or REST reconciliation protocol. The production token defaults to `unavailable` and sends no tracking request. Synthetic vehicle observations appear only in `*.spec.ts`.

| ID | Measurable implementation | Acceptance boundary |
|---|---|---|
| 29 | Injectable gateway, full-snapshot store and available marker set | Real wire adapter pending Agent B approved contract |
| 30 | 500 ms bounded interpolation between received fixes; cancellation, no prediction and reduced-motion jump | Real hardware stream/ordering acceptance pending |
| 31 | Selected-direction scope, server eligibility flag narrowing, malformed/future/expired fix hiding | Server owns active/tracker/fix/route/compliance decisions; client never grants eligibility |
| 32 | Route label on accessible map marker and list | Normalized public label from wire adapter pending |
| 33 | Click/select plate, direction and public detail panel; list alternative | Sanitized public DTO mapping pending |
| 34 | Validated physical vehicle color accent, neutral fallback, text equivalent | Public physical-color source pending |
| 35 | Public status, last observation time, exact freshness deadline, hidden/offline/reconnect cleanup | Server statuses and clock-skew contract pending |
| 36 | Snapshot-derived selected-direction available count, unknown distinct from zero, empty state | Real snapshot/count reconciliation pending; existing Favorites unchanged |

The internal `TrackingGateway.watch(directionId)` must emit a fresh full authoritative snapshot at each subscription; each later snapshot replaces membership, so missing vehicles are removed. Revisions are monotonic within a subscription; older revision/observation updates cannot move a marker backward. A future approved wire adapter must perform REST reconciliation before emitting data after reconnect/resume. This document is an internal adapter requirement, not shared-contract approval.

Map page disconnects when hidden/backgrounded/offline, discards visible markers/counts, and resubscribes on return. Observation expiry is scheduled outside Angular's stability zone at the next 30-second deadline; no perpetual zone interval or one-second stale display lag. Client expiry can only hide server-eligible observations. Future-dated fixes fail closed until approved clock-skew behavior exists. Driver/operator/device properties are excluded from UI state; raw gateway errors are never displayed. Route labels use DOM textContent, never HTML; physical colors require #RRGGBB.

Tests use injected gateway Subjects, fake time, fake animation scheduling and marker factories. Coverage includes direction/eligibility narrowing, deduplication, privacy allowlisting, source-object mutation isolation, malformed/future/stale observations, replacement/removal, old revisions, old observations, cancellation, reconnect/resume, stream errors, exact freshness expiry, interpolation endpoints/no extrapolation/reduced motion, marker accessibility/selection, details/count/empty/offline/unavailable, and map load/hidden-tab/destroy integration.

Browser reproduction: `npm run build`, then `node scripts/verify-tracking-map.cjs` with Playwright available (`PLAYWRIGHT_MODULE` / `CHROME_PATH` optional paths). Uses real MapLibre, controlled route geometry and the real unavailable production adapter. Screenshots are explicitly CONTROLLED. No fake vehicle is introduced in the browser/production app.

Validation and limits are recorded in current Agent C status. This is IN_PROGRESS for live feature acceptance, READY_FOR_REVIEW for adapter/UI implementation. No 29–36 item is Completed or Completed-ready before approved gateway integration. No self-merge/deployment. Owner physical-device acceptance remains OWNER_DEVICE_PENDING.

Final web verification (2026-10-23): `npm run lint`, `npm run typecheck`, `npm test` (20 files / 188 tests), `npm run build` (641.93 kB initial; under unchanged 650 kB warning budget), `npm audit --omit=dev` (zero), and `git diff --check` pass. Real Chrome at 390×844 and 320×568 passes MapLibre startup with controlled style/official route, unavailable production adapter, no fabricated count or tracking request, offline/reconnect, no horizontal overflow or page errors. Screenshots visually inspected.

Native verification: Capacitor sync plus `gradlew.bat --no-daemon --max-workers=2 test lintDebug assembleDebug` passed with JBR 21 / SDK 36, all three plugins compiled. The final post-refinement bundle is separately synchronized/reassembled before submission; hash is in Agent C status. Existing upstream flatDir/deprecation/Capacitor baseline notices remain; app lint passed.

Emulator/install startup was NOT_RUN: two AVDs exist, adb shows no attached target, and host had only about 1.55 GiB physical memory free under toolchain load. Physical-device tests are OWNER_DEVICE_PENDING. Real local API probe failed at configured 127.0.0.1:3000. API main recheck still 810c8a1 and lacks approved public gateway routes. Live integration is blocked, not passed.

Final post-refinement Capacitor sync and canonical-path `assembleDebug` passed. Debug APK SHA-256: `04E811D2F2C3C56262DD52E05D830A2134F7A998D645EA0453240040EA1911BA`. No generated machine paths, native source, build output or dependency changes are included. The final suite includes the exact freshness deadline and map/renderer lifecycle regression, for 18 additional tests beyond the merged baseline.
