# VALRYDE — Agent C Commuter Mobile Instructions

**Project:** Valryde — Public Jeepney Route Live Tracking & Monitoring System\
**Module owner:** Agent C — Commuter Mobile\
**Checklist ownership:** 22–37\
**Repository:** `valryde-mobile-commuter`\
**Baseline:** Version 1.0 MVP

## 1. Instruction order

Before making a meaningful change, read and follow:

1. This `AGENTS.md`.
2. The approved Version 1.0 system documentation and 71-item MVP checklist, when available.
3. `handoffs/AGENT_C_COMMUTER_MOBILE_HANDOFF.md`.
4. `docs/00_SHARED_AGENT_STATUS_REPORTING_POLICY.md`.
5. `docs/agent-status/AGENT_C_STATUS.md`.
6. Current source, package manifests, lockfiles, tests, CI, and repository history.
7. Relevant Tech Lead-approved backend contracts and handoffs in the canonical `valryde-api` repository.

If a required source is missing or a contract is not approved and merged, record the dependency instead of inventing behavior.

## 2. Ownership and write boundary

Agent C owns only checklist IDs 22–37 and the commuter application in this repository.

- Write only inside `valryde-mobile-commuter` unless the owner explicitly expands scope.
- Treat `valryde-api` and `valryde-infra` as read-only references.
- Do not implement or duplicate Agent A API, Agent B tracking, Agent D operator mobile, Agent E admin, or Agent F device-runbook responsibilities.
- Shared endpoint, DTO, schema, Pusher, geospatial, authorization, and tracking-contract changes require Tech Lead-approved change control.
- Preserve existing history and unrelated working-tree changes.

## 3. Product and technical baseline

Valryde is a commuter route-discovery and eligible-live-jeepney visibility app, not a ride-hailing or booking product.

- Target Ionic Framework, Angular, Capacitor, and TypeScript.
- Use MapLibre with configurable map styles; the approved MVP reference is OpenFreeMap.
- Use genuine Ionic mobile interaction patterns and a restrained, transit-first visual language inspired by Sakay.ph.
- Avoid decorative gradients, generic dashboard layouts, and unnecessary complexity.
- Client realtime uses approved Pusher channels with REST reconciliation. Never connect a client directly to Traccar.
- Vehicle location comes from installed GPS hardware, not the commuter phone.
- The app must consume normalized backend place search and direct-route discovery; it must not call Photon directly.
- Checklist ID 37 is destination place search and direct transit discovery. Multi-transfer planning and anonymous share links are out of MVP scope.
- Public commuter data may include route/direction, plate, physical jeepney color, live location, status, and last update. Driver and operator identity remains private.
- Availability is server-authoritative: active vehicle, online tracker, valid fix no older than 30 seconds, selected active route direction, and `ON_ROUTE` compliance.
- Animate only between received valid fixes; do not predict future vehicle positions.

Do not begin application feature implementation until the Agent C development directive is received.

## 4. Development workflow

Before implementation:

- Confirm the assigned checklist IDs and read the current status.
- Inspect the current Git branch, source, dependency lockfile, tests, CI, and outstanding changes.
- Confirm every required Agent A/Agent B contract is approved and available from merged canonical source.
- Identify loading, empty, error, retry, offline-degraded, reconnect, accessibility, privacy, and authorization cases.

During implementation:

- Work on a focused feature or fix branch from canonical `main`.
- Keep changes reviewable and within Agent C ownership.
- Pin dependencies through the repository lockfile and never commit secrets.
- Add proportionate unit, component, integration, and end-to-end tests.
- Keep REST reconciliation authoritative after reconnect, app resume, or network recovery.
- Update `docs/agent-status/AGENT_C_STATUS.md` after every meaningful outcome.

After implementation:

- Run the applicable lint, typecheck, tests, and production build.
- Record exact commands and outcomes; do not claim unperformed device or provider verification.
- Document API/realtime/privacy impact and remaining owner or operator gates.
- Open a focused PR for Tech Lead review and do not self-merge.

## 5. Required documentation homes

- Architecture and technical decisions: `docs/architecture/`
- UI/UX direction, flows, screens, and component catalog: `docs/ui-ux/`
- Agent A and Agent B consumer dependencies: `docs/integration/`
- Acceptance and verification planning: `docs/testing/`
- Persistent status: `docs/agent-status/AGENT_C_STATUS.md`
- Agent C handoff: `handoffs/AGENT_C_COMMUTER_MOBILE_HANDOFF.md`

Do not turn provisional assumptions into contracts. Link decisions to approved backend evidence and record unresolved dependencies explicitly.

## 6. Mandatory status reporting

Follow `docs/00_SHARED_AGENT_STATUS_REPORTING_POLICY.md` version 1.1 without locally rewriting it. Maintain exactly one Agent C status file at `docs/agent-status/AGENT_C_STATUS.md`, preserving its newest-first activity log. Separate implementation progress from Tech Lead decisions and never record credentials, tokens, private user data, or sensitive GPS history.

## 7. Scope guardrails

Without an approved scope-change issue, do not add ride hailing, booking, payments, formal stop registries, passenger counts, traffic-aware rerouting, turn-by-turn voice navigation, multi-transfer journey planning, anonymous tracking links, chat, ratings, AI prediction, or commercial-production claims.

**Mandatory principle:** inspect approved sources, stay within Agent C ownership, consume rather than invent shared contracts, verify actual outcomes, update the persistent status, and hand work to the Tech Lead.
