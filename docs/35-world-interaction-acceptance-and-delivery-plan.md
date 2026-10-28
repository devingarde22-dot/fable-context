# Fable — World Interaction Acceptance Matrix and Delivery Plan

**Date:** 2026-10-28  
**Status:** UNCONFIRMED IMPLEMENTATION PROPOSAL. This document recommends a bounded scope; it does not amend confirmed rules, schemas, or source code.  
**Design sources:** docs 31–34 in this context pack.  
**Repository boundary:** this is context/design work only. Gameplay implementation remains in fable-rpg and requires its own bounded changes and verification.

## 1. Current implementation versus target

The current headless slice already covers tactical rules and a narrow campaign loop: scene simulation, deterministic intents, cards/statuses, outcomes, in-memory city checkpoint/rollback, and replay checks. It is not yet a complete player-facing world system.

The following target capabilities are not established as implemented production features:
- a separate campaign mode for the world map and a validated route-selection flow;
- data-driven city points of interest and services;
- shared server-owned NPC dialogue sessions and graph evaluation;
- GM approval records for dialogue-triggered scene entry;
- a campaign coordinator above the active scene engine;
- production Player / TV / GM projections and reconnect flows for world activities;
- durable campaign persistence and campaign-level command/event schemas.

These are design targets, not claims about current implementation.

## 2. Golden first playable loop

Use the canonical starting city ID and reuse the existing Quarantine Gates scene fixture where its current rules fit. Do not invent new canon, production cards, reward items, currency, or combat rules just to populate the route.

1. A party of 2–4 authenticated players is in the starting city, with one authorized GM.
2. The city projection shows one story NPC, one inn/rest point, and one departure point. Each has a stable content ID and availability state.
3. A player starts dialogue with the story NPC. The dialogue is shared: all party members receive the same public current node and choices.
4. One choice records a party-shared rumor or fact. A rumor may reveal a route but does not silently create routes or launch a scene.
5. The party opens the world map. The authoritative activity changes to WORLD_MAP. This is not merely a UI tab. Cancel returns to the city without moving the party.
6. The party selects and confirms a legal route. The server revalidates source location, route, discovery, authorization and campaign revision. Travel is instantaneous in this first slice.
7. The party enters a destination location. A scene entry requested by dialogue must be approved explicitly by the GM before scene creation. Recommended default: use the same approval gate for all dynamic scene-entry proposals.
8. The campaign coordinator creates or activates the scene and links the campaign activity to its scene ID. The existing SimulationEngine remains the authority for tactical rules.
9. The GM resolves the scene using the existing outcome contract. Do not add new outcomes or alter eligibility in this feature.
10. The coordinator applies aftermath once. For a return to city, preserve current outcome/rollback policy, apply conditional HP recovery to the resulting authoritative city state, then create the post-recovery checkpoint.
11. Every client sees the current server state through its role-specific projection. Reconnect restores the same activity and pending/terminal request status.

A mock screen or client-side-only state transition does not satisfy this loop.

## 3. First-slice scope

### Must include
- One CampaignCoordinator domain/orchestration boundary with one explicit current activity.
- City and a distinct, blocking World Map mode.
- One content-defined route and destination node.
- One shared server-owned dialogue session for one authored NPC graph.
- Stable choice IDs, pure condition evaluation, allowlisted effects and deterministic dialogue completion.
- A pending GM approval record for scene entry triggered by dialogue.
- One inn/rest action implementing conditional HP recovery and no implied extra resets.
- One transition into an existing scene fixture and return through the existing outcome flow.
- A post-recovery city checkpoint and idempotent aftermath.
- Role-filtered TV/player/GM read projections, stale-revision handling and reconnect.
- Unit, integration, contract, replay/idempotency and negative visibility tests.

### Explicitly defer
- Shops, currency, stock, purchasing/selling, crafting, training, equipment changes and item rewards.
- City stamina recovery; other status cleansing; deck refresh; timer reset; free resurrection.
- Random travel encounters, travel countdowns, route costs, supplies and risk calculations.
- NPC schedules, moving crowds, per-character dialogue memory and independent simultaneous dialogues.
- Voting, social minigames, AI-autonomous NPC speech, arbitrary prose-to-action parsing, and AI-applied campaign effects.
- Procedural world generation and a full illustrated map.
- New database selection before the durable transaction and recovery boundary is defined.

Deferred mechanics must not appear as active controls or as fake zero-cost/zero-duration systems that users could mistake for designed behavior.

## 4. UX contract per activity

### City
- Shows party location and available authored points of interest.
- Shows each POI as available, unavailable, pending or completed, with safe explanation where possible.
- Dialogue, rest and departure are separate typed interactions.
- The world map is entered as a campaign activity; cancel returns to the preserved city state.
- A pending GM approval is clearly visible to the GM. It does not silently start a scene.

### World map
- Shows only nodes/routes revealed by the server projection.
- Distinguishes unknown, known-but-blocked, available, selected and visited.
- Selecting a route is provisional; explicit confirmation commits travel.
- Confirm/cancel are guarded by request IDs and request lifecycle state.
- Reconnect restores map mode only if its stored source and revision are still valid.

### Dialogue
- Players share one public current node and choice set; the GM sees authorized private content.
- Only the choice initiator submits normal choices in the first slice; the GM may take over or close the session. No voting in this slice.
- Choice submission shows pending/accepted/rejected state. The client advances only from server-confirmed state.
- A requested scene shows as pending approval; players must not see it as active before GM confirmation.
- Disconnect never chooses or advances the dialogue.

### Scene and outcome
- Existing SimulationEngine remains the rules authority.
- The campaign coordinator owns the link between current campaign activity and active scene ID.
- Outcome eligibility and GM confirmation remain governed by existing rules.
- Retries, reconnect and rollback cannot duplicate outcome, aftermath, reward effects or checkpoints.
- If scene creation fails, the coordinator returns to a defined pending/parent state, not a half-dialogue/half-scene state.

### City recovery
- Computed from authoritative hero state at commit time.
- Without the heavy-injury debuff, current HP becomes max HP.
- With the heavy-injury debuff, no full heal is applied and the debuff is not implicitly cleared.
- Stamina, unrelated statuses, deck, inventory and timers do not change.
- No HP event is emitted when HP did not change.
- Checkpoint is created after the documented recovery boundary.
- The same request ID returns the stored result.

## 5. Detailed acceptance matrix

IDs below are proposed future test names, not tests already present.

### A. Campaign state and legal transitions

| ID | Scenario | Expected result |
|---|---|---|
| WLC-A01 | Open map from city | Activity becomes WORLD_MAP; city context preserved |
| WLC-A02 | Cancel without travel | Returns to same city; no travel event |
| WLC-A03 | Confirm valid route | Location changes once; campaign revision advances once |
| WLC-A04 | Select but do not confirm route | Party location stays unchanged |
| WLC-A05 | Open map during active scene | Safe rejection; scene state unchanged |
| WLC-A06 | Start second blocking interaction during dialogue | Rejection or supported read-only view; no second session |
| WLC-A07 | Confirm after source/revision changed | Stale rejection and no partial mutation |
| WLC-A08 | Guess unknown or hidden route ID | No travel; hidden existence is not disclosed |
| WLC-A09 | Confirm known but unavailable route | Safe rejection; location unchanged |
| WLC-A10 | Two users confirm conflicting travel | At most one commit; stable conflict result for the other |
| WLC-A11 | Submit unknown mode or extra payload fields | Schema failure; no mutation |
| WLC-A12 | Reconnect in each mode | Correct activity, revision, pending status and role projection |

### B. World graph and discovery

| ID | Scenario | Expected result |
|---|---|---|
| WLC-B01 | Rumor names an unknown place | Fact stored; no route is implicitly created |
| WLC-B02 | Discover route whose availability condition is false | Known route remains non-traversable |
| WLC-B03 | Guess hidden node ID | No unauthorized entry or details |
| WLC-B04 | Move a map icon in UI | No authoritative state change |
| WLC-B05 | Content references missing node/route | Content validation fails before use |
| WLC-B06 | Bundle changes during active campaign | Campaign remains pinned or explicitly migrates; no silent swap |

### C. Shared dialogue

| ID | Scenario | Expected result |
|---|---|---|
| WLC-C01 | Start valid NPC dialogue | One shared session and parent context created |
| WLC-C02 | Talk to NPC from another location | Rejected; no session |
| WLC-C03 | Second player starts another dialogue | Existing session is resumed/observed; no parallel dialogue |
| WLC-C04 | Choose offered choice | One committed choice and authoritative next node |
| WLC-C05 | Choose from an old node | Stale rejection; no effects |
| WLC-C06 | Submit unoffered/hidden choice | Rejected without revealing hidden branches |
| WLC-C07 | Retry an accepted choice | Stored result returned; no repeated side effects |
| WLC-C08 | Reuse request ID with different payload | Explicit request-ID conflict |
| WLC-C09 | Initiator disconnects | Session remains authoritative; no implied choice |
| WLC-C10 | No public choices remain | Valid terminal/fallback path; no deadlock |
| WLC-C11 | GM closes dialogue | Session ends once; parent context restored |
| WLC-C12 | Secret condition fails | Safe public result; exact secret reason remains GM-only |

### D. GM approval and scene creation

| ID | Scenario | Expected result |
|---|---|---|
| WLC-D01 | Dialogue requests a scene | Pending proposal for GM; no active scene yet |
| WLC-D02 | GM approves valid proposal | Scene created once and proposal terminal |
| WLC-D03 | GM rejects proposal | No scene or scene-entry effects; parent context restored |
| WLC-D04 | Approval submitted after revision changed | Stale approval rejected; refresh and review required |
| WLC-D05 | Duplicate approval arrives | Stored terminal result returned; no second scene |
| WLC-D06 | Player attempts approval | Authorization failure; state unchanged |
| WLC-D07 | Scene template version unavailable | Clean failure, no partial scene |
| WLC-D08 | Disconnect mid-approval | Reconnect sees authoritative pending/terminal state |
| WLC-D09 | GM edits narrative prose only | No gameplay effect inferred from prose |
| WLC-D10 | AI suggests scene/consequence | Proposal only; no mutation before approval |

### E. Recovery and checkpoint

| ID | Scenario | Expected result |
|---|---|---|
| WLC-E01 | Rest without heavy injury | HP becomes maximum |
| WLC-E02 | Rest with heavy injury | No full heal; debuff not silently cleared |
| WLC-E03 | Eligible hero already full HP | Accepted no-op; no fake HP event |
| WLC-E04 | Retry rest with same request ID | Original result returned |
| WLC-E05 | Return after success | Existing outcome once; recovery then checkpoint |
| WLC-E06 | Return after retreat | Existing retreat/rollback policy preserved; recover only restored city state |
| WLC-E07 | Return after defeat | Existing defeat eligibility and retry/reward semantics preserved |
| WLC-E08 | Return after GM abort | Existing abort semantics preserved; no implied reward |
| WLC-E09 | Failure between reward and checkpoint | Reconciliation yields one final result |
| WLC-E10 | Repeat return/recovery request | No duplicate rewards or checkpoint side effects |
| WLC-E11 | Rest tries to change stamina/status | Unsupported mutation rejected |
| WLC-E12 | Replay after recovery/checkpoint | Deterministic state and event history under supported versions |

### F. Visibility and authorization

| ID | Scenario | Expected result |
|---|---|---|
| WLC-F01 | Player requests full campaign snapshot | Only allowlisted projection serialized |
| WLC-F02 | TV subscribes during private dialogue branch | Public text/status only |
| WLC-F03 | Hidden condition causes failure | Error does not expose secret condition |
| WLC-F04 | Client claims GM role or other actor | Server-derived identity remains authoritative |
| WLC-F05 | Player reconnects after discovery update | Only authorized newly revealed facts returned |
| WLC-F06 | Logs include secret route/dialogue data | Public logs are redacted; GM audit separately authorized |
| WLC-F07 | AI context is prepared | Only minimal role-appropriate facts included |
| WLC-F08 | Old projection arrives late | Client rejects stale revision and reconciles |

### G. Replay and event integrity

| ID | Scenario | Expected result |
|---|---|---|
| WLC-G01 | Fixed seed/content/actions replay | Same supported state/hash and event order |
| WLC-G02 | Replay requires missing content version | Explicit incompatibility error, not silent current-version replay |
| WLC-G03 | Duplicate request is observed in journal | One effective mutation |
| WLC-G04 | Campaign event added without schema/version review | Contract/build gate fails |
| WLC-G05 | Checkpoint accidentally precedes recovery | Test detects incorrect snapshot boundary |
| WLC-G06 | Required request/proposal linkage absent | Contract validation fails |
| WLC-G07 | Campaign action mutates scene revision | Contract test fails |
| WLC-G08 | Existing scene golden scenario after integration | Confirmed engine behavior and replay remain unchanged |

## 6. Required test layers

1. **Pure unit tests:** transition guards, route eligibility, discovery, condition evaluator, dialogue resolver and recovery eligibility.
2. **Content validation:** invalid references, terminal paths, undeclared effects and unsupported content versions.
3. **Coordinator integration:** route commit, shared dialogue, GM approval, scene activation, aftermath, recovery and checkpoint.
4. **Schema/contract tests:** closed payloads, explicit schema versions, authorization context, request lifecycle.
5. **Replay/idempotency tests:** accepted/rejected/pending retries, duplicate approval, rollback and failure recovery.
6. **Negative visibility tests:** inspect actual serialized payloads, event feeds, reconnect snapshots, errors and logs.
7. **End-to-end tests:** 2–4 player clients, GM client and TV over the full golden loop, including disconnect/reconnect.
8. **Regression tests:** all existing fable-rpg engine tests and golden replay must remain passing.

Do not rely only on full E2E tests. Keep fixtures deterministic and stable-ID based. No route-selection or dialogue RNG is needed for the first slice.

## 7. Delivery sequence and exit gates

### Phase 0 — Freeze contract boundary
- Review docs 31–35 and promote only selected rules into a Decision Record and Rule IDs.
- Identify conflicts with confirmed rules and resolve explicitly.
- Define campaign revision semantics and future campaign command/event schema versioning.
- Do not alter canonical JSON schemas opportunistically.

**Exit:** source-of-truth, scope, statuses and transition matrix are unambiguous.

### Phase 1 — Campaign coordinator core, no UI
- Define activity union, campaign aggregate and legal transitions.
- Add a single node/route fixture and route confirm/cancel behavior.
- Define campaign-level revision, request lifecycle and server-authorized identity interfaces.
- Keep SimulationEngine unchanged except changes separately required by an approved adapter contract.

**Exit:** illegal transitions rejected; duplicate route commands deterministic.

### Phase 2 — Data-driven map and city POIs
- Add strict content schemas and validation.
- Separate route discovery, eligibility and visited state.
- Add story NPC, inn/rest and departure points.
- Add role-filtered map projections and negative visibility tests.

**Exit:** UI contains no hardcoded route legality; hidden ID guessing cannot bypass server checks.

### Phase 3 — Dialogue and GM approval
- Add versioned dialogue graph and shared session lifecycle.
- Restrict effects to allowlist; enforce request lifecycle/idempotency.
- Add pending scene-approval state and revision checks.

**Exit:** stale choices and duplicate approvals are safe; no scene exists before required GM approval; hidden branches do not leak.

### Phase 4 — City recovery and aftermath
- Use one recovery handler for city rest and the return-to-city flow.
- Preserve heavy-injury behavior and unrelated resources/statuses.
- Define outcome/reward/recovery/checkpoint order.
- Test duplicate requests, rollback and crash/failure boundaries.

**Exit:** one outcome, correct HP state, one effective aftermath and a checkpoint representing post-recovery state.

### Phase 5 — UI and reconnect
- Implement the coherent Player / TV / GM flow.
- Show pending/accepted/rejected states for route, dialogue, rest and approval.
- Restore current activity and request status on reconnect.
- Enforce role projections at the serialization boundary.

**Exit:** the full golden path works without client-authored state and survives disconnect tests.

### Phase 6 — Durable persistence
Only after transition and idempotency contracts are stable:
- select database/storage implementation;
- persist campaign aggregate, event journal, checkpoints and request lifecycle with a crash-safe consistency boundary;
- pin rules/content versions for replay;
- define migrations and recovery diagnostics;
- add operational limits and redacted observability.

**Exit:** the loop survives process restart, reconnect and supported schema/content boundaries.

Each phase should be a narrow implementation increment with a distinct diff and testable exit criterion. Do not combine all phases into one large code PR.

## 8. Proposed responsibility boundaries

These are conceptual responsibilities, not assertions that all package paths already exist:
- **packages/rules:** existing tactical scene rules; no map UI or city service logic.
- **CampaignCoordinator:** activity, route state, dialogue sessions, approvals, recovery and aftermath.
- **packages/content:** immutable definitions and strict validation.
- **packages/contracts:** future versioned campaign command/event/projection schemas, after approval.
- **Server adapter:** authentication/membership, transport validation, idempotent dispatch, engine/coordinator orchestration and per-role projections.
- **Clients:** rendering and intent requests only.
- **Persistence adapter:** durable state/event/checkpoint/request boundary; not a separate rules authority.

## 9. Coding task packet requirements

A future implementation task should name one phase, one user path, exact allowed/forbidden files, relevant confirmed rules/schemas, chosen proposal sections, test IDs and commands. The implementer should return changed files, a concise diff, exact checks and truthful results, content/rules version impact, unresolved assumptions, and replay/revision/idempotency/checkpoint/visibility review as applicable.

Do not ask an implementer to reread the full context pack by default; route them to the minimum necessary sources.

## 10. Release gate

Do not call the feature complete until the golden loop works from city to world map, location, shared dialogue, GM-approved scene, outcome, conditional recovery and post-recovery checkpoint; route cancel is read-only; route/choice/approval retries are idempotent; the heavy-injury rule is respected; Player/TV payloads contain no hidden information; reconnect restores authoritative state; replay uses pinned content/rules versions; and the existing headless engine regression suite still passes.
