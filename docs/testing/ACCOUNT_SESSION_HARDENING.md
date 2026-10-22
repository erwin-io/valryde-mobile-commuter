# Account and Session Hardening

**Scope:** Checklist 22

**Contract source:** Merged Agent A authentication API documented in `docs/integration/API_CONTRACT_MATRIX.md`. No endpoint, DTO, OAuth, or deep-link contract changed.

## Acceptance coverage

- Registration, verification, resend, sign-in, password recovery, profile, email change, password change, and sign-out remain covered by the account component regression suite and the existing real-development-API evidence under `docs/testing/evidence/checklist-22/`.
- Every authentication HTTP request now has a 15-second first-response deadline so half-open mobile connections return to a retryable UI state.
- Access and refresh credentials remain in request bodies or authorization headers; tests verify login credentials never enter URLs.
- Concurrent refresh remains single-flight. A protected request retries once after a 401; a second 401 clears the unusable local session without looping.
- A revoked token discovered while obtaining an access token is returned directly and is not refreshed again.
- Native secure-storage failures are distinguished from an absent token. Restore becomes retryable, and the UI tells the commuter to check connectivity or unlock the device.
- If a newly issued refresh token cannot be stored, the client revokes it best-effort and stays signed out instead of claiming a durable session.
- Sign-out still revokes a readable refresh token when native removal fails, while ending in-memory access immediately.
- Existing navigation guards continue to redirect every non-signed-in state. Google OAuth and native email-link routing remain gated on approved owner configuration/design.

## Evidence classification

The new regression evidence is automated and mocked at the Angular HTTP/native-storage boundaries. No new live account was created, no credential was logged, and no physical-device secure-storage claim is made. The earlier checklist-22 screenshots remain historical real-development-API evidence and were not regenerated in this package.
