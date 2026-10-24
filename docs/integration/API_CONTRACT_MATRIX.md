# API Contract Matrix

**Verified backend:** `valryde-api` canonical `main` at `711f4c45967e192be155e05e72714b99645ecc7d`\
**Verification date:** 2026-10-21\
**Base path:** configurable origin plus `/api`

`AVAILABLE` means present in merged source/OpenAPI at the revision above. It does not mean the current environment is deployed or reachable.

## Available Agent A contracts

| Capability | Method/path | Auth | Request | Success response | Client use |
|---|---|---|---|---|---|
| Health | `GET /api/health` | Public | — | `{status, database}` | Distinguish API readiness; do not treat as internet detector |
| Register | `POST /api/auth/register` | Public | `{email,password,displayName,role:"COMMUTER"}` | `201 {user,message}` | Checklist 22 |
| Verify email | `POST /api/auth/verify-email` | Public | `{token}` | `{user}` | Checklist 22 |
| Resend verification | `POST /api/auth/resend-verification` | Public | `{email}` | `202 {message}` | Checklist 22; preserve enumeration-resistant message |
| Login | `POST /api/auth/login` | Public | `{email,password}` | access/refresh tokens, expiry fields, `user` | Checklist 22 |
| Google sign-in | `POST /api/auth/google` | Public | `{idToken,role:"COMMUTER"}` | token bundle and `user` | Gated by configured real OAuth client evidence |
| Refresh | `POST /api/auth/refresh` | Public | `{refreshToken}` | rotated token bundle and `user` | Session recovery; serialize refresh attempts |
| Logout | `POST /api/auth/logout` | Public | `{refreshToken}` | `204 null` | Clear local session regardless of network outcome policy review |
| Forgot password | `POST /api/auth/forgot-password` | Public | `{email}` | `202 {message}` | Preserve generic response |
| Reset password | `POST /api/auth/reset-password` | Public | `{token,password}` | `204 null` | Checklist 22 |
| Profile | `GET /api/auth/me` | Bearer | — | `{user}` | User has `id,email,displayName,status,emailVerified,roles,createdAt,updatedAt` |
| Update profile | `PATCH /api/auth/me` | Bearer | `{displayName}` | `{user}` | Checklist 22 |
| Change password | `POST /api/auth/me/change-password` | Bearer | `{currentPassword,newPassword}` | `204 null` | Invalidates prior sessions per backend description |
| Request email change | `POST /api/auth/me/change-email` | Bearer | `{email}` | `202 {message}` | Requires later confirmation |
| Confirm email change | `POST /api/auth/confirm-email-change` | Public | `{token}` | `{user}` | Checklist 22 |
| Route list/search | `GET /api/transit-routes` | Public | Query `q?`, `page?`, `pageSize?` | `{routes,pagination}` | Checklists 24–25; active routes/directions only |
| Route detail | `GET /api/transit-routes/:routeId` | Public | UUID path | `{route}` | Checklists 26–28 |

### Public route DTO

`route`: `id`, `routeCode`, `publicName`, nullable `description`, `routeColorHex`, `status`, timestamps, `directions[]`.

`direction`: `id`, `routeId`, `directionLabel`, `originName`, `destinationName`, GeoJSON `LineString` coordinates in WGS84 longitude/latitude order, `corridorM`, `status`, timestamps.

`pagination`: `page`, `pageSize`, `total`, `totalPages`.

Errors use `{error:{code,message,requestId,details?}}`. The UI maps known codes to safe messages and retains `requestId` for support diagnostics.

## Unavailable / gated contracts

| Capability | State at verified revision | Client rule |
|---|---|---|
| Formal stops / stop sequence / routes by stop | ABSENT; formal stop registry is outside approved MVP | No runtime stop markers/details or invented stop data |
| Place/POI search | ABSENT | Do not call Photon directly; destination UI remains gated |
| Direct route discovery near origin/destination | ABSENT | Do not invent endpoint or geospatial algorithm |
| Journey combinations, walking/transfer steps | OUT OF MVP / ABSENT | Specification only; do not expose as working feature |
| Fares, schedules, ETA | ABSENT | Do not display estimates |
| Favorite-route persistence | CONTRACT UNDECIDED | Keep boundary isolated; no sync claim |
| Public vehicle snapshot / available count | ABSENT | No fake vehicles/counts |
| Pusher channel authorization/events | ABSENT | No subscription code until Agent B/Tech Lead approval |

## Environment mapping

- Browser: configured reachable API origin, commonly loopback during local development.
- Android emulator: use an explicitly configured host alias such as `10.0.2.2`; do not hard-code it in services.
- Physical device: use an explicitly configured HTTPS/LAN origin allowed by backend CORS and network policy.

## Client implementation status (checklists 24–28)

Re-verified on 2026-10-21 against Agent A's frontend handoff (`docs/integration/AGENT_A_FRONTEND_API_INTEGRATION_HANDOFF.md`, merged via valryde-api PR #6) and its OpenAPI snapshot `AGENT_A_OPENAPI_AUDIT.json`. The DTOs above are unchanged.

| Endpoint | Client | State |
|---|---|---|
| `GET /api/transit-routes?q&page&pageSize` | `TransitRoutesService.list` → Routes tab | Integrated (real). `q` trimmed, omitted when empty, capped at 160; `pageSize` 20. |
| `GET /api/transit-routes/{routeId}` | `TransitRoutesService.get` → route sheet on Map | Integrated (real). A `400` (malformed id) or `404` shows "Route not found". |

Error handling (`src/app/core/api-failure.ts`): status `0` → network; `404` → not found; `429` or any response with `retry-after` → rate limited (handles defect D1, where rate limits arrive as `500`); everything else → unavailable. Only safe copy and the server `requestId` are shown.

Development connectivity: `ng serve` proxies `/api` to `http://127.0.0.1:3000` (`proxy.conf.json`), and `environment.apiBaseUrl` is `/api`. Native builds need an absolute API origin per environment, plus `https://localhost` in the API's `CORS_ORIGINS` (defect D2).

Still gated: place search and direct discovery (ID 37, gap G6) show a disabled "Plan a trip" form; live jeepneys (29–35) show a note in the route sheet. No fixtures ship in the app.

## Client implementation status (checklist 22 — commuter auth)

| Endpoint(s) | Client | State |
|---|---|---|
| `POST /auth/register` (`role: "COMMUTER"`), `/verify-email`, `/resend-verification` | Register page, email-link page (`/auth/verify-email?token=`), sign-in resend | Integrated (real) |
| `POST /auth/login`, `/refresh`, `/logout` | `SessionService` (single-flight refresh, rotation, local sign-out) | Integrated (real) |
| `POST /auth/forgot-password`, `/reset-password` | Email-request page; password page (`/auth/reset-password?token=`) | Integrated (real) |
| `GET/PATCH /auth/me` | Account page (profile, name edit) via the bearer interceptor | Integrated (real) |
| `POST /auth/me/change-password` | Password page (change); local session ends after 204 | Integrated (real) |
| `POST /auth/me/change-email`, `/auth/confirm-email-change` | Email-request page; email-link page (`/account/confirm-email-change?token=`); local session ends after confirm | Integrated (real) |
| `POST /auth/google` | — | Not used (owner client ID gated) |

The link routes match the backend's default `APP_VERIFICATION_URL`, `APP_PASSWORD_RESET_URL` and `APP_EMAIL_CHANGE_URL`. On a phone they still open the web origin until mobile deep links are configured (gap G5).

Observed backend behaviour the client depends on (verified locally on 2026-10-21, no contract change):
- Refresh rotates. Reusing a rotated refresh token returns `401 SESSION_REVOKED` **and revokes the newest token in that family**, so the client serializes refreshes.
- Confirming an email change bumps `credentials_version` and revokes all sessions, like a password change. The frontend handoff documents this only for password changes.
- Logout revokes only the submitted refresh token (the current device).

## ID 37 — merged G6 consumer (2026-10-23)

Canonical API main `810c8a13356ddbf0e28a4faf5ad7f86ce0a30479` now includes merged G6 PR #28. Historical ABSENT/gated entries above describe the pre-G6 audit. Runtime now consumes authenticated `GET /api/places/search` and public `GET /api/transit-routes/discover`; see `docs/testing/DESTINATION_DISCOVERY_37.md`. No direct provider access or transfer planner. Live consumer contracts remain unavailable.
