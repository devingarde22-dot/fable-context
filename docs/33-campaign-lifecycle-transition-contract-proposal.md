# Fable — Campaign Lifecycle and Transition Contract

**Date:** 2026-10-28  
**Status:** UNCONFIRMED PROPOSAL — recommended target contract; not a confirmed Rule set, ADR, schema change, or implementation approval.  
**Depends on:** `docs/26-current-state-and-architecture.md`, `docs/28-server-adapter-contract-proposal.md`, `docs/31-world-map-city-dialogue-transitions.md`, `docs/32-owner-decisions-world-interaction-loop.md`.  
**Boundary:** context/design only. Current gameplay code and canonical schemas are unchanged.

## 1. Purpose and architectural decision

Fable needs one coherent campaign-level lifecycle to connect city life, world-map travel, location interactions, shared NPC dialogue, scenes, outcomes, recovery, and checkpoints. These are not independent screens. They are stateful activities that can change the campaign and must be validated, recorded, replayed where applicable, and projected safely to each role.

**Recommendation:** introduce a campaign coordinator/orchestrator above the headless scene engine. Do not grow the tactical `SimulationEngine` into a city/map/dialogue engine.

```text
Player / TV / GM clients
          |
     transport adapter
          |
 identity + role + campaign membership
          |
    campaign command dispatcher
          |
   CampaignCoordinator
     ├─ campaign mode / location / route graph
     ├─ discovery / story flags / shared dialogue
     ├─ pending GM approvals
     ├─ city services / recovery / checkpoints
     └─ active scene lifecycle
              |
       SimulationEngine
       ├─ tactical grid and entities
       ├─ combat modes / intents / cards / statuses
       ├─ scene journal / deterministic ticks
       └─ scene result and replay state
          |
 durable campaign record + scene journal (future)
          |
 role-filtered projections: Player / TV / GM / AI
```

The coordinator may be a pure/domain package or a server service; its packaging is an implementation decision. Its responsibilities are not. `SimulationEngine` remains the authority for tactical scene rules. The coordinator is the authority for which activity is active, where the party is, what route is legal, which shared interaction is active, and what campaign-level transitions are committed.

## 2. Non-negotiable invariants

1. **One campaign, one authoritative current activity.** A campaign cannot simultaneously be in city, world-map travel selection, a dialogue, and an active tactical scene. A parent activity may be suspended while a child interaction is active, but the relationship is explicit.
2. **World map is a distinct blocking mode.** It is not a decorative overlay. Opening it changes campaign activity to `WORLD_MAP`; cancel returns to the exact previous safe context; confirming travel commits a location transition.
3. **Dialogue is party-shared and blocking.** At most one active blocking dialogue per campaign in the first slice. Every player sees the same public current node; only authorized fields differ by projection.
4. **GM is the scene-entry gate for dialogue-triggered scenes.** A dialogue may request a scene; it cannot create or enter that scene before explicit GM approval. Recommended default: all dynamic scene-entry proposals use the same approval gate.
5. **Clients request; server validates and commits.** UI navigation, client animations, client clocks, and arbitrary client-supplied effects never change authoritative campaign state.
6. **Every committed state change is attributable and idempotent.** Commands have request IDs; committed events have stable IDs/order; retries do not repeat effects.
7. **Campaign revision and scene revision are distinct.** Outside a tactical scene, use a campaign-level revision. Inside a scene, the existing scene revision governs scene commands. Do not reuse or increment a scene revision for a city dialogue choice.
8. **Projection is allowlisted by role.** A hidden route, private NPC branch, undiscovered fact, GM approval rationale, or secret scene definition must not be sent to a player and merely hidden in the UI.
9. **Checkpoint boundaries are explicit.** Rewards, recovery, and checkpoint creation have a documented order; a retry or reconnect cannot duplicate rewards or restore only half a transition.
10. **Content text and state effects are separate.** Rewriting a sentence or translating a choice must not change its stable ID or unexpectedly change gameplay effects.
11. **No phantom mechanics.** Travel costs, durations, random encounters, shops, stamina recovery in town, schedules, and dialogue voting do not exist until a separate unconfirmed proposal is approved and implemented.
12. **Keep confirmed rules intact.** `STATUS-003` continues to govern heavy injury; existing confirmed retreat/outcome behavior and Increment 10 acceptance remain authoritative for the current headless slice.

## 3. Canonical activity model

### 3.1 Proposed activity union

Treat the active activity as one discriminated value rather than several booleans:

- `CITY`: party is within a settlement and may use its currently available points of interest.
- `WORLD_MAP`: party is choosing among currently known/available route options. This is a separate blocking campaign mode.
- `LOCATION`: party is at a non-city place and may use authored interactions or request a scene.
- `DIALOGUE`: the party is in one shared NPC conversation. It stores a reference to the parent activity so completion can return to it.
- `SCENE`: a particular scene has been created and is authoritative; `SimulationEngine` owns its tactical runtime when it is grid/combat based.
- `OUTCOME`: scene/expedition result is being confirmed or aftermath work is pending.

`DIALOGUE` should be modeled as a blocking child activity with `parentActivity`, not as a free-floating modal. A dialogue opened in the city returns to that city; one opened in a location returns to that location. Do not permit a dialogue to become an orphaned state with no valid return target.

The first slice does not need separate `EXPEDITION_PREPARATION` or `RECOVERY` top-level modes. Represent a pending travel/scene approval or recovery transaction with explicit substate in the coordinator. Add separate modes only if later UX or rules require them.

### 3.2 Campaign aggregate fields (proposal)

The durable campaign aggregate should have conceptually:
- `campaignId`, schema version, immutable content/rules bundle IDs;
- `campaignRevision` (monotonic);
- `currentActivity` discriminated union;
- `partyLocationNodeId`;
- party membership and server-verified actor-to-hero bindings;
- known/discovered route/node/fact keys;
- campaign story flags and NPC relationship facts that are actually implemented;
- shared dialogue session or null;
- pending GM proposal/approval record or null (bounded and typed);
- latest committed outcome / expedition metadata;
- city checkpoint ID and checkpoint sequence;
- idempotency records for campaign-level requests;
- event/journal head and sequence metadata.

A scene aggregate is separately identified by `sceneId` and has its own `sceneRevision`, tick, engine snapshot and journal. A campaign transition references the scene aggregate but must not inline the entire mutable scene snapshot in client payloads.

### 3.3 Two independent revision domains

- `campaignRevision`: changes when campaign activity, location, discovery, dialogue state, NPC facts, service result, pending approval, recovery, or city checkpoint changes.
- `sceneRevision`: changes according to the existing scene rules for accepted scene mutations.

A request includes the revision appropriate to the requested operation. A campaign command submitted while the client is still on an older revision is rejected with a safe stale-state code. The client fetches a fresh projection before retry. The exact wire envelope may require a versioned extension; do not silently add fields to current `command.schema.json` or reinterpret `sceneRevision`.

## 4. Legal transition matrix

All transitions below are proposals. Every row must be encoded as an explicit transition handler with source validation and tests; do not allow arbitrary client-specified target modes.

| Source | Intent | Preconditions | Result |
|---|---|---|---|
| `CITY` | Open world map | Current activity is city; no active blocking child interaction | `WORLD_MAP`, retaining return context |
| `WORLD_MAP` | Cancel map | No travel transaction has committed | Restore retained context (normally same city) |
| `WORLD_MAP` | Select route | Route is party-known and currently eligible | Store selected route in the current map session; does not move the party |
| `WORLD_MAP` | Confirm route | Route remains legal; party still at expected source; current campaign revision matches | Commit route/arrival and enter destination `LOCATION` or `CITY` |
| `CITY`/`LOCATION` | Start dialogue | NPC is available here; no other blocking dialogue or conflicting transaction | Create shared `DIALOGUE` with parent context |
| `DIALOGUE` | Choose response | Session/node/choice/revision match; conditions hold | Commit declared effect once and advance to next node or completion |
| `DIALOGUE` | Request scene | Authored/GM-authored interaction permits it | Create pending scene-entry approval; do not instantiate active scene yet |
| `DIALOGUE` + pending approval | GM approves | GM authorization, proposal still pending, revision and scene preconditions valid | Atomically commit scene creation and transition to `SCENE` |
| `DIALOGUE` + pending approval | GM rejects/cancels | GM authorized; proposal pending | Clear pending proposal, return to retained parent/dialogue node; no scene-entry effects |
| `DIALOGUE` | End | Current node allows exit or GM explicitly closes | End session and return to parent activity |
| `CITY` | Rest | Inn/rest interaction exists; no conflicting activity; rest request is valid | Resolve proposed HP rule, emit result if state changed, checkpoint according to boundary |
| `SCENE` | Confirm outcome | Existing outcome eligibility and GM confirmation rules pass | `OUTCOME` and one committed result |
| `OUTCOME` | Complete aftermath | Reward/outcome not already applied; destination policy valid | Apply one-shot aftermath, then recovery/checkpoint or explicit next location |
| Any | Reconnect | Authenticated campaign membership | Return current role-filtered projection and in-flight request/session status; no implicit state transition |

### 4.1 Invalid transitions

The coordinator must reject—not guess—when:
- player opens the world map during an active scene, outcome, pending GM approval, or blocking dialogue;
- a route ID is unknown, hidden, no longer available, or belongs to a different source node;
- an actor tries to control a hero not bound to their server-verified session;
- a dialogue choice belongs to an older node/session or is not in the current offered choice list;
- a second blocking dialogue starts while one is active;
- a duplicate or stale GM approval is submitted;
- a city service is requested outside its defined location or in a conflicting mode;
- a client attempts to choose an outcome, reward, current location, recovery amount, or checkpoint ID directly.

Error responses should state a safe, actionable public reason without leaking hidden conditions. Internal audit may retain detailed reason for GM/debug roles.

## 5. World map and travel semantics

### 5.1 Distinct mode lifecycle

Opening the map creates a map interaction context with:
- previous safe activity reference;
- party source node ID at entry;
- current campaign revision;
- selected route ID or null;
- public route/node projection;
- status `open`, `travel_pending`, `committed`, or `cancelled`.

The selected route is only a proposed UI selection. It is not a commitment. Cancel returns to the previous safe context without changing party location. If the source location changes due to another authorized operation, an old map session must be invalidated and refreshed.

### 5.2 First-slice travel: instantaneous, graph-based

Default for the first playable slice:
- route travel is instantaneous once confirmed;
- no travel countdown, random encounter, currency cost, supply cost, or chance roll;
- route eligibility comes from server-owned content and campaign facts;
- source/destination and route requirements are rechecked at commit time;
- arrival selects a location context. If a scene is to begin, it passes the scene-entry policy and never exists merely because the client drew a battle screen.

This keeps the route system usable without inventing unfinished travel mechanics. Duration/risk/cost can be introduced later with explicit rules and acceptance tests.

### 5.3 Discovery is not the same as reachability

Track separate concepts:
- authored/existing node;
- known to GM;
- discovered by the party;
- revealed to a particular player or role;
- currently route-accessible;
- visited;
- completed/closed/repeatable.

A rumor may name a location without revealing a legal route. Discovery does not automatically unlock a route unless its authored effect says so. UI coordinates and visual lines are presentation only; legal connectivity is defined by route records.

## 6. City stay and HP recovery

### 6.1 Proposed HP rule

Record the owner decision as a proposal until copied into confirmed rules:
- on city entry and on an explicit inn/rest interaction, a hero without the `тяжело ранен` debuff recovers current HP to max HP;
- a hero with `тяжело ранен` is not fully healed by city recovery;
- city presence does not silently clear the debuff;
- the existing confirmed `STATUS-003` special case remains authoritative: a heavily injured player cannot act until the end of the battle and recovers to 1 HP after the battle under current rules;
- do not infer stamina recovery, other status cleansing, deck reset, timer reset, free resurrection, or recovery of other resources.

If HP is already max, the action may return success with no HP event (or a no-op receipt), but must not emit a fake HP mutation. Duplicate rest requests do not create duplicate meaningful state changes or duplicate checkpoint rewards.

### 6.2 Recovery order

Recommended successful return-to-city transaction:
1. confirm and commit outcome;
2. apply the one-time reward/campaign consequence, if eligible under existing rules;
3. enter the city activity;
4. apply conditional HP recovery;
5. create the post-recovery city checkpoint;
6. publish projections and terminal request results.

If a return comes from retreat/defeat/GM abort, preserve each current confirmed outcome/rollback policy; do not override it with a generic “return to city heals everyone” shortcut. Any interaction between that policy and the recovery rule must be explicitly tested. If rollback to the last checkpoint occurs, recovery cannot be applied to discarded future state.

### 6.3 City is safe context, not a universal reset

Only the explicitly defined HP rule is part of this proposal. City is not automatically a universal “reset everything” command. Tick-based tactical timers should not run without an active scene, but persistent/campaign time is a separate future concept. Never pause/resume scene timers by client wall-clock; if pause semantics are added, the server must own them.

## 7. Scene entry, outcomes, and aftermath

### 7.1 Scene-entry proposal

A scene request includes a stable proposal ID, authored scene/template reference, parent activity, requester, current campaign revision, and a summary suitable for GM approval. It must not include arbitrary client-authored runtime entities/positions/effects.

For a dialogue-triggered scene:
1. validate current dialogue node and declared effect;
2. create a `PENDING_GM_APPROVAL` record, scoped to this campaign and current revision;
3. keep dialogue/city/location context recoverable;
4. show a pending card to GM; players see only safe public waiting state;
5. on approval, revalidate revision, authorization, scene template version, participants, and entry conditions;
6. atomically create the scene aggregate, commit the transition event, and mark proposal consumed;
7. on rejection/cancellation, mark proposal terminal and return to a defined parent activity without applying the scene-entry effects.

A second approval of a consumed or cancelled proposal returns its stored terminal result. It cannot instantiate another scene. The implementation must define recovery if the process fails during scene creation; no client is allowed to infer success from a submitted request alone.

### 7.2 Scene outcomes

Reuse the current headless engine's existing outcome model: `success`, `retreat`, `defeat`, and `gm_abort`, including its current eligibility and GM-confirmation behavior. The world layer should route committed outcome through aftermath; it must not reinterpret those outcomes or invent new eligibility.

Store an explicit aftermath status, e.g. `not_started → applying → completed`, and apply one-shot rewards/facts idempotently. A retry after timeout reads the same outcome and aftermath record. A future durable implementation should atomically commit reward eligibility, rewards where implemented, recovery, and checkpoint metadata—or expose a documented recoverable workflow with exactly-once effective results.

## 8. Campaign persistence, revisions, and request lifecycle

The existing scene schemas are not a general campaign event contract. This proposal does not alter canonical schemas. A future implementation must define versioned campaign command/event types rather than smuggling map/dialogue changes into scene-only payloads.

### 8.1 Command envelope requirements (future version)

Campaign-level commands need, conceptually:
- `requestId`, authenticated server-derived session/actor/role/campaign membership;
- command type/version and strict payload schema;
- `clientCampaignRevision` for campaign mutations;
- `clientSceneRevision` only for active scene mutations;
- stable IDs such as `routeId`, `dialogueSessionId`, `choiceId`, `proposalId`;
- bounded payload size and rate limit.

Do not trust client-supplied role, actor-to-hero binding, campaign access, GM permission, event IDs, revisions, seeds, reward values or effects.

### 8.2 Idempotency contract

Scope the idempotency key by campaign + authenticated actor/session identity + request ID, with retention at least through reconnect and the full lifecycle of any pending action. Store lifecycle, not just the initial acknowledgement:
`received → validated → queued/pending → accepted/rejected/cancelled/conflict`.

A queued or pending result is not a terminal result. On retry:
- same request ID and same canonical payload: return current lifecycle record;
- same request ID with different payload: reject as request-ID conflict;
- already committed action: return stored terminal result and event IDs;
- cancelled/expired action: return stored cancellation result;
- stale revision: reject with a fresh projection reference, never silently rewrite the request to current state.

Pending GM approval, travel confirmation, dialogue effects and rewards must all use this common lifecycle.

### 8.3 Atomicity

For every mutation, decide the atomic state unit:
- route confirmation: party location + current activity + route/visit state + event + request result;
- dialogue choice: current dialogue node/session + campaign facts/effects + event(s) + request result;
- scene approval: proposal terminal state + scene aggregate creation + campaign activity + event(s) + request result;
- city recovery: eligible HP updates + recovery marker/result + event(s);
- aftermath: outcome marker + reward/fact application + recovery + checkpoint according to the selected boundary.

If durable persistence cannot make a multi-aggregate change atomic, define a recoverable state machine with idempotent stages and crash-recovery tests. Never leave a silent partial success such as “key granted but route state not updated.”

## 9. Visibility and role projections

Keep server state canonical; construct separate role-specific projection payloads.

- **TV/public display:** current public activity, public location and route facts, public conversation text, authorized scene/status presentation, public pending/waiting information.
- **Player phone:** party route choices, the shared dialogue's current public node and choice IDs, actor's own hero state, service results and safe rejection guidance.
- **GM tablet:** full route graph and discovery, dialogue graph/private branches, NPC hidden facts, pending proposals, scene controls, event/audit details, checkpoint and rollback tools.
- **AI context:** minimum necessary approved facts for the specific request, with secrets omitted unless explicitly and safely scoped to GM assistance.

Do not broadcast raw dialogue nodes, all future choices, private NPC motives, hidden route IDs, scene seeds, or full campaign snapshots to player/TV clients. Projection tests must inspect serialized payloads, event feeds, reconnect snapshots, error bodies, and logs—not only projection helper functions.

## 10. Failure recovery and reconnect

On disconnect, the server does not infer a player choice, accept a route, complete a dialogue, or confirm a scene. On reconnect:
1. authenticate again and restore server-verified campaign membership;
2. load current campaign activity/revision and actor mapping;
3. return the appropriate projection;
4. report pending request lifecycle records and active shared dialogue/pending GM approval where authorized;
5. let client reconcile pending animations with authoritative status.

Recommended timeout defaults for the first slice:
- travel map selection: no expiry needed as no travel transaction is committed until confirm; stale source/revision invalidates the old map session;
- shared dialogue: persist until explicit end, scene transition, GM close, or campaign shutdown; optionally use a configurable inactivity deadline later, but do not unexpectedly discard a story conversation;
- pending GM scene approval: remain pending until explicit GM action or campaign shutdown/cancellation; show an obvious unresolved request to GM. Do not use an arbitrary hidden timeout in the first slice.
- network command pending status: clients may display a spinner, but only a server terminal result means success/failure.

If GM disconnects, no GM confirmation is implicitly granted. Scene/outcome transitions wait for an authorized GM reconnect or an explicit administrative recovery policy.

## 11. Initial content defaults

For the first playable slice, choose:
- one authored city (Mirevault/Mirevalt naming must follow canonical lore);
- one public world-map route out of the city;
- one destination location;
- one story NPC with a small branching dialogue and repeat-visit behavior;
- one rumor/fact that can reveal route knowledge without directly mutating hidden topology;
- one inn/rest point for HP recovery;
- one departure point;
- one scene entry that requires GM approval;
- one existing headless scene with an existing outcome;
- one return to city and post-recovery checkpoint.

Do not add shops, currency, craft/training, equipment transactions, moving NPC schedules, travel clocks, random encounters, dialogue voting, per-player independent dialogue, AI-autonomous dialogue, or production rewards in this first slice. They require independent rule/data contracts.

## 12. Invariants and edge cases to test

- Exactly one current activity per campaign.
- No two active blocking dialogues.
- World-map cancel restores the previous location without a travel event.
- Route choice is not travel commitment.
- Stale route confirmation fails with no partial state change.
- Hidden node or route IDs cannot be used to bypass discovery.
- Scene cannot start from a dialogue without GM approval.
- Duplicate approval cannot create two scenes.
- Dialogue retries cannot repeat their effects.
- Stale dialogue choice cannot apply against a newer node.
- Recovery respects `тяжело ранен` and does not imply other resource resets.
- Rewards and checkpoint cannot duplicate on reconnect/retry.
- Player/TV never receive GM-only route, dialogue, or proposal data.
- Reconnect restores activity and pending operation state.
- Replay uses the same versioned content/rules inputs.
- Existing combat acceptance and confirmed outcomes remain unchanged.

## 13. Open questions retained explicitly

These do not block the proposed first loop but must be answered before the feature is broadened:
1. What clears `тяжело ранен` and how long does it last? Use existing confirmed rules until resolved.
2. Does city rest ever recover stamina or clear non-injury statuses? Default: no.
3. Is knowledge always party-shared or can it be character-specific? Default: map route discovery is party-shared; personal discoveries are deferred.
4. Are there any location travel costs/durations? Default first slice: none.
5. What is the long-term pause/time model for world/social activities? Default: no wall-clock gameplay timers in this scope.
6. How does durable persistence coordinate campaign aggregate, scene journal, checkpoints and request results? The current implementation is in-memory; design this before database integration.

## 14. Status and implementation boundary

This is an unconfirmed target architecture. Before implementation:
- compare against the active `fable-rpg/main` contracts and approved decisions;
- convert the selected rules into a Decision Record and stable Rule IDs;
- update campaign-level schema versions explicitly where needed;
- test the complete transition path and negative visibility cases;
- implement in bounded increments, with no changes to existing confirmed gameplay semantics unless a separate decision approves them.
