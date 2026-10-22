# Future Tracking Consumer Verification Foundation

**Preparation scope:** Checklists 29–35 and the available-count portion of 36

This package adds reusable local test infrastructure only. It does not add a live-tracking screen, claim an Agent B wire format, subscribe to Pusher, create a REST path, calculate availability/compliance, or expose synthetic data at runtime.

## Reusable pieces

- A deterministic clock with no real timers.
- Bounded animation sampling and position interpolation strictly between two observations already received; progress is clamped so the utility cannot predict beyond either endpoint.
- A generation token for rejecting callbacks after a request/animation is replaced or a component is destroyed.
- A local commuter presentation type and explicit allowlist copy containing only approved public-facing categories. Privacy tests prove injected Driver/Operator identity fields are dropped.
- Explicitly synthetic empty, stale, invalid, and out-of-order fixtures in a test-only local shape. The fixture shape is not a backend DTO proposal.

## Dependency gates

Actual implementation remains blocked on the Tech Lead-approved Agent B public snapshot, availability/count semantics, REST reconciliation contract, Pusher channel authorization, event payloads, ordering/removal rules, and error behavior. Freshness/compliance remain server-authoritative; the client utilities do not recreate those rules.
