# Rapid Delivery 004 — real commuter acceptance

Directives: VALRYDE-C-RAPID-DELIVERY-004 and C-SEC-001. PR #13 is the independent acceptance branch; PR #14 stays unchanged/tracking-unavailable.

## Actual environment evidence

- Both loopback health URLs returned 200 with API/database `ok`; canonical backend main remains `810c8a13356ddbf0e28a4faf5ad7f86ce0a30479`.
- Tech Lead identifies the attached database as isolated `valryde_ui_dev`. The health endpoint does not expose database identity; this is an explicit owner attestation, not a new SQL inspection.
- Real seeded public catalogue has two ACTIVE routes; forward travel-order matching, empty direct discovery, invalid-coordinate rejection and unauthenticated place search were exercised.
- Real Chrome at 390×844 and 320×568 loaded the seeded route/details and official route line with the actual OpenFreeMap style/tiles. No route interception, mocked responses or substituted style was used. Screenshots inspected.
- Expanded live runner: 19 checks passed, zero failed, including real seeded route-code search and two-page API pagination, browser matching/empty route search, direction/map handoff, malformed route deep-link handling, permission denial, pitch, saved metadata fallback, manual retry and online reconciliation at both widths. Exact latest results: `evidence/rapid-004/real-backend-public-results.json`. The earlier failed reconnect run is preserved as `BEFORE_FIX-offline-reconnect-results.json`; its product defect is fixed and covered by two new service tests. A later direction test timed out because its selector assumed Ionic reflected a `value` attribute; `BEFORE_FIX-direction-check-results.json` preserves that harness failure. Selecting by the visible direction label passed at both widths.
- Review correction: the saved list/detail now says VALRYDE cannot be reached, which is accurate when the API is down but the phone still reports connectivity. The saved detail offers a manual live retry if the API recovers without a browser `online` event. The real browser runner exercised the retry while offline and the subsequent live reconciliation.
- Final web gates: `npm run lint`, `npm run typecheck`, `npm test` (19 files, 189 tests), `npm run build` (642.18 kB initial bundle), `npm audit --omit=dev` (zero runtime vulnerabilities) and `git diff --check` passed.
- Final production bundle was synchronized with Capacitor; Gradle `test lintDebug assembleDebug` passed (381 actionable tasks, 65 executed). Debug APK SHA-256 after the acceptance-recovery copy/retry correction: `5904B9C2552108D40AA8FD9C8D9631B14B9A6174F8CCCFDE6EDD501B05B143E9`.

## Approved secret provisioning

Runner variables:

| Variable | Purpose |
|---|---|
| `VALRYDE_ACCEPTANCE_API_ORIGIN` | Approved loopback API, default `http://127.0.0.1:3000` |
| `VALRYDE_FIXTURE_EMAIL` | Seeded commuter account supplied by Tech Lead |
| `VALRYDE_FIXTURE_PASSWORD` | Operator-entered password, child process only |
| `VALRYDE_ACCEPTANCE_DATABASE` | Must equal `valryde_ui_dev` for authenticated tests |
| `VALRYDE_ACCEPTANCE_RATE_LIMIT` | `1` enables a bounded, final per-fixture-account throttle probe |

Use PowerShell 7 from the commuter branch:

```powershell
& .\scripts\Invoke-CommuterAcceptance.ps1 -ConfirmIsolatedUiDatabase -TestRateLimit
```

The launcher uses `Read-Host -AsSecureString`; password/token values are never printed, placed in command arguments, or persisted. It supplies the password only through `ProcessStartInfo.Environment`, clears launcher references after starting the child, zeroes the temporary BSTR, disposes the secure string, and removes task credential environment variables in `finally`. The Node runner removes credential environment variables before launching Chrome and retains secrets only in memory for the test lifetime. Results contain named checks, endpoint paths/statuses and gaps, not response bodies or credentials. No persistent credential file or vault lookup is supported or approved. Do not read unrelated `.env` files.

The authenticated runner is prepared to exercise normal fixture login/profile, profile change with restoration, real G6 response shape or 503, real browser login/G6/logout, rotation/logout and refresh replay race. `-TestRateLimit` may exhaust the seeded commuter user's one-minute place quota; it runs last. These checks remain **CREDENTIALS_NOT_CONFIGURED** until the operator supplies the password; prepared code is not executed acceptance evidence.

## Item acceptance matrix

| ID | Evidence obtained | Unexecuted / gates | Disposition |
|---|---|---|---|
| 22 | Existing merged flows/race suite; live API connectivity and unauthenticated boundary | Secure fixture login; registration/verification/recovery test inbox; native Google OAuth/links/storage acceptance | Not newly Completed |
| 23 | Real provider map and seeded official line at two widths; permission denial/pitch, offline saved route and reconnect to the actual API verified in Chrome; existing controls/cleanup/cache tests | Native target/runtime permissions/follow; approved offline tile rights | Not newly Completed |
| 37 | Real discovery matching/empty/validation; 401 place boundary; real route/map handoff | Authenticated place 200/503/429; provider-enabled candidate/empty attribution and complete destination flow | Not newly Completed |

## Acceptance recovery decision, IDs 22–37

No item below is newly `FULLY ACCEPTED` by Agent C. The statuses name the next binding gate, not a regression of merged code. PR #14 is separately reviewable UI but ships a gateway that reports unavailable and issues no tracking request.

| ID | Status | Exact evidence and smallest remaining step |
|---:|---|---|
| 22 | DEVICE/OWNER GATED | Merged account flows/race coverage and 189-test suite; run the secure fixture login/profile/rotation/logout/replay checks, supply an approved inbox/link sink and native Google OAuth/device target. |
| 23 | DEVICE/OWNER GATED | Real Chrome map at 390/320, provider tiles/official line, denied location, pitch, metadata fallback/reconnect, Android build; verify native permission/follow/rotation and obtain tile cache rights before claiming offline base maps. |
| 24 | CODE COMPLETE / ACCEPTANCE PENDING | Merged debounced search/cancellation; real API and Chrome route-code search return fixture DEV-10A, and Chrome shows the empty result at 390/320. Finish keyboard/accessibility and error/retry acceptance. |
| 25 | CODE COMPLETE / ACCEPTANCE PENDING | Merged list/pagination/cache behavior; real API pageSize=1 returned distinct DEV-10A and DEV-20B pages. Browser load-more needs a fixture set above the UI page size of 20. |
| 26 | CODE COMPLETE / ACCEPTANCE PENDING | Merged detail/retry/cache; real detail, malformed deep-link 400, saved-detail/manual-retry/reconnect browser acceptance pass at 390/320. Finish withdrawn-route behavior against an approved fixture. |
| 27 | CODE COMPLETE / ACCEPTANCE PENDING | Merged explicit direction/navigation tests; real fixture direction switch updated the map URL and visible endpoints at 390/320. Finish back/deep-link and device acceptance if required. |
| 28 | DEVICE/OWNER GATED | Merged validated official geometry/color/fit behavior and real Chrome map line at two widths; verify visual fit and lifecycle on Android. |
| 29 | CONTRACT BLOCKED | PR #14 marker/adapter UI tests only; Agent B must approve public snapshot endpoint/DTO and supply real eligible vehicles. |
| 30 | CONTRACT BLOCKED | PR #14 bounded received-fix interpolation tests; Agent B must approve ordering, removal and reconciliation semantics. |
| 31 | CONTRACT BLOCKED | PR #14 client narrowing tests; Agent B must provide server-authoritative route/direction eligibility. |
| 32 | CONTRACT BLOCKED | PR #14 accessible route labels/tests; Agent B must authorize route labels in its public vehicle DTO. |
| 33 | CONTRACT BLOCKED | PR #14 plate/details allow-list tests; Agent B must authorize public vehicle details and privacy fields. |
| 34 | CONTRACT BLOCKED | PR #14 validated vehicle color tests; Agent B must authorize the public physical-color source. |
| 35 | CONTRACT BLOCKED | PR #14 status/freshness/lifecycle tests; Agent B must release status, timestamp and realtime reconciliation contract. |
| 36 | CONTRACT BLOCKED | Merged local Favorites tests and PR #14 count UI tests; Agent B must approve available-count semantics, then native Preferences persistence needs device evidence. |
| 37 | CODE COMPLETE / ACCEPTANCE PENDING | PR #13 G6 implementation, 13 live public checks and 189 unit tests; run authenticated place 200/503/429 and actual candidate/empty flow with the approved fixture, then native destination selection if required. |

IDs 24, 26 and 27 are closest to independent public acceptance after the remaining error, back/deep-link and accessibility review; they do not require commuter credentials or a new Agent A/B API. Authenticated tests alone cannot complete ID 22 because inbox, OAuth and device gates remain. ID 37 is the closest primary target after authentication if the approved provider yields normalized candidates; a real 503 establishes the disabled-state behavior but leaves provider-enabled candidate acceptance open. IDs 29–36 require Agent B, and no additional Agent A G6 endpoint is currently missing.

## Device and provider gates

`adb devices` showed no Android target. A reduced-memory headless/read-only AVD launch was attempted after memory recovered, but automatic approval review rejected the launch with only `blocked by policy`; it was not retried by another route. Emulator/native runtime acceptance is unperformed. No Hyper-V, host networking, backend, production, database or Traccar setting was changed. Native Google OAuth, verified HTTPS links, final API origin/signing and offline provider permissions remain external gates. A metadata/geometry cache is implemented; tile caching is not claimed.

## Boundaries

Only the approved local development API/seeded commuter account is accepted by the authenticated runner. Profile changes are restored; test refresh sessions are revoked best-effort. No production account, data or Traccar device operation is permitted. Historical controlled harnesses remain regression evidence only and are not substituted for these real-backend results. No merge/deployment or new Completed claim is authorized by this report.
