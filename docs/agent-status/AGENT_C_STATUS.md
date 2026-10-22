# VALRYDE — Agent C Status

## Current snapshot

- Updated at (ISO 8601, Asia/Manila): 2026-10-22T09:15:00+08:00
- Agent / module: C — Commuter Mobile
- Repository: `valryde-mobile-commuter`
- Branch / HEAD SHA: `feat/36-local-favorite-routes` (PR B of the independent UI batch), based on `main` `4e225fb`; independent of PR A (#5). SHAs in the PR.
- Repository status: Checklists 23 and 24–28 merged (PR #2, PR #3). The checklist 22 commuter-auth slice is committed on the feature branch for Tech Lead review. Untracked `.scaffold-reference/` and `.claude/` (local preview config, PR drafts, local-only test-account values) are intentionally not committed.
- Execution agent: Claude (took over from Codex on 2026-10-21).
- Governance version: Shared AI Agent Status & Activity Reporting Policy 1.1; local copy matches canonical `valryde-api` `origin/main` blob `8a5df8ae6fbc483e45cf63f10cdda438b6c6138c`.
- Checklist IDs: 22–37
- GitHub issues / PRs: PR #2 merged (`38638b5`), PR #3 merged (`0418722`). Checklist 22 PR https://github.com/erwin-io/valryde-mobile-commuter/pull/4 (`feat/22-commuter-auth` → `main`, open, awaiting Tech Lead review; not to be self-merged).
- Implementation progress: IN_PROGRESS (independent UI batch: PR A #5 and PR B favorites both submitted for review). 22–28 core previously accepted.
- Tech Lead review decision (if actually issued): PR #4 CHANGES REQUIRED at `314051f`: a refresh response arriving after `signOut()` could re-authenticate and persist a refresh token. Correction submitted on the same PR; awaiting Agent G re-review. Earlier: PR #2 and PR #3 accepted and merged; 650 kB budget approved; Cebu City default center; ID 37 blocked on G6.
- Current objective: Tech Lead review of PR A (#5) and PR B (ID 36 local favorites).
- Last confirmed result: PR B: device-local favorites (save/remove, duplicates prevented, unavailable routes, empty state) pass 97 tests on this branch; build 640 kB; runtime audit 0 vulnerabilities; real API 404 shown as "Route no longer available".
- Next concrete action: Address Tech Lead review. Candidate next slice: 36 favorites (needs a device-local vs backend decision) or tracking once Agent B contracts are accepted.
- Blocked by / decision owner: Physical-device verification (owner); ID 37 needs G6 (Agent A); 29–35 need Agent B contracts; mobile deep links for emailed links (G5, owner).
- Dependencies / affected agents: Agent A (auth contracts; D1, D2, G5), Agent B (tracking), Tech Lead G (review).

## Checklist coverage

| Checklist ID | Feature / slice | Progress | Evidence (files/tests/PR) | Blocker / next action |
|---:|---|---|---|---|
| 22 | Commuter signup/login/profile | READY_FOR_REVIEW | `src/app/core/auth/*`, `src/app/features/account/*`; 33 auth tests; real-API run; 13 screenshots in `docs/testing/evidence/checklist-22/` | Tech Lead review; native secure storage untested on a device |
| 23 | Landing/map/current location | DONE_AFTER_ACCEPTANCE | PR #2; default center now Cebu City | Native device verification pending |
| 24–28 | Route search/list/details/direction/line | DONE_AFTER_ACCEPTANCE | PR #3 | Real populated route data still unverified |
| 29–35 | Live availability/movement/details/status | NOT_STARTED | Gated note only | Approved Agent B contracts |
| 36 | Available count/favorites | READY_FOR_REVIEW (favorites only, PR B); count NOT_STARTED | `features/favorites/*`, star toggle in route sheet; 16 favorites tests; real 404 handling | Active jeepney count gated on Agent B; favorites are device-local by approved scope |
| 37 | Place search/direct transit discovery | PARTIAL (UI gated) | "Plan a trip" gated form | Agent A G6 |

## Latest verification

| Command / check | Environment | Result | Date/time | Evidence / notes |
|---|---|---|---|---|
| `npm run lint` | Local Windows, Node 22.17.1 | PASSED | 2026-10-21 10:54 +08:00 | No findings. |
| `npm run typecheck` | Local Windows | PASSED | 2026-10-21 10:54 +08:00 | App + spec. |
| PR B gates: lint, typecheck, `npm test`, build, `git diff --check`, `npm audit --omit=dev` | Local Windows, Node 22.17.1 | PASSED | 2026-10-22 09:10 +08:00 | 13 files / 97 tests (branch from `main`); initial 640 kB; 0 runtime vulnerabilities. |
| PR B browser checks | Claude browser pane 390×844 | PASSED | 2026-10-22 09:00–09:10 +08:00 | Star saved route + direction ids only; Favorites tab listed the replayed real fixture with the saved direction; a real API 404 showed "Route no longer available" with remove; Ionic inner-button aria labels verified after toggling. |
| `npm test` | Local Windows, jsdom | PASSED | 2026-10-21 18:30 +08:00 | 12 files, 81 tests. PR #4 correction: C-RACE-01…06 plus a late-profile-update guard; before the fix 5 of these 7 failed (C-RACE-01…04 and the guard). |
| PR #4 correction gates: `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check` | Local Windows | PASSED | 2026-10-21 18:30 +08:00 | Initial bundle 641 kB raw / 171 kB transfer. |
| Agent A auth contract re-check | `valryde-api` `origin/main` `827738c` vs audited `4a9a152` (source diff) | PASSED | 2026-10-21 18:30 +08:00 | Request/response shapes unchanged. Additive: rate limits now return `429 RATE_LIMITED` (D1 fixed in `34cc664`); already handled and now pinned by C-RACE-06. Live API not re-run for this correction. |
| `npm run build` | Local Windows | PASSED | 2026-10-21 10:54 +08:00 | Initial 640 kB raw / 171 kB transfer (under the approved 650 kB warning). |
| `git diff --check` | Local repository | PASSED | 2026-10-21 10:54 +08:00 | — |
| Real API auth flow in browser (`ng serve` proxy → local `valryde-api` `origin/main`; local SMTP sink in place of Mailpit) | Localhost only; generated `@example.test` account; values kept in untracked `.claude/` | PASSED | 2026-10-21 10:44–10:52 +08:00 | register 201; login before verify 403 `EMAIL_NOT_VERIFIED`; verify-email 200, reuse 400 `INVALID_CHALLENGE`; login 200; forced expiry → refresh 200 → `PATCH /auth/me` 200; change-email 202; confirm 200; change-password 204; logout 204; forgot-password 202; reset-password 204; login with reset password 200. |
| Server rotation/revocation (direct API) | Local API | PASSED | 2026-10-21 10:52 +08:00 | Refresh rotates; reusing a rotated token → 401 `SESSION_REVOKED` and also revokes the newest token in the family; refresh after logout → 401; old password → 401 `INVALID_CREDENTIALS`. |
| Native secure storage (Keychain/Keystore) | — | NOT_RUN | — | Android platform not added; browser uses memory-only storage. |
| `npm audit` | Local repository | 4 high, 3 moderate | 2026-10-21 10:30 +08:00 | All dev tooling: `@angular/build`/`vite` (launch-editor), `@angular/cli` (MCP SDK), `@capacitor/cli` (`uuid`/`xcode`). Not shipped; npm's only fixes are major downgrades. The new plugin adds none. |

## Shared contract / risk changes

- API/DTO/schema/migration changes: None. Consumes the 14 merged `/api/auth/*` operations (Google sign-in not used) exactly as in `AGENT_A_OPENAPI_AUDIT.json`.
- Auth/RBAC/data-isolation impact: Bearer tokens are attached only to requests flagged `REQUIRES_AUTH` (the `/auth/me*` calls), never to public route, tile or other-host requests. Registration always sends `role: "COMMUTER"`. The server remains authoritative.
- Realtime/Traccar/geospatial impact: None.
- Secrets/security/privacy impact: Access token memory-only. Refresh token in the iOS Keychain / Android Keystore via `capacitor-secure-storage-plugin@0.13.0` on native, memory-only in the browser (the plugin's web fallback is `localStorage`, which the Agent A handoff forbids). Refresh is single-flight. No credentials committed. Test values live only in untracked `.claude/test-accounts.local.env`.
- Contract observations for the Tech Lead (not changes): (1) confirming an email change bumps `credentials_version` and revokes all sessions (`pg-identity-repository.ts:160-171`); the frontend handoff mentions this only for password changes. (2) Reusing a rotated refresh token revokes the whole token family.
- Required Tech Lead or owner decision: Re-review PR #4; G5 mobile deep links for emailed links. The secure-storage plugin is provisionally accepted for development.

## Operator / hardware / external gates

- Gate: Android build and physical-device verification (Keystore storage across restarts, sign-in, emailed links).
- Required actor: Owner/operator with an Android SDK and device; needs an absolute `apiBaseUrl`, D2 (CORS `https://localhost`), and G5 for links to open the app.
- Requested evidence: `npx cap add android`/`sync` output; restart-persistence check; device screenshots.
- State: OWNER_VERIFICATION_PENDING (not attempted).

## Activity log (newest first; preserve prior entries)

### 2026-10-22 09:15 +08:00 — Independent UI batch PR B: ID 36 device-local favorite routes

- Action / reason: Approved C3 scope: save/remove favorite routes on the device; active jeepney count stays gated.
- Checklist/issue: 36 (favorites portion only).
- Files/config/services affected: `features/favorites/favorites.service.ts`, `favorites.page.ts`, `favorites.spec.ts`; star toggle in `features/routes/route-detail.component.ts`; `app.routes.ts`; `shared/state-panel.component.ts`; removed unused `shell/pending-feature.page.ts`; `package.json`/lock (`@capacitor/preferences@8.0.1`, official, MIT); docs.
- Observed result (success/failure/rollback): Success. Browser review found that Ionic `ion-button` copies `aria-*` attributes into its shadow button only once, so a dynamic `[attr.aria-label]`/`aria-pressed` went stale for screen readers (host said "Remove", the inner button still said "Save"). Fixed by rendering one button per state with static attributes; the same pattern exists in PR A's follow button and will be fixed on that branch. The Favorites tab also fetched each route twice on first entry (constructor + first `ionViewWillEnter`); in-flight routes are now skipped.
- Validation and evidence: 97 tests; lint, typecheck, build, diff check, runtime audit passed; real 404 and replayed-real data verified in browser.
- Contracts / risks / dependencies: No API change. Favorites persist only `{routeId, directionId, savedAt}` in Capacitor Preferences (`valryde.favorites.v1`), separate from the secure refresh-token store; capped at 50; not synced to accounts or other devices (no approved backend contract). Uses the existing public route-detail endpoint per favorite.
- Commit/PR link or SHA (if available): See PR B on `feat/36-local-favorite-routes`.
- Next action / owner gate: Tech Lead review; merge order is independent of PR A (expect a small conflict in `route-detail.component.ts`).

### 2026-10-21 18:35 +08:00 — PR #4 security correction: session concurrency

- Action / reason: Agent G (CHANGES REQUIRED at `314051f`) found that `SessionService` accepted an in-flight refresh response after `signOut()` and persisted a new refresh token.
- Checklist/issue: 22; PR #4.
- Files/config/services affected: `src/app/core/auth/session.service.ts`, `src/app/core/auth/session.service.spec.ts`, this status.
- Observed result (success/failure/rollback): Cause: sign-in, refresh and restore results were applied unconditionally after their awaits; `rotation` survived a sign-out; storage writes and clears were unordered. Fix: a session generation counter bumped synchronously by every sign-out and local clear, and checked after each await; single-flight refresh scoped to its generation; refresh-token reads, writes and clears run through one ordered queue; a late token is never stored and is revoked server-side (best effort); `setUser` only accepts the signed-in account. Access tokens stay memory-only, browser refresh tokens stay memory-only, and native storage still uses the existing secure-storage abstraction.
- Validation and evidence: The new tests were written first and run against the old code: C-RACE-01, -02, -03, -04 and the late-profile guard FAILED (`expected 'signed-in' to be 'signed-out'`); C-RACE-05 and -06 passed. After the fix all 7 pass; full suite 81/81; lint, typecheck, build and diff check passed. One existing test needed a timing change (it now waits for the queued storage read before emitting the mocked response); its assertions are unchanged.
- Contracts / risks / dependencies: No API, DTO or server behaviour change. valryde-api `main` advanced to `827738c`; the only auth-relevant change is additive (429 `RATE_LIMITED`) and already handled. Device Keychain/Keystore verification remains pending.
- Commit/PR link or SHA (if available): Correction commit on PR #4 https://github.com/erwin-io/valryde-mobile-commuter/pull/4 (SHA in the PR reply).
- Next action / owner gate: Agent G re-review; do not merge without owner authorization.

### 2026-10-21 11:00 +08:00 — Checklist 22 commuter auth implemented and verified against the real API

- Action / reason: The Tech Lead next release made checklist 22 the priority; also applied the Cebu City default center.
- Checklist/issue: 22.
- Files/config/services affected: `src/app/core/auth/*` (API client, session, interceptor, token store, guard, error copy, tests), `src/app/features/account/*` (account, sign-in, register, email request, password, email-link pages, tests), `app.config.ts`, `app.routes.ts`, `state-panel.component.ts`, `environment.ts`, `package.json`/lock (`capacitor-secure-storage-plugin@0.13.0`), evidence screenshots, docs.
- Observed result (success/failure/rollback): Success. Live testing found and fixed three defects: (1) the profile-name and email-request forms lacked `[formGroup]`, so submit did a native GET that reloaded the app and dropped the session; (2) emails with stray spaces failed validation before trimming; (3) after confirming an email change the app kept a session the API had revoked; it now signs out locally and asks the user to sign in with the new email.
- Validation and evidence: Gates passed; the real-API flow and server rotation checks are in Latest verification; screenshots in `docs/testing/evidence/checklist-22/`.
- Contracts / risks / dependencies: No contract change. While testing, another local app on `http://localhost:8100` (likely Agent D) used the same API and the SMTP sink I started; its data was not touched, and captured mail was deleted afterwards. The local API, SMTP sink and preview were stopped.
- Commit/PR link or SHA (if available): PR #4 https://github.com/erwin-io/valryde-mobile-commuter/pull/4; commit `098b7a0` plus this status-only commit.
- Next action / owner gate: Tech Lead review; physical-device verification.

### 2026-10-21 10:20 +08:00 — Checklists 24–28 transit discovery slice implemented

- Action / reason: The Tech Lead next development release authorized 24–28 after PR #2 merged. Read the Agent A frontend API handoff and the OpenAPI audit merged via valryde-api PR #6 before writing services.
- Checklist/issue: 24, 25, 26, 27, 28; gated UI for 37.
- Files/config/services affected: `src/app/core/api-failure.ts`, `src/app/features/routes/*` (service, routes page, list item, badge, detail sheet, selection service, geometry, gated trip planner, tests), `src/app/features/map/{map.page,transit-map.component}.ts`, `app.config.ts`, `app.routes.ts`, `environment.ts`/`app-config.ts` (`apiBaseUrl`), `proxy.conf.json`, `angular.json` (serve proxy, budget), evidence screenshots, docs.
- Observed result (success/failure/rollback): Success. Browser checks found and fixed three defects: the sheet content collapsed to 56 px (missing `ion-page` host class); the fit-to-route was skipped when a route was chosen from the hidden Routes tab (now deferred until the map has a size); a malformed deep link showed "temporarily unavailable" with Retry (a 400 on detail now means "Route not found").
- Validation and evidence: Lint, typecheck, 39 tests, build and diff check passed; real-API states and mocked populated flow captured in `docs/testing/evidence/checklist-24-28/`.
- Contracts / risks / dependencies: No contract change. The local valryde-api was only run (no migrations, no data written, no repo changes).
- Commit/PR link or SHA (if available): PR #3 https://github.com/erwin-io/valryde-mobile-commuter/pull/3; commits `7689f83`, `d4d517f` plus this status-only commit.
- Next action / owner gate: Tech Lead review; owner decision on dev route data.

### 2026-10-21 04:45 +08:00 — Checklist 23 PR submitted for Tech Lead review

- Action / reason: The owner switched the active GitHub CLI account to `erwin-io` and ran `gh auth setup-git`; the blocked push was resumed with the existing credential helper. No authentication settings were changed by the agent.
- Checklist/issue: 23; issue #1.
- Files/config/services affected: Remote branch `feat/23-map-shell`; PR #2; this status.
- Observed result (success/failure/rollback): Push succeeded; PR https://github.com/erwin-io/valryde-mobile-commuter/pull/2 opened against `main`. GitHub reports it mergeable, with 1 check passing and 0 failing.
- Validation and evidence: Local gates from 04:24–04:25 +08:00 unchanged (lint, typecheck, 13/13 tests, build, branch diff check passed). Native Android/device verification still pending.
- Contracts / risks / dependencies: None changed.
- Commit/PR link or SHA (if available): PR #2; code head `dcbe8ce` plus this status-only commit.
- Next action / owner gate: Tech Lead review. Do not merge without owner authorization.

### 2026-10-21 04:30 +08:00 — Checklist 23 PR prepared; push blocked by credentials

- Action / reason: Tech Lead G authorized formal PR submission for checklist 23.
- Checklist/issue: 23; issue #1.
- Files/config/services affected: `docs/testing/evidence/checklist-23/*.jpg` (5 screenshots); Markdown hard-break cleanup in `AGENTS.md`, the handoff and 4 docs; this status.
- Observed result (success/failure/rollback): Gates passed again. `git push -u origin feat/23-map-shell` failed with HTTP 403: the configured credential `seefixmanagement` lacks write access to `erwin-io/valryde-mobile-commuter`. Git authentication was not changed, per the instruction not to change it without approval. No PR exists yet.
- Validation and evidence: lint, typecheck, 13/13 tests, production build and diff check passed at 04:24–04:25 +08:00. All tests use test doubles (fake MapLibre factory, fake geolocation and Ionic controllers); no VALRYDE backend is involved in this slice.
- Contracts / risks / dependencies: None changed. Native Android/device verification remains pending.
- Commit/PR link or SHA (if available): Local `feat/23-map-shell`; the final SHA is reported in chat.
- Next action / owner gate: Owner grants `seefixmanagement` write access or approves a one-time push as `erwin-io`; then push and open the PR against `main`.

### 2026-10-21 04:15 +08:00 — Checklist 23 map-first shell implemented

- Action / reason: Implemented development stage 3, the first independent slice authorized by the Agent C directive and Tech Lead development release.
- Checklist/issue: 23 (landing, main transit map, current location).
- Files/config/services affected: `package.json`/`package-lock.json` (exact pins), `angular.json`, `tsconfig*.json`, `eslint.config.js`, `capacitor.config.ts`, `.editorconfig`, `.prettierrc`, `.gitignore`, `src/**` (shell tabs, map page, `TransitMapComponent`, `LocationService`, `ConnectivityService`, `StatePanelComponent`, `OfflineBannerComponent`, pending-feature page), `README.md`, `docs/architecture/APP_ARCHITECTURE.md`, this status.
- Observed result (success/failure/rollback): Success. Two defects were found during the browser check and fixed: MapLibre 6's worker failed to load after bundling (fixed with a copied worker asset and `setWorkerUrl`), and the recenter control overlapped the wrapped attribution at 320 px. Replaced the vulnerable Angular `21.2.0`/Vitest `4.0.8` from the reference scaffold with patched `21.2.25`/`21.2.27` and `4.1.12`.
- Validation and evidence: lint, typecheck, 13 tests, production build, `git diff --check` and the browser smoke test all passed (see Latest verification).
- Contracts / risks / dependencies: No shared contract consumed or changed. Remaining: Android/device verification, provisional `appId`, dev-only `npm audit` moderates.
- Commit/PR link or SHA (if available): See PR on `feat/23-map-shell`.
- Next action / owner gate: Tech Lead review; then checklists 24–28.

### 2026-10-21 03:50 +08:00 — Execution handover from Codex to Claude; context recovered

- Action / reason: Codex stopped because of usage limits after generating `.scaffold-reference/` (an unlogged plain Angular 21 CLI reference). Claude recovered context from `AGENTS.md`, the handoff, the policy, this status, the UX/integration/testing docs, Git state and `valryde-api` `origin/main`.
- Checklist/issue: 22–37 recovery; continued checklist 23.
- Files/config/services affected: None during recovery.
- Observed result (success/failure/rollback): `CLAUDE_TAKEOVER_READY`. HEAD `f186c4f`; all Codex work was uncommitted and was preserved; no PRs existed; Agent A `origin/main` was still `711f4c4`, matching the API contract matrix; Agent B contracts were still absent.
- Validation and evidence: Policy blob identical to canonical; Codex-reported checks were not rerun before the shell gates.
- Contracts / risks / dependencies: None changed.
- Commit/PR link or SHA (if available): None.
- Next action / owner gate: Implement the checklist 23 shell (done in the entry above).

### 2026-10-21 03:20 +08:00 — UX contract prepared from merged contracts

- Action / reason: Executed development stages 1–2 by inspecting canonical backend source/revisions and defining the complete map-first commuter screen-flow, component, map, API dependency, tracking-gate, and acceptance specifications.
- Checklist/issue: Agent C IDs 22–37; primary independent slice ID 23.
- Files/config/services affected: `docs/architecture/APP_ARCHITECTURE.md`; five `docs/ui-ux/` contracts; three `docs/integration/` contracts; `docs/testing/ACCEPTANCE_MATRIX.md`; this status.
- Observed result (success/failure/rollback): UX contract is ready for Tech Lead review. Agent A `main` at `711f4c45967e192be155e05e72714b99645ecc7d` confirms public auth/profile and transit list/detail contracts. Stop, place, direct-discovery, journey, favorites sync, public vehicle snapshot, and realtime contracts are absent and explicitly gated.
- Validation and evidence: Backend source/OpenAPI registrations inspected; Sakay.ph public product positioning reviewed only for general transit UX patterns; no proprietary assets/data/layouts copied. Documentation verification will run with the first shell gate.
- Contracts / risks / dependencies: No backend/shared contract changed. Major screens beyond the reversible shell await Tech Lead UX review; Agent B tracking remains blocked on accepted public consumer contracts.
- Commit/PR link or SHA (if available): Local branch `feat/23-map-shell`; no commit or PR created.
- Next action / owner gate: Implement the reversible Ionic/MapLibre shell, run quality gates, and report `UX_CONTRACT_READY`.

### 2026-10-21 +08:00 — Agent C repository bootstrap

- Action / reason: Inspected existing repository/Git state and read backend governance, the Agent C handoff, Tech Lead guidance, Agent A status, Agent B status, and the proposed tracking-bridge contract before establishing Agent C-local governance and documentation.
- Checklist/issue: Agent C IDs 22–37; repository bootstrap only.
- Files/config/services affected: Documentation and governance files in `valryde-mobile-commuter`; no application source, dependency, API, database, infrastructure, or service changes.
- Observed result (success/failure/rollback): Bootstrap files created/adapted; copied unrelated handoffs removed from the untracked bootstrap set; feature implementation intentionally not started.
- Validation and evidence: Required paths passed; canonical/local policy SHA-256 values match; the handoff directory contains only `AGENT_C_COMMUTER_MOBILE_HANDOFF.md`; `git diff --check` passed; application checks are not applicable because no scaffold exists.
- Contracts / risks / dependencies: Agent A contracts are reported ready for review but require merged canonical verification; Agent B public client contract is not yet approved; missing standalone baseline references are recorded rather than reconstructed.
- Commit/PR link or SHA (if available): No commit or PR created; existing `main` history preserved.
- Next action / owner gate: Complete bootstrap verification, then await the Agent C development directive and approved downstream contracts.
