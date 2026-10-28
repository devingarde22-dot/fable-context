# Fable — Server Adapter Contract Proposal

**Date:** 2026-10-28  
**Status:** proposed target contract; not implemented, not a gameplay rule, and not yet an accepted ADR.  
**Scope:** conceptual boundary between external transport/room code and `packages/rules`.

This proposal turns the initial architecture review into an actionable contract. It deliberately does not select a database or prescribe a production transport. It preserves the headless engine as the source of authoritative gameplay rules.

## 1. Decision summary

1. `packages/rules` remains headless and owns gameplay state transitions.
2. The transport adapter owns authentication, campaign membership, actor binding, external schema validation, request deduplication, rate/size limits and translation to internal commands.
3. The adapter must not independently implement gameplay movement, damage, status, cards, intent timing or campaign outcome rules.
4. One serialized command processor owns each live authoritative scene instance. The room must not mutate a parallel gameplay state.
5. Every client receives an allowlisted role-specific projection; the complete engine snapshot is never broadcast.
6. A request has separate lifecycle states: received, queued, resolved (accepted/rejected), or cancelled. A transport acknowledgement that says queued is not the final gameplay result.
7. Persistence must later atomically bind the durable command result to the state/journal commit. In-memory deduplication is not a restart-safe guarantee.

## 2. Responsibility boundary

### External adapter responsibilities

- Authenticate the connection from server-verifiable credentials.
- Verify campaign membership and permission for the requested action.
- Derive role and actor ownership from trusted server state. Client-supplied `role`, `actorId`, `sessionId` and `campaignId` are claims to validate, never authority.
- Validate envelope and payload size/depth before expensive processing.
- Bind request identity to an authenticated principal and campaign/scene scope.
- Deduplicate requests before enqueueing.
- Map the external command to an internal engine command.
- Serialize calls into the engine for the scene.
- Return a receipt for queued requests and a correlated terminal result when resolution occurs.
- Convert engine output to role-filtered projection messages.
- Apply rate limits, timeouts, connection lifecycle and operational telemetry without logging hidden payloads.

### Engine responsibilities

- Validate gameplay preconditions and authoritative state/revision.
- Order commands within an input window.
- Resolve gameplay phases deterministically.
- Apply gameplay state changes and produce domain events.
- Maintain invariants, journal/replay records and in-memory checkpoints.
- Return accepted/rejected command results and the authoritative resulting revision.

The engine must not depend on a WebSocket library, Colyseus room, database client, UI type, account service or AI provider.

## 3. Inbound envelope and trusted context

The existing `command.schema.json` is a useful wire contract, but the adapter must not pass client identity claims through as trusted internal authority.

Conceptual inbound envelope:

```ts
type ClientCommandEnvelope = {
  protocolVersion: "fable.protocol.v1";
  schemaVersion: 1;
  requestId: string;
  campaignId: string;
  sceneId: string;
  clientRevision: number;
  commandVersion: number;
  command: string;
  payload: unknown;
};
```

Trusted connection context, constructed by server code:

```ts
type AuthenticatedCommandContext = {
  principalId: string;
  campaignId: string;
  sceneId: string;
  role: "tv" | "gm" | "player";
  actorId: string | null; // derived from membership/assignment, not copied blindly from client
  connectionId: string;
};
```

This is conceptual TypeScript, not a requirement to create these exact files immediately. If compatibility requires retaining `sessionId`, `actorId` or `role` on the wire, the adapter must compare them with trusted context and reject mismatches. A client must never grant itself GM status or choose another player's actor.

## 4. Request identity and idempotency

### Key scope

Use a server-computed key such as:

```text
campaignId / sceneId / principalId / requestId
```

If a principal can control several actors, actor ownership is separately validated. Reuse of a request ID with a different canonical command payload must return a conflict error, not be treated as the original request.

The key should not depend solely on a client-supplied actor ID. Request ID length, payload size and retention must be bounded.

### Lifecycle

- `received`: envelope accepted for validation.
- `queued`: validated request accepted into a specific input window; not yet resolved by gameplay.
- `accepted`: engine committed the command's gameplay effect; include event IDs and resulting revision where applicable.
- `rejected`: terminal gameplay rejection with a stable error code.
- `cancelled`: a queued request was deliberately removed before resolution, e.g. by an explicit scene reset/rollback policy.
- `conflict`: same scoped request key reused with different payload.

A retry of the same request must not enqueue a second command. It should return the known lifecycle/result or a stable receipt that lets the client query/observe the existing request. A duplicate acknowledgement must not be confused with final acceptance.

### Rollback interaction

Current engine inspection shows `rollback()` restores a checkpoint and replaces the input window with an empty one, while the request-result map is not restored or reconciled. Therefore a request queued after a checkpoint can be removed from the window while its in-memory deduplication entry remains. Retrying that request can return a duplicate of the old queued receipt even though the command will not execute.

Before production adapter integration, choose and test an explicit policy:
1. **Preferred:** rollback/reset cancels every discarded queued request and makes the cancellation discoverable by request ID; or
2. rollback is forbidden while the input window contains pending commands.

Do not silently drop pending requests. Also ensure command status is updated/correlated when a queued request resolves; the current `requestResults` map stores the initial submit receipt, while final results are emitted separately in `TickResult.commandResults`.

## 5. Serialization and tick ownership

- A single authoritative processor owns one engine instance per live scene.
- All `submit`, `advanceOneTick`, `createCheckpoint`, `rollback` and `confirmOutcome` calls for that instance are serialized.
- No room message handler directly edits authoritative entity positions, HP, cards, statuses, intents or phase.
- The scheduler, not client arrival callbacks, decides when queued commands resolve.
- Preserve current command-level atomicity within the ordered input window. A rejected command must not leave partial gameplay mutation or domain events. Do not reinterpret this as all-or-nothing atomicity for the entire input-window batch.
- If a tick fails unexpectedly, the processor must fail closed and not continue from a partially mutated state. The recovery/restart mechanism is a later integration requirement; do not claim the current in-memory engine provides crash recovery.

## 6. Outbound events and projections

Treat domain events and client projections as separate contracts.

1. The engine produces canonical domain events and authoritative state.
2. A projection module selects only the fields allowed for a given role/subject.
3. Transport sends a typed, versioned projection or an explicitly allowlisted public event.
4. Clients never receive the full `RuntimeSnapshot`, journal audit records, RNG audit details, hidden intent targets, GM-only proposals or another player's private hand/resources unless the visibility rules explicitly permit them.

Required projection audiences:
- **TV/public:** scene-level public facts only.
- **Player:** public facts plus private data for the player/hero assigned by server context.
- **GM:** GM-authorized scene data, still excluding secrets outside the GM's campaign scope.
- **AI:** only a bounded, purpose-specific context packet; never implicit access to raw engine state or the full journal.

A `visibility` property on a replicated object is descriptive metadata, not access control. Filter before serialization and before placing data in a shared Colyseus schema. Reconnect snapshots must use the same projection function as live updates.

## 7. Persistence boundary (future design gate)

Do not select or wire a database solely to implement this proposal. Before durable persistence is added, specify the atomic commit unit. The expected logical unit is at least:
- authoritative state/checkpoint (or a recoverable state transition),
- canonical journal/domain events and required RNG audit,
- final command statuses/idempotency records for the resolved input window,
- rules/content/RNG/formula versions required for deterministic replay.

The durable design must answer crash cases before and after commit, duplicate retries after restart, checkpoint restoration, journal continuity and migration/version compatibility. The current runtime snapshot/config types expose RNG and damage-formula constants indirectly but do not carry a whole ruleset/content bundle ID; add immutable run metadata before promising long-lived replay. If a full atomic transaction is not practical, specify an explicit write-ahead/recovery protocol instead.

## 8. Error contract

Separate error classes:
- **Protocol errors:** malformed envelope, unsupported schema/version, payload exceeds limits.
- **Authorization errors:** unauthenticated, no campaign membership, role/actor mismatch.
- **Conflict errors:** duplicate key with different payload, stale revision, conflicting request lifecycle.
- **Gameplay rejections:** invalid mode, blocked cell, insufficient resource, invalid target.
- **Infrastructure errors:** timeout, storage unavailable, processor unhealthy.

External responses must not leak hidden state or internal stack traces. Error messages for clients should be stable and minimal; detailed diagnostics belong in access-controlled structured logs with redaction.

## 9. Acceptance tests before connecting the real room

1. A client cannot elevate role or submit commands for an unassigned actor.
2. A client cannot cross campaign or scene boundaries by changing IDs.
3. The same request submitted repeatedly creates at most one engine command.
4. Reusing the same scoped request ID with a different payload returns conflict.
5. A queued request resolves to one terminal accepted/rejected result, and retries can discover that result.
6. Rollback with pending requests either rejects the rollback or explicitly cancels those requests; no silent loss or permanently queued duplicate.
7. Concurrent transport handlers cannot interleave engine mutations.
8. Rejected commands produce no partial state changes or gameplay events.
9. TV/player/GM/AI payloads contain only allowlisted fields; test actual serialized payloads and reconnect snapshots.
10. Hidden state does not leak through logs, error messages, audit payloads or event forwarding.
11. Restart/reconnect behavior is explicitly documented; until persistence exists, the system must not promise durable exactly-once semantics.
12. A full replay of the committed journal matches the authoritative snapshot hash, including the defined rollback semantics.

## 10. Implementation order

1. Write pure adapter mapping and projection interfaces without changing gameplay rules.
2. Add authorization/context tests and schema/size validation.
3. Add per-scene serialized command processing and request lifecycle tracking.
4. Define rollback-vs-pending-command policy and cover it with tests.
5. Replace direct mutation in the demo room with adapter calls; keep demo-only spawn workflow separate until its proposal lifecycle is server-owned.
6. Add projection leak tests for live messages and reconnect.
7. Only then specify durable transaction/recovery details against the actual adapter flow.
8. Choose database/storage technology after the durable contract is accepted.

## 11. Explicit non-goals

- No database selection.
- No new gameplay rules.
- No rewrite of the headless engine.
- No production authentication provider selection.
- No implementation of a complete network stack in this document.
- No claim that tests or build passed; this is a design proposal based on inspected source.

## 12. Evidence

The proposal was informed by inspection of:
- `packages/rules/src/engine/SimulationEngine.ts` — `submit`, `advanceOneTick`, `rollback`, request-result tracking.
- `packages/rules/src/engine/types.ts` — `SubmitResult`, `FinalCommandResult`, command/result contracts.
- `packages/contracts/command.schema.json` — external command envelope.
- `packages/contracts/visibility.schema.json` — projection envelope shapes.
- `dev/server/CampaignRoom.ts` and `dev/README.md` — current demo room responsibilities and documented limitations.
- `packages/rules/tests/rollback.integration.test.ts` and `headless-campaign.integration.test.ts` — current rollback/campaign coverage.

No runtime tests were executed as part of this design pass.
