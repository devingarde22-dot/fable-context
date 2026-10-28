# Fable — Campaign Transition Failure and Recovery Model

**Date:** 2026-10-28  
**Status:** UNCONFIRMED PROPOSAL — future reliability contract; no database, transport, or current source changes.  
**Related documents:** 28 (server adapter), 33 (campaign lifecycle), 35 (acceptance plan), 36 (campaign protocol), 38 (hero state lifecycle).

## 1. Purpose

The world loop crosses several related but distinct boundaries: campaign activity, current location, shared dialogue, GM approval, scene runtime/journal, battle-end cleanup, city HP recovery, and checkpoint. If a process crashes or a client retries between these steps, the server must recover to one coherent state—not to a duplicated reward, a second scene, half-reset combat, a stale dialogue node, or a checkpoint captured before recovery.

This proposal defines failure invariants and recoverable transition shapes. It does not claim that the current in-memory engine already offers durable process-restart recovery.

## 2. Fundamental invariants

1. **One authoritative outcome per scene.** A scene ID can have at most one committed terminal outcome.
2. **One effective mutation per request.** Reconnect and retry return the stored current/terminal result; they do not execute the intent a second time.
3. **No acknowledgement-before-commit.** “Received”, “queued” or “pending GM” is not successful completion. Report accepted only after the authoritative commit boundary is complete.
4. **No half-active scene.** A campaign cannot point to a scene that does not exist, or to an ended scene as if it were active.
5. **No half-applied scene approval.** A proposal cannot be terminally approved without one recoverable link to its created scene.
6. **Cleanup is inseparable from battle end.** Once terminal outcome is committed, battle-only stamina/deck/status cleanup must be completed or durably marked for deterministic recovery before the transition is exposed as complete.
7. **Checkpoint names match checkpoint contents.** The post-recovery city checkpoint includes the resulting persistent hero state; it cannot point at a pre-recovery snapshot while the UI says recovery completed.
8. **Rollback restores gameplay state, not history identity.** Existing confirmed semantics preserve journal/audit history and monotonic event sequencing; never reuse IDs to imitate a clean timeline.
9. **A failed transition fails closed.** Partial state changes must be rolled back transactionally or represented in an explicit recoverable stage.
10. **Visibility applies during failures too.** Error messages, logs, reconnect payloads and pending-operation status cannot reveal hidden campaign facts.

## 3. Transition operation record

Every multi-stage campaign transition should have a stable operation identity and durable lifecycle record. Conceptually include:
- operation ID and originating request ID;
- operation type and schema version;
- campaign ID, optional scene ID, proposal/checkpoint IDs;
- source campaign revision and, when applicable, scene revision;
- canonical payload hash;
- lifecycle stage: received, validated, pending, committing, committed, rejected, cancelled, or recovery_required;
- IDs of committed event groups/scene/recovery/checkpoint;
- safe public failure code and an authorized internal diagnostic reference;
- rules/content bundle version required to resume.

The operation record is not an alternate source of gameplay truth. It tells the system where a declared domain transition got to and how to resume it. Authoritative campaign and scene state plus versioned event journals remain the state sources.

## 4. Atomicity versus recoverable workflow

Prefer a database transaction when state, events, request result and aggregate revision belong to one storage boundary. A transaction should commit the state mutation, authoritative event append, request lifecycle result, aggregate revision changes and idempotency records together.

Where a transition spans separate aggregates or a scene engine that cannot participate in the same transaction, use an explicit durable workflow with deterministic, idempotent stages:
1. write an operation record with its intended target and unique identity;
2. validate all preconditions and version references;
3. commit or durably mark the current stage;
4. perform the next deterministic stage using the same operation ID;
5. on restart, inspect committed state/events and resume only missing stages;
6. mark terminal completion and only then report accepted.

Each stage needs a predicate to detect whether its effect already committed. Do not infer completion solely from a missing response, client animation or volatile in-memory flag.

## 5. Failure scenarios and required recovery

### 5.1 Battle ends, server crashes during cleanup

**Risk:** scene result is committed but stamina/deck/status runtime remains partly active or cleanup runs twice.

**Required behavior:**
- terminal outcome and cleanup form one scene-level commit wherever possible;
- otherwise persist an explicit stage such as OUTCOME_COMMITTED_CLEANUP_PENDING before exposing the scene as fully ended;
- cleanup event group has a stable operation ID and is idempotent;
- restart resumes missing cleanup before city recovery/checkpoint;
- a repeated GM outcome request returns the original outcome and does not apply cleanup against another battle.

Never “fix” the state by wiping whatever fields happen to be nonempty after restart; rebuild from journal/snapshot and explicit lifecycle policy.

### 5.2 GM approves a scene, server crashes during creation

**Risk:** proposal becomes approved but no scene is linked, or a retry creates two scenes.

**Required behavior:**
- assign the proposed scene ID deterministically or reserve it uniquely from the proposal ID;
- enforce a unique relationship between one proposal and one created scene;
- commit proposal resolution, scene identity, active campaign link, event group and request lifecycle atomically, or use recoverable stages;
- repeated approval returns the same scene/result;
- if required content version is unavailable, fail to a recoverable pending/rejected state with no partial entry.

### 5.3 Dialogue choice committed, response lost

**Risk:** client retries and increments dialogue twice or repeats effects.

**Required behavior:**
- store the request result with the choice-effect commit;
- the same request ID and same canonical payload returns its existing result;
- a new request ID using an old node/revision is rejected as stale;
- the same ID with different payload is a request-ID conflict;
- reconnect obtains the authoritative current node/session, not a client-estimated next node.

### 5.4 Travel confirmation committed, response lost

**Risk:** client sends route again and creates duplicate visit/reward/discovery effects.

**Required behavior:** location, current activity, route/visit facts, event group and request result commit once. Retry returns the original result. A distinct later travel request still validates the current source and route eligibility.

### 5.5 City recovery committed, checkpoint not committed

**Risk:** player sees full HP but rollback returns pre-recovery HP, or recovery is applied twice.

**Required behavior:**
- use one recovery operation ID;
- checkpoint is taken after HP changes and terminal result are recorded;
- if checkpoint creation fails, a recoverable workflow clearly marks the operation incomplete and resumes it;
- restored checkpoint and displayed state are derived from the same committed campaign snapshot/revision;
- no-op recovery does not emit fake HP mutation events.

### 5.6 Crash after reward eligibility but before reward application

The current slice may unlock rewards without implementing production reward inventory. Preserve this fact. In a future reward implementation, separate eligibility from actual item grant and store a unique reward-claim/aftermath ID. Exactly one effective grant per eligible outcome must be enforced. A UI badge or in-memory boolean is insufficient.

### 5.7 Disconnect while GM approval is pending

No implicit approval or rejection. Pending proposal remains visible to authorized GM after reconnect. Player/TV projections display only a safe waiting state. GM rechecks current revision and preconditions at decision time. A stale proposal cannot be approved just because its previous UI card is still visible.

### 5.8 Rollback while a request is pending

A rollback cannot silently delete a pending operation while leaving its receipt as queued. Recommended policy:
- serialize rollback against all scene/campaign mutations;
- before rollback, enumerate pending commands/approvals that would be invalidated;
- terminally cancel/conflict them with discoverable results, or reject rollback while they exist;
- retain their audit/idempotency records and never return an old queued acknowledgement as if it were current;
- retries receive terminal cancellation/conflict.

The exact policy for active battle rollback must preserve current confirmed rollback semantics and be validated against the engine implementation.

## 6. Consistency boundary for city return

Proposed observable contract:
1. terminal scene outcome and eligibility are committed;
2. battle-end cleanup and any explicit post-battle injury transition are committed;
3. existing outcome-specific rollback/return policy determines the state actually returned;
4. eligible outcome/aftermath consequences are applied once;
5. party enters the city activity;
6. conditional city HP recovery is applied to the authoritative post-policy state;
7. a checkpoint for that post-recovery state is created;
8. operation and request become terminally accepted;
9. safe projections/broadcasts are delivered.

This order is a target observable contract, not a claim about the current engine's internal event order. Existing outcome semantics are authoritative; if they constrain the order, record and test the approved resolution. Do not publish success before the chosen consistency boundary is satisfied.

## 7. Reconnect and repair protocol

On reconnect:
1. reauthenticate and verify current membership/role;
2. load authoritative campaign activity/revision and relevant scene state/revision;
3. load pending/terminal operation records visible to this role;
4. reconcile client request IDs against current server lifecycle records;
5. send current allowlisted projection plus safe request-status details;
6. resume server-owned recovery stages before accepting conflicting mutations.

A repair task must be deterministic and idempotent. It may complete an already-declared transition, but must not invent gameplay consequences or infer intent from a disconnected client. If durable data cannot be reconciled confidently, fail closed, preserve diagnostics and require an authorized recovery decision rather than mutating state heuristically.

## 8. Operational constraints

- Bound pending operations, dialogue depth, effect-chain length and serialized payload size.
- Keep error text safe and internal diagnostics separately authorized.
- Detect stale campaign/scene revisions instead of accepting out-of-order commands silently.
- Use server receive sequence/order, not wall-clock timestamps, as command authority.
- Avoid retry storms with backoff hints/rate limits; server idempotency remains required even with backoff.
- Ensure operation/event retention covers reconnect and unresolved pending work; cleanup of old idempotency records needs an explicit policy.
- Do not log the full hidden campaign snapshot in ordinary application logs.
- Monitor stuck pending approvals, recovery-required operations, repeated request conflicts and checkpoint lag.

## 9. Acceptance matrix

| ID | Failure | Expected result |
|---|---|---|
| CR-01 | Crash before any commit | No state mutation; retry can safely submit |
| CR-02 | Response lost after commit | Retry returns the original result/event IDs |
| CR-03 | Same request ID, changed payload | Conflict, no new mutation |
| CR-04 | Crash after terminal outcome | Resume cleanup/aftermath without duplicate outcome |
| CR-05 | Crash during cleanup | Battle cannot continue; recovery completes one cleanup |
| CR-06 | Duplicate scene approval | One scene ID and one effective transition |
| CR-07 | Crash after dialogue effects but before response | Existing choice result/node restored; no repeated effects |
| CR-08 | Crash after travel commit | Party location and route result stay consistent |
| CR-09 | Crash between recovery and checkpoint | Operation resumes or rolls back atomically; UI cannot claim completion prematurely |
| CR-10 | Rollback invalidates queued command | Command is cancelled/conflicted; retry does not return stale queued status |
| CR-11 | GM disconnect during pending approval | Proposal remains pending; no implicit decision |
| CR-12 | Missing rules/content bundle on replay | Explicit compatibility failure, not silent current-version substitution |
| CR-13 | Player reconnect after hidden state changes | Projection reveals only permitted information |
| CR-14 | Recovery process retries same stage | No duplicate HP mutation, reward or checkpoint side effect |
| CR-15 | Existing golden replay after persistence integration | Same supported scene semantics and deterministic state hash |

## 10. Scope boundary and implementation order

This proposal does not select a database or add source code. Implement reliability in this order:
1. make in-memory terminal cleanup/outcome transitions and request lifecycle deterministic;
2. define explicit operation IDs and cancellation/discoverability for pending/rollback cases;
3. define campaign/scene commit boundaries and replay-compatible events;
4. only then choose durable transactions/migrations and restart-recovery implementation;
5. add failure-injection tests around each boundary before deployment.

Do not begin by adding database tables and hope application code later infers transaction semantics.
