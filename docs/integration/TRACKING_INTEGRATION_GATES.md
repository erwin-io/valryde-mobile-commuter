# Tracking Integration Gates

**Current state:** BLOCKED on approved Agent B public consumer contracts. Internal tracking-bridge tables and provider identifiers are not client APIs.

## Required contract evidence

- Public REST snapshot endpoint scoped to selected route direction.
- Public-safe vehicle DTO allowlist and exact enum/nullability rules.
- Server-authoritative availability filtering and count semantics.
- Pusher authentication endpoint, private channel scope, event names, payload schemas, and authorization failure behavior.
- Revision/ordering/deduplication semantics and delete/unavailable behavior.
- REST reconciliation rules for cold start, reconnect, app resume, focus, and event gaps.
- Error/rate-limit behavior and contract fixtures.
- Tech Lead acceptance plus merged canonical SHA.

## Client state machine

`IDLE → SNAPSHOT_LOADING → RECONCILING → LIVE`; connectivity/event failure moves to `RECONNECTING`, not directly to `LIVE`. Snapshot failure yields `UNAVAILABLE`. A vehicle that becomes stale or ineligible is removed from available results according to the server contract.

## Privacy gate

DTO/event fixtures must prove that driver identity, phone, operator-private data, Traccar credentials, raw provider identifiers, and private GPS history are absent. Client logging must redact tokens, channel auth material, and location payloads.

## Verification required

- Contract parsing tests for every event/snapshot variant.
- Out-of-order, duplicate, missed-event, reconnect, and resume tests.
- Fresh/moving, fresh/stopped, stale, unavailable, and removal visual tests.
- REST/Pusher integration test using an authorized test environment.
- Evidence that no client connects to Traccar and no compliance is computed locally.

Until every gate is met, the app may contain typed interfaces and non-navigable adapters only. It must not display mock vehicles as real or claim live GPS integration.
