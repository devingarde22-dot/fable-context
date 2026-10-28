# Fable — Campaign Progress, Expedition Attempts and Checkpoint Semantics

**Date:** 2026-10-28  
**Status:** UNCONFIRMED PROPOSAL — target campaign progression model. Existing confirmed MAP/SAVE rules and Increment 10 outcome behavior remain authoritative.  
**Related:** docs 02 (confirmed MAP/SAVE rules), 25 (DR-C-010), 31–37 (world interaction), 38 (hero lifecycle), 39 (failure/recovery).

## 1. Problem this model prevents

World exploration becomes ambiguous when one boolean is asked to mean several things at once: a place is known, a route is visible, travel is permitted, the party has arrived, an attempt is active, the node is completed, rewards are unlocked, and a checkpoint exists. These facts have different lifecycles and different authorization/rollback semantics.

The recommendation is to keep immutable authored graph, party-shared knowledge, node visit state, expedition-attempt history, outcome/reward eligibility, and checkpoint state as separate concepts. The existing scene engine remains responsible for terminal battle outcomes; campaign progression consumes its committed outcome and applies only the already-defined campaign consequence.

This proposal does not redefine MAP-001–MAP-004 or SAVE-001–SAVE-002.

## 2. Separate authored graph from mutable campaign progress

### 2.1 Authored content
- node definitions, stable node IDs and node types;
- route definitions, source/destination IDs and eligibility conditions;
- points of interest, scene-template references and encounter sequence;
- repeat policy authored for a node;
- content/rules bundle version.

These definitions are versioned content and should not mutate because the party visited a node.

### 2.2 Party/campaign knowledge
- whether a node is known/discovered by the party;
- whether a route is known/discovered by the party;
- whether a clue/rumor/story fact is known;
- the visibility audience for private facts when such audience types exist.

Discovery is knowledge, not access. A known route may remain unavailable. A rumor may name a hidden place without revealing a traversable connection. The client cannot create knowledge by guessing IDs.

### 2.3 Current location/activity
- authoritative party location node ID;
- current campaign activity and its parent context;
- route/map interaction session;
- active scene/attempt identity, if any.

The party has one authoritative location and one blocking campaign activity. A visual map selection does not change either.

### 2.4 Node history and expedition attempts
Store historical attempts separately from the node's overall progress. An attempt has a stable attempt ID, node ID, start event, scene/transition IDs, terminal outcome, terminal event IDs and status. A retry creates a new attempt; it must not rewrite the previous attempt's history.

### 2.5 Reward state
Separate at least:
- **eligibility/unlocked** — current rules say the outcome qualifies for reward;
- **granted/claimed** — an actual reward item/resource transaction occurred, only when such a system exists;
- **consumed** — a one-time reward was claimed or used, if that mechanic exists.

In the current Increment 10 slice, success can unlock reward eligibility without granting production reward items. Never make “unlocked” mean “items were granted”.

### 2.6 Checkpoint state
A checkpoint is a recoverable snapshot/boundary of campaign state, not a synonym for node completion or a scene save. It must identify exactly which campaign/hero state and content/rules version it represents. The current checkpoint mechanism is in-memory; do not infer durable save-game support from its existence.

## 3. Node lifecycle is not one linear boolean

Proposed independent state dimensions:

- **Knowledge:** unknown → discovered.
- **Route access:** unavailable / available / blocked by current condition.
- **Visit:** never visited / currently visiting / visited.
- **Attempt:** none / in progress / terminal outcome recorded.
- **Node policy:** repeatable / closed after success / closed after a defined terminal result, as specified by current confirmed node policy.
- **Reward:** not eligible / unlocked / granted, only as far as the current reward system supports it.

Do not make these a single enum with a Cartesian explosion of values; use separate bounded fields/state records with invariants. A UI may combine them into one label, but the server must retain the distinctions.

### Key invariant examples

- Discovery alone does not imply route access.
- Route access does not mean the party has travelled.
- A party can be at a node without having completed its scenes.
- A scene can have a terminal outcome while the node remains repeatable.
- A node can be closed while its historical attempts remain queryable to GM.
- Reward eligibility does not prove a reward item was granted.
- A checkpoint can restore an earlier campaign state without deleting audit history of later attempts.

## 4. Preserve current outcome semantics

The campaign layer must consume the already-confirmed Increment 10 outcomes without redefining eligibility:

| Outcome | Existing headless behavior to preserve | Progression-layer responsibility |
|---|---|---|
| success | Requires all enemies removed; reward eligibility is unlocked, but production reward items are not granted by this increment | Record one terminal successful attempt; apply only the existing node/route progression explicitly specified by content/rules; do not synthesize items |
| retreat | Allowed under current rules; returns to the last city checkpoint, leaves the node repeatable, and blocks its reward | Record the attempt as retreat; use existing rollback policy; do not erase audit history or mark node success |
| defeat | Requires all heroes critically injured; closes the node under the current slice, allows retry, and blocks reward | Record defeat; preserve retry policy; do not convert it into success or silently clear injury |
| gm_abort | Technical scene closure; reward is blocked without a separately confirmed consequence | Record technical abort as a distinct outcome; do not assume success, failure rewards or quest completion |

This table summarizes the current context documentation; current source and the relevant accepted Decision Record remain the final implementation authority. If a source/confirmed rule conflict is found, report it instead of silently changing progression.

Do not collapse retreat, defeat and GM abort into one generic “failed” result: their replay, retry, wound and progression implications differ.

## 5. Attempt and node transitions

Recommended attempt lifecycle:
- CREATED — attempt ID reserved and the node/route entry is validated;
- ACTIVE — a route/node interaction or scene is actually active;
- OUTCOME_COMMITTED — one terminal outcome is recorded;
- AFTERMATH_PENDING — required consequence/cleanup/recovery/checkpoint work remains;
- COMPLETED — all required aftermath stages are committed;
- RESTORED_BY_ROLLBACK — the attempt's future gameplay state was discarded by an existing checkpoint rollback, while its audit history remains.

These are candidate states, not current schema fields. If the actual current engine represents attempt status differently, an adapter may map it to the same observable contract without unnecessary duplication.

A retry must get a new attempt ID and a new request ID. It may reuse the same stable content node ID. A request retry after a lost network response uses the original request ID and returns the original attempt/result rather than opening a second attempt.

No transition from defeated/retreated to success should mutate the previous outcome. A later successful attempt is a separate historical record.

## 6. Checkpoint and rollback semantics

Before any durable persistence implementation, state exactly what the current checkpoint contains. At minimum, a city checkpoint should correspond to the canonical campaign state after the relevant return/recovery boundary—not just a tactical engine snapshot that happens to be easy to serialize.

Recommended invariants:
- checkpoint ID is stable and unique;
- checkpoint records campaign and hero state snapshot/schema version plus rules/content bundle IDs;
- checkpoint identifies the event/journal sequence/revision represented;
- checkpoint creation is part of the return/aftermath operation's commit boundary;
- rollback restores gameplay state according to the selected checkpoint while leaving audit/journal identity and sequence monotonic per current confirmed rules;
- rollback invalidates or terminally cancels operations based on discarded future state;
- retry after rollback does not return a stale queued acknowledgement for a command that was discarded;
- rewards/route unlocks/facts are restored or removed consistently with the selected snapshot; do not retain only some later side effects.

A checkpoint is not necessarily a save slot. A long-lived campaign save needs durable storage, migrations, content/rules pinning, and tested process-restart restoration.

## 7. Progression effects and idempotency

Each campaign progression effect should have:
- a stable effect or operation ID;
- cause linkage (request, scene outcome or authored content effect);
- target fact/node/route/reward ID;
- source/target campaign revision;
- rules/content version and effect schema version.

The same committed cause cannot grant the same effect twice. Validate a set of effects before applying any: if effect 2 fails, effect 1 must not remain half-applied. If a new attempt later satisfies a condition, the server may apply effects permitted by the node/reward policy under a new causative event—not by replaying a stale request.

For future rewards, use a unique claim/effect key scoped to the campaign and reward definition. Current reward unlocking is not permission to add a currency or item inventory system.

## 8. Revisit policy

The first playable slice should have an explicit content policy for each node, not a global assumption that every place is repeatable:
- city: repeatable;
- first route: legal only when known and currently eligible;
- destination location: repeatable only if its authored policy/current confirmed rules allow the retry;
- Quarantine Gates scene/node: preserve the already-confirmed outcome-specific retry policy from Increment 10;
- one-time authored dialogue fact: apply once if declared one-time;
- repeatable dialogue: subsequent visits resolve to an authored alternate node or repeat text, without replaying one-time effects.

The exact first-route IDs and city lore should come from canonical content; this proposal does not invent new story canon.

## 9. Acceptance tests

1. Discovered route still fails if its eligibility condition is false.
2. Selecting a route does not create an attempt or move the party.
3. Confirming travel creates one visit/attempt according to its declared semantics.
4. Retrying with the same request ID returns the same attempt and result.
5. A deliberate retry after a terminal outcome creates a new attempt without rewriting the previous one.
6. Success unlocks eligibility but does not manufacture reward items that do not exist.
7. Retreat follows existing rollback/repeat/reward behavior and leaves historical audit records.
8. Defeat preserves current retry and reward semantics.
9. GM abort stays distinct from gameplay failure and does not imply quest completion.
10. Node closure, route availability, discovery, visit, outcome and reward state can disagree where rules/content legitimately require it.
11. Rollback restores route/story/hero facts consistently with the selected checkpoint.
12. A pending command tied to discarded future state receives a terminal cancellation/conflict result.
13. Checkpoint schema/content/rules versions are explicit; unavailable historical versions fail visibly.
14. Existing Increment 10 golden outcome/replay tests remain unchanged.
15. A one-time dialogue effect is not re-applied by a repeated visit or network retry.
16. A future reward claim is idempotent and separate from reward eligibility.

## 10. Scope and next-step boundary

This is an unconfirmed design proposal. Before implementation, compare every progression transition against docs 02 and 25 plus current source/tests. Promote only the required rules to a Decision Record/Rule IDs, define versioned campaign schemas, and add acceptance tests. Do not build a generic quest/reward database just to support the first one-route slice.
