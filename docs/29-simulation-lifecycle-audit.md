# Fable — Simulation Lifecycle Audit

**Review date:** 2026-10-28  
**Status:** source-inspection findings; no code changes to `fable-rpg`, no runtime reproduction, no build or tests executed.  
**Scope:** `packages/rules/src/engine/SimulationEngine.ts`, relevant engine types, replay and journal contracts. This is a targeted audit, not a complete gameplay/combat audit.

## Executive summary

The request deduplication map stores the initial queued receipt but is not updated when the command reaches a terminal result. This undermines retries even in the ordinary no-rollback path. Rollback can additionally discard queued commands while retaining their stale receipts.

These are source-confirmed control-flow observations, not runtime-reproduced failures.

## Findings

### SL-01 — Request lifecycle is split between the map and tick result
**Priority: P1**

In `submit()`, a validated request is added to the open input window and `requestResults` stores a `queued` receipt. In `advanceOneTick()`, final `accepted`/`rejected` results are assembled into `TickResult.commandResults`. The inspected flow does not update `requestResults` with those final results.

Retrying a request ID after its command resolved can therefore return a duplicate of the original queued receipt rather than the terminal result. A client cannot use the dedupe response to determine whether the command committed or was rejected.

**Recommended contract**
- Store a lifecycle record keyed by the server-defined request scope.
- Update lifecycle to accepted/rejected/cancelled when resolution occurs.
- Preserve rejection code, event IDs and authoritative revision where applicable.
- A duplicate delivery must not enqueue a second command or imply that a terminal request is still queued.
- If duplicates return only a marker, provide a status lookup/event that reliably reveals the original lifecycle.

**Tests to add**
1. Accepted request retried: one gameplay effect and terminal accepted status discoverable.
2. Rejected request retried: no second attempt and terminal rejection discoverable.
3. Retry before resolution points to the same queued request.
4. Reuse the same request ID with a different canonical payload returns an explicit conflict.
5. Multiple commands in one window correlate terminal results to the correct request IDs.

### SL-02 — Rollback can remove pending commands without a terminal cancellation record
**Priority: P1**

`rollback()` restores checkpoint state and replaces the active input window with an empty one. The inspected method does not reconcile `requestResults` for requests in the discarded window. A post-checkpoint command may disappear from the schedule while its request ID remains mapped to the original queued receipt.

This overlaps with finding F-08 in [Conceptual Architecture Review](./27-conceptual-architecture-review.md). The lifecycle invariant should be: **no accepted queued request may disappear without either execution or an observable terminal cancellation**.

**Recommendation**
- Cancel each discarded queued request and make cancellation queryable, or reject rollback while pending commands exist.
- Keep monotonic request/event identifiers and technical history distinct from restored gameplay state.
- Define whether requests accepted before the checkpoint remain terminal and how post-checkpoint requests are classified.

**Tests to add**
- Queue before/after checkpoint, rollback, retry both IDs, and verify outcomes.
- Verify no request remains permanently queued after being discarded.
- Replay through checkpoint and rollback and compare state hash and request-lifecycle expectations.

### SL-03 — Malformed runtime input can throw before schema rejection
**Priority: P2; relevant only if malformed runtime values can cross the internal API boundary**

The first operation in `submit(command)` reads `command.requestId` before calling `isValidCommand(command)`. The validator contains a missing/non-object guard, but it is reached only after the dereference. A JavaScript caller passing `null` or `undefined` would throw instead of returning `SCHEMA_INVALID`.

The TypeScript signature narrows normal compile-time callers to `InternalCommand`; this is a defensive API issue for runtime boundaries or untyped callers, not evidence that typed callers can pass invalid values.

**Recommendation**
- Check that input is a non-null object before reading properties.
- Validate request ID before deduplication.
- Test that malformed input produces no state/journal mutation and no uncaught exception.

## Priority implementation order

1. **P1:** update request lifecycle on command resolution and make terminal states discoverable.
2. **P1:** define rollback handling for pending requests and enforce cancellation/rejection semantics.
3. **P1:** test request-ID payload conflicts and define identity scope at the adapter boundary.
4. **P2:** make runtime validation fail closed before property access.

## Verification status and limitations

Inspected `SimulationEngine.ts` (`submit`, `advanceOneTick`, `rollback`), engine command/result types, `EventJournal.ts`, and `replay.ts`.

No local checkout, runtime reproduction, build or tests were executed. No changes were made to `fable-rpg`. This is not a complete audit of combat formulas, status ordering or every replay reducer. The recommendations are architectural and are not accepted gameplay rules.
