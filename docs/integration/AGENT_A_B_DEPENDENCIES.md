# Agent A and Agent B Integration Dependencies

## Purpose

Track only approved, evidence-backed contracts consumed by the commuter application. Canonical definitions remain in merged `valryde-api` source, OpenAPI output, and Tech Lead decisions.

## Agent A — Core platform

Bootstrap inspection found Agent A IDs 1–11 reported as `READY_FOR_REVIEW`, not accepted. Relevant reported consumer areas include authentication/session/profile, COMMUTER RBAC, public transit route search/list/detail, route directions, and public-safe domain data.

Agent A's status reports that the transit list accepts `q`, `page`, and `pageSize` and returns a `pagination` envelope. It also reports route detail support. These details must be checked against the merged canonical OpenAPI and source before client implementation; this document does not freeze endpoint paths or DTO shapes.

## Agent B — Tracking and realtime

Agent B owns sanitized latest-state snapshots, public availability, compliance, Pusher authorization/events, and REST reconciliation. At bootstrap, no approved public commuter snapshot DTO, event name, channel scope, or reconciliation endpoint was available.

The inspected tracking-bridge contract is explicitly marked `PROPOSED` and states that it introduces no public DTO, Pusher contract, or client authorization endpoint. Agent C must not build against its internal table or provider identifiers.

## Locked consumer behavior

- Consume only public-safe fields; never expose driver/operator identity or private provider identifiers.
- Treat server eligibility as authoritative: active, tracker online, valid fix age no greater than 30 seconds, selected active route direction, and `ON_ROUTE`.
- Subscribe only to the currently viewed approved scope and reconcile from REST after reconnect, resume, or network recovery.
- Use the backend place-search adapter and direct-route discovery contract; never hard-code Photon in the client.
- Do not change endpoints, DTOs, Pusher names/scopes, availability, compliance, RBAC, or geospatial semantics without Tech Lead approval.

## Required before implementation

1. Confirm Agent A and Agent B work is merged into canonical `main` and has a Tech Lead decision.
2. Capture the merged OpenAPI operations and exact DTO/error/envelope definitions needed for the selected checklist slice.
3. Capture approved Pusher channel authorization, event schemas, ordering/revision rules, and REST snapshot/reconciliation semantics.
4. Record contract version or merge SHA and test fixtures in this directory.
5. Block the affected feature if a required contract remains absent; do not create a client-only substitute.
