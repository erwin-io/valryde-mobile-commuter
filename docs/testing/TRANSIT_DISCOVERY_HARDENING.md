# Transit Discovery Hardening

**Scope:** Checklists 24–28

**Contract source:** The merged Agent A public route list/detail contract recorded in `docs/integration/API_CONTRACT_MATRIX.md`: `q`, `page`, and `pageSize` only, with the existing pagination envelope. No client-only filter or backend contract was added.

## Delivered behavior

- Starting a replacement route search now unsubscribes the superseded HTTP request instead of only ignoring its eventual result.
- Destroying the Routes page or its map-scoped route-selection service releases unfinished list/detail requests.
- Only one next-page request can be active at a time.
- When the active route catalogue shifts between pages, rows are merged by route ID so a duplicate boundary item is updated rather than rendered twice.
- Loading-more failures retain the already loaded routes and preserve the existing explicit Retry path.
- Route selection, official direction geometry/color validation, 400/404 invalid-or-withdrawn handling, bounded public route cache, offline labels, and Favorites navigation continue through the established services and regression suite.
- Search remains limited to the backend-supported free-text `q`. Place search, stops, schedules, fares, and unsupported filters remain absent.

## Integration evidence

Automated evidence uses deterministic Angular HTTP/service doubles and the existing replayed fixtures. On 2026-10-22, a read-only request to the approved local development convention `http://127.0.0.1:3000/api/health` was attempted; the connection was refused, so no current real-API result is claimed. Existing real/replayed evidence remains labelled under `docs/testing/evidence/checklist-24-28/` and `docs/testing/evidence/independent-ui-batch/`.
