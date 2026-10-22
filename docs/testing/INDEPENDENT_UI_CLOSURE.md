# Agent C Independent UI Closure

**Directive:** `VALRYDE-CODEX-C-INDEPENDENT-CLOSURE-003`

**Integrated base:** `origin/main` `fec717e60ebb58f9cc1489e60088aa5a8db6b7af`

**Evidence date:** 2026-10-22, Asia/Manila

This audit covers the combined application after merged PRs #7–#11. “Merged” below is repository evidence, not a claim of physical-device acceptance. No backend, realtime, tile-provider, OAuth, signing, or production-origin contract was invented.

## Closure corrections

- One-time verification, password-reset, and email-change tokens are captured and immediately removed from the visible URL/history entry. They remain only long enough in memory to submit the approved request body.
- A failed Favorites Preferences read is no longer presented as an empty list. The UI offers retry, preserves any current in-memory list, and refuses writes until the store can be read, preventing unknown persisted data from being overwritten.
- Favorites regression coverage now reconstructs the service over the same Preferences store to model app restart persistence.
- Agent instructions now reference the copied and canonical reporting policy version 1.2.

## Checklist disposition

| ID | Independent functionality and validation | Backend / owner gate | Merged evidence | Why no further independent work is available |
|---:|---|---|---|---|
| 22 | Register, verification, sign-in, session restore/rotation, logout, recovery, profile/email/password updates, guards, bounded failures, storage failures, revoked-session and race coverage; one-time URLs now scrubbed. | Google OAuth values, G5 native deep links, native API origin/CORS, and physical-device Keychain/Keystore acceptance. | PR #11, merge `2a97974`; closure branch tests. | Remaining work needs owner/provider/native environment decisions. |
| 23 | MapLibre map, opt-in location, denial/failure copy, recenter/follow, north-up reset, optional bounded pitch, resize/hidden-tab lifecycle, foreground-watch cleanup, reduced-motion behavior. | Physical-device permission/rotation; provider-approved cache rights. Offline base maps are not claimed. | PR #7, merge `4a92a5c`. | A compliant offline tile cache cannot be designed without an approved provider/storage policy. |
| 24 | Debounced route search, bounded query, cancellation, stale-response rejection, loading/empty/error/offline behavior. | Populated deployed API remains an environment acceptance gate. | PR #10, merge `4f8b08d`. | Approved public search contract is fully consumed. |
| 25 | Paginated list, serialized load-more, duplicate-ID replacement across shifted pages, retry, cache fallback and expiry. | Same deployed-data gate. | PR #10, merge `4f8b08d`. | No independent list behavior remains. |
| 26 | Route sheet/detail, withdrawn/malformed handling, retry and offline saved detail. | Same deployed-data gate. | PR #10, merge `4f8b08d`. | No new filter contract exists to consume. |
| 27 | Explicit direction selection, invalid saved/deep-linked direction fallback, consistent route/direction handoff from Routes and Favorites to Map. | Same deployed-data gate. | PR #10 plus merged Favorites PR #6. | Selection behavior is covered; new semantics would require a contract change. |
| 28 | Validated GeoJSON `LineString`, Admin color validation/fallback, MapLibre source/layers, fit-to-route and hidden-map deferred fit. | Physical-device visual acceptance. | PR #7 and PR #10 merges. | Official geometry/color contract is fully consumed. |
| 29 | Not implemented. Contract-neutral presentation tests only. | Agent B public snapshot contract. | PR #9, merge `766312a` (foundation only). | Vehicle data cannot be fabricated client-side. |
| 30 | Not implemented. Bounded interpolation utility only; no prediction or wire behavior. | Agent B realtime ordering/removal/reconciliation contract. | PR #9, merge `766312a` (foundation only). | Live movement requires the approved stream contract. |
| 31 | Not implemented. | Agent B server-authoritative route/direction availability contract. | None. | Client filtering would duplicate backend authority. |
| 32 | Not implemented. Privacy-safe presentation mapper only. | Agent B public vehicle DTO. | PR #9, merge `766312a` (foundation only). | Route label fields must come from the approved DTO. |
| 33 | Not implemented. Privacy allow-list tests only. | Agent B public vehicle DTO. | PR #9, merge `766312a` (foundation only). | Plate/detail exposure must be contract-authorized. |
| 34 | Not implemented. Validated color presentation helper only. | Agent B public vehicle DTO/color source. | PR #9, merge `766312a` (foundation only). | Marker data source remains unapproved. |
| 35 | Not implemented. Staleness clock utility only. | Agent B status/last-update/direction and reconciliation contracts. | PR #9, merge `766312a` (foundation only). | Status must remain server-authoritative. |
| 36 | Device-local Favorites add/remove, duplicate handling, capped persistence, restart restore, failed-read/write truthfulness, inaccessible-route behavior and shared Map selection are delivered. | Available-jeepney count remains gated on Agent B. Physical-device Preferences persistence remains owner-gated. | PR #6, merge `131944f`; closure branch regression. | Favorites has no further independent gap; count semantics require Agent B. |
| 37 | Gated UI explains that direct trip discovery is unavailable; no fake planner or multi-transfer claim. | Agent A G6 normalized place/direct-route contract. | Existing gated UI only. | Implementing discovery now would invent endpoints and business behavior. |

## Integrated validation

- Web: lint, strict app/spec typecheck, 17 test files / 170 tests, production build, runtime audit with zero vulnerabilities, full audit recorded, and `git diff --check`.
- Real browser engine: installed Chrome headless at 390×844 and 320×568; MapLibre canvas/tabs, route result, Favorites reload/remove/withdrawn-route behavior, and token URL scrubbing passed against controlled API responses. The expected mocked withdrawn-route 404 was the only console network error.
- Android: final production web build, `npx cap sync android`, and Gradle `test lintDebug assembleDebug` passed with JBR 21.0.7, Gradle 8.14.3, AGP 8.13.0 and API 36. The debug APK is 6,107,403 bytes, SHA-256 `B69FD68831A69B6FC53B47B7ACB5E29CB60F5F34B69E3166CCE2A625BCB5DD53`.
- Manifest: backup disabled; foreground coarse/fine location plus Internet/network-state permissions only; no background location. Secure Storage, Preferences and Geolocation plugins compiled. Physical-device acceptance is not claimed.
- Dependency audit: runtime zero. Full audit reports 3 high, 3 moderate and 1 low in Angular/Capacitor development tooling; npm’s proposed fixes require breaking tooling changes and were intentionally not forced.
