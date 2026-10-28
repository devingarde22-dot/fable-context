# Fable — Campaign Command, Event and Projection Catalog

**Date:** 2026-10-28  
**Status:** UNCONFIRMED PROPOSAL. These are candidate campaign-level contracts, not current schema variants or implemented API endpoints.  
**Companion docs:** 33 (lifecycle contract), 34 (content/graph model), 35 (acceptance and phased delivery).  
**Important:** current canonical command/event schemas remain unchanged until a versioned contract change is separately reviewed.

## 1. Why a separate campaign protocol is needed

The existing command/event envelope is designed around scene-level actions. World-map travel, dialogue choices, city recovery, GM approval and campaign activity changes are not tactical commands and should not be forced into the scene command union.

Use two logical command families:
- **Campaign commands** act on campaign location/activity, route graph, dialogue session, approvals, recovery and aftermath.
- **Scene commands** act on the active tactical scene and continue to use the existing engine/scene revision semantics.

The server adapter authenticates both, derives role and membership from trusted identity, then dispatches to the correct aggregate. Do not let a client choose the aggregate by naming an arbitrary scene/campaign ID.

## 2. Read queries versus state-changing commands

Read-only queries do not create domain events or advance revisions:
- get the caller's campaign projection;
- get world-map projection for the party and role;
- get current shared dialogue projection;
- get safe service/POI availability;
- get the status of a known request ID;
- get GM pending approvals, only for the GM.

A query must be authorized and filtered server-side. It may update ephemeral telemetry/rate-limit counters, but not gameplay state. UI selection/highlighting of a route is client-local until route confirmation; the client does not need to send a campaign mutation for every hover or click. On reconnect, map mode is restored but route highlight may reset.

State-changing commands must validate current server state and use an idempotency key. The list below is conceptual and must be mapped to the project's actual wire naming conventions before adding schemas.

## 3. Proposed campaign command catalog

| Command | Allowed caller | Preconditions | Committed behavior |
|---|---|---|---|
| Open world map | Player in current party | Current activity is CITY or an explicitly map-capable LOCATION; no blocking interaction | Set activity to WORLD_MAP and preserve return context |
| Cancel world map | Player in current party | Current activity is WORLD_MAP; travel not committed | Restore parent activity; no location change |
| Confirm travel | Party player or GM acting under campaign policy | World-map mode; route exists, is party-known and eligible; source location/revision match | Change party location and activity once; mark visit/discovery facts from declared content |
| Start dialogue | Player in current party | NPC belongs to current node/POI, conditions pass, no blocking dialogue | Create one shared dialogue session and retain parent activity |
| Choose dialogue option | Dialogue initiator, or GM takeover | Session/node/revision and choice ID match; choice conditions pass | Apply allowlisted effects atomically, advance node or complete session |
| End dialogue | Initiator at an allowed exit, or GM | Session active and exit policy permits it, or GM override authorized | Mark session terminal and restore parent activity |
| Request city rest | Player or GM according to party policy | Activity is CITY, rest POI exists, no conflicting operation | Apply conditional HP recovery and record result; no extra resource mutation |
| Approve scene entry | GM only | Matching pending proposal, current revision and preconditions still valid | Create scene exactly once, mark proposal approved, change activity |
| Reject scene entry | GM only | Matching pending proposal | Mark proposal rejected and restore parent activity; no scene effects |
| Confirm scene outcome | GM only through existing API | Existing scene outcome eligibility passes | Use existing engine outcome flow, then coordinator aftermath |
| Close pending interaction | GM only for override/cancellation | Interaction is active/pending and cancellation policy permits it | Mark terminal state and restore a valid parent context |
| Request rollback | GM only | Existing rollback policy/checkpoint is valid | Delegate to existing approved rollback behavior; reconcile pending request records |

Opening/cancelling the world map and confirming travel are separate actions. Route selection in the client is not a state-changing command. A request to “travel to node X” without a valid route ID must not be accepted.

## 4. Proposed command envelope fields

A future campaign mutation envelope should carry:
- protocol/schema version;
- globally unique request ID within the server-defined idempotency scope;
- authenticated session and actor identity references;
- campaign ID derived or verified server-side;
- command type/version and strict typed payload;
- client campaign revision for campaign state mutations;
- optional scene revision only for commands that touch an active scene;
- timestamp only for diagnostics, never as authority for game order.

The server derives verified role, party membership, actor-to-hero binding, server receive sequence, authorization decision and the effective aggregate. A client-provided role field must not grant permissions even if an older schema contains a role discriminator.

For campaign commands, do not overload the current scene revision field. The future campaign protocol should define its revision field explicitly and increment schema version if the envelope shape requires it.

## 5. Proposed request lifecycle contract

Request status should be persistent for the lifetime of any action that may be retried:

- RECEIVED — envelope arrived.
- VALIDATED — schema and authorization passed.
- PENDING — waiting for GM approval or another explicit prerequisite.
- ACCEPTED — mutation committed, with event IDs and resulting campaign revision.
- REJECTED — stable code and safe message; no mutation.
- CANCELLED — pending action terminally cancelled.
- CONFLICT — request ID reused with a different canonical payload or an incompatible concurrent operation.

Queued/pending must never be presented as committed success.

Retry behavior:
1. Same request ID and byte/canonical-equivalent payload: return current stored lifecycle result.
2. Same ID but different payload: reject with request-ID conflict.
3. Action already accepted: return stored accepted result and the original event IDs/revision.
4. Action rejected/cancelled: return the same terminal result, unless the user creates a new request ID after refreshing state.
5. Client revision stale: reject with safe current revision/projection reference; do not silently rebase the same user intention.
6. Unavailable identity/session: fail authorization and do not reveal whether the target campaign or hidden entity exists.

The request lifecycle record must advance when pending work is approved/rejected or otherwise resolves. Storing only the initial “queued” receipt is insufficient.

## 6. Proposed campaign event catalog

Names below are candidates for a future campaign event schema. Do not add them to the existing event schema without versioning and contract tests.

| Event | Purpose | Public projection considerations |
|---|---|---|
| campaign.activity_changed | Activity transition | Include only safe activity identifiers |
| party.location_changed | Confirmed arrival | Do not disclose hidden destination details before reveal |
| world.node_discovered | Party discovery fact | Project only if the discoverer/audience policy permits |
| world.route_discovered | Route knowledge changed | Hidden route IDs stay out of unauthorized projections |
| travel.confirmed | Route transition committed | Stable route and source/destination references, suitably filtered |
| dialogue.started | Shared dialogue opened | Public NPC/session identifiers only |
| dialogue.choice_committed | Choice and declared effects committed | Do not broadcast raw GM-only choice data |
| dialogue.completed | Dialogue ended normally | Public terminal status, not private branch notes |
| dialogue.aborted | Dialogue ended by cancellation/GM | Redact private cancellation rationale where required |
| gm_approval.requested | Pending proposal created | Full details for GM; safe waiting state for players |
| gm_approval.resolved | Approval terminal result | GM-only rationale; public view only needs accepted/rejected transition where safe |
| city.hp_recovery_applied | City recovery changed hero HP | Follow existing per-hero visibility; never expose another private hero detail unnecessarily |
| campaign.aftermath_completed | Outcome side effects finished | Safe summary for Player/TV; GM can inspect details |
| campaign.checkpoint_created | Post-recovery checkpoint exists | Expose safe checkpoint state only to GM/admin surfaces |

Campaign events should include event ID/version, campaign ID, sequence/group metadata, request/proposal linkage, content/rules bundle version and the relevant campaign revision. If an event belongs to an active scene, carry a well-defined scene reference; do not fake a scene ID for events that happen outside a scene.

A hidden fact should not be carried in a public event payload with a visibility flag and expected to be ignored. Either emit a safe public event alongside a separate GM-only audit record or serialize a role-specific event projection before delivery.

## 7. Atomic commit units

Each state change should have a clear commit boundary.

### Open/cancel world map
Commit current activity and parent-context reference together. Cancel creates no travel/location mutation. A client animation alone is not the commit.

### Confirm travel
Commit route eligibility result, source/destination, current activity, visit/discovery changes allowed by content, event(s), request terminal result and campaign revision together.

### Dialogue choice
Revalidate session, node, choice and condition against the current state. Validate every declared effect before applying any of them. Commit effects, next node/session status, event group, request terminal result and campaign revision together. Invalid effect number two must not leave effect number one applied.

### GM-approved scene entry
Commit proposal terminal status, creation of scene aggregate, active scene/campaign link, campaign activity transition, event(s) and request terminal result as one transaction or an explicit recoverable workflow. Duplicate approval cannot create another scene.

### City recovery
Evaluate eligible heroes from the authoritative city state. Apply HP recovery only to eligible heroes; record the recovery result; commit corresponding events and request result. No unrelated field is mutated.

### Scene end and battle-state cleanup
Use existing scene outcome rules and eligibility. As soon as the terminal battle outcome is committed, discard battle-only stamina/runtime timer state, tactical deck placement/rotation state, and all statuses explicitly scoped as battle-only. Preserve persistent campaign statuses such as `тяжело ранен`. Represent cleanup with explicit authoritative events/state-transition data that replay can reproduce; never mutate these fields silently after the terminal event. The exact scene-level event name remains a future contract decision, not a current schema addition. Cleanup must occur once for all terminal outcomes and before city recovery/checkpoint processing.

### Outcome and return
Use existing scene outcome rules. Coordinator aftermath must be idempotent. If durable storage cannot update campaign state, scene outcome reference, terminal scene cleanup, recovery and checkpoint atomically, implement a recoverable staged record with deterministic resumption; do not rely on a timer or human to guess which stage succeeded.

## 8. Safe errors

Candidate stable public error codes:
- INVALID_CAMPAIGN_ACTIVITY
- STALE_CAMPAIGN_REVISION
- ROUTE_NOT_AVAILABLE
- INTERACTION_NOT_AVAILABLE
- DIALOGUE_ALREADY_ACTIVE
- DIALOGUE_SESSION_STALE
- DIALOGUE_CHOICE_NOT_OFFERED
- APPROVAL_NOT_PENDING
- APPROVAL_STALE
- GM_AUTHORIZATION_REQUIRED
- REQUEST_ID_CONFLICT
- REQUEST_CANCELLED
- CONTENT_VERSION_UNAVAILABLE
- CAMPAIGN_TRANSITION_CONFLICT
- INVALID_CONTENT_REFERENCE

These are candidates, not entries in the current engine error union. Exact code names should follow repository conventions. Public messages may say “this option is no longer available” without disclosing whether a secret route, NPC condition or hidden flag exists. Detailed reasons belong to a specifically authorized GM diagnostic path.

## 9. Projection contract

Conceptual projection types:
- CampaignPlayerProjection: public current activity, available route/POI choices, public shared dialogue state, own hero data, safe request status.
- CampaignTVProjection: public activity, public location/route facts, public dialogue text, public scene state.
- CampaignGMProjection: full campaign state required to run the game, hidden routes/NPC branches, pending approvals, audit/rollback controls.
- CampaignAIContextProjection: strictly task-specific facts with the minimum required permission; never raw campaign snapshot by default.

All projections are generated from authoritative campaign state. Clients cannot request “include private=true” or select a projection role. A reconnect should use the same projection function as a normal subscription. Projection tests must run on the serialized output.

## 10. Versioning and schema rollout

1. Do not extend scene-only union by silently adding campaign commands/events to current schema v1.
2. Define a campaign command schema and campaign event variants explicitly, or an approved protocol version containing them.
3. Keep `campaignRevision` distinct from `sceneRevision`.
4. Pin immutable content bundle and ruleset versions for durable campaigns and replay.
5. Validate closed payloads with `additionalProperties: false` and validate all referenced IDs against loaded content.
6. Add negative tests for unknown variants/fields and old-client behavior.
7. Publish the schema change only with code, test fixtures, replay compatibility notes and migration policy in the same implementation increment.

## 11. Contract-level acceptance tests

- Every mutating command has authorization, current-activity and revision checks.
- Every mutating command has idempotent retry semantics and a terminal lifecycle record.
- Every command/event uses a closed schema and stable version.
- Every accepted command references the events it caused and resulting revision.
- Every rejected command causes no partial mutation.
- A pending approval is not treated as success until approved.
- A request-ID conflict never reuses the old result for a different payload.
- Public error payloads do not disclose hidden content.
- Campaign-level commands do not mutate tactical state directly; scene commands are delegated to the scene engine.
- A terminal scene outcome is followed immediately by deterministic, once-only cleanup of battle-only stamina, deck runtime and explicitly battle-scoped statuses, while persistent statuses remain untouched.
- Schema v1 behavior and existing golden replays are not silently changed by adding campaign contracts.
