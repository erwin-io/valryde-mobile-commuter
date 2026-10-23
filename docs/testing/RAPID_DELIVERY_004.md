# Rapid Delivery 004 — real commuter acceptance

Directives: VALRYDE-C-RAPID-DELIVERY-004 and C-SEC-001. PR #13 is the independent acceptance branch; PR #14 stays unchanged/tracking-unavailable.

## Actual environment evidence

- Both loopback health URLs returned 200 with API/database `ok`; canonical backend main remains `810c8a13356ddbf0e28a4faf5ad7f86ce0a30479`.
- Tech Lead identifies the attached database as isolated `valryde_ui_dev`. The health endpoint does not expose database identity; this is an explicit owner attestation, not a new SQL inspection.
- Real seeded public catalogue has two ACTIVE routes; forward travel-order matching, empty direct discovery, invalid-coordinate rejection and unauthenticated place search were exercised.
- Real Chrome at 390×844 and 320×568 loaded the seeded route/details and official route line with the actual OpenFreeMap style/tiles. No route interception, mocked responses or substituted style was used. Screenshots inspected.
- Expanded live runner: 12 checks passed, zero failed, including actual browser permission denial, pitch, offline metadata fallback and online reconciliation at both widths. Exact latest results: `evidence/rapid-004/real-backend-public-results.json`. The earlier failed reconnect run is preserved as `BEFORE_FIX-offline-reconnect-results.json`; its defect is fixed and covered by two new service tests.
- Final web gates: `npm run lint`, `npm run typecheck`, `npm test` (19 files, 189 tests), `npm run build` (642.18 kB initial bundle), `npm audit --omit=dev` (zero runtime vulnerabilities) and `git diff --check` passed.
- Final production bundle was synchronized with Capacitor; Gradle `test lintDebug assembleDebug` passed (381 actionable tasks, 65 executed). Debug APK SHA-256: `5F1F1776A700A9564FBA753B0D8BD31A6594484994A2FF7F673B313F34ADEA3C`.

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

## Device and provider gates

`adb devices` showed no Android target. A reduced-memory headless/read-only AVD launch was attempted after memory recovered, but automatic approval review rejected the launch with only `blocked by policy`; it was not retried by another route. Emulator/native runtime acceptance is unperformed. No Hyper-V, host networking, backend, production, database or Traccar setting was changed. Native Google OAuth, verified HTTPS links, final API origin/signing and offline provider permissions remain external gates. A metadata/geometry cache is implemented; tile caching is not claimed.

## Boundaries

Only the approved local development API/seeded commuter account is accepted by the authenticated runner. Profile changes are restored; test refresh sessions are revoked best-effort. No production account, data or Traccar device operation is permitted. Historical controlled harnesses remain regression evidence only and are not substituted for these real-backend results. No merge/deployment or new Completed claim is authorized by this report.
