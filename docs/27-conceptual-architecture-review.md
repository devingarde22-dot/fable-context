# Fable — Conceptual Architecture Review

**Review date:** 2026-10-28  
**Scope:** repository/docs/source inspection through GitHub; no local build or test command was executed during this review.  
**Status:** initial architecture review, not a code-change approval and not a claim of production readiness.

This document separates verified repository facts from architectural risks and recommendations. It does not change confirmed gameplay rules. The active code source is `devingarde22-dot/fable-rpg`; this context repository is a synchronized planning aid.

## 1. Executive assessment

The current `packages/rules` headless engine is the right foundation to preserve: it already has a deterministic tick scheduler, command validation, ordered resolution, a domain-event journal, replay/state hashing, in-memory checkpoints and a campaign wrapper. The next conceptual task is **not** to replace it or immediately add a database/network stack. It is to define and test the adapter boundary that will make this engine safely usable by an authenticated multiplayer server.

The most important current distinction is between:
- **headless rules engine** — the current source of authoritative simulation behavior;
- **`dev/server/CampaignRoom.ts`** — a separate demo room scaffold with its own state mutation and spawn logic;
- **contracts and schemas** — intended external protocol shapes;
- **persistence schema** — a draft data model, not evidence that durable persistence is implemented.

These pieces should not be treated as one integrated production system yet.

## 2. Verified findings

### F-01 — Project status documents contradict the current main branch
**Severity: P1 — fix documentation before delegating more work.**

The current `fable-rpg/main` tree is at merge commit `b619c77c483c69b253430352c39edc5addb42f14`; PR #8 (Increment 10 / DR-C-010) is merged. However:
- `fable-rpg/README.md` still says PR #8 is awaiting review and that PR #7 is the latest merged increment.
- `fable-rpg/docs/17-development-log-and-handoff.md` still says Increment 10 is pending review and repeats older PR states.
- `fable-context/docs/26-current-state-and-architecture.md` records the merged state correctly.

**Recommendation:** make `fable-rpg/main` README and handoff agree with the actual merged PR history, then keep the context copy synchronized. Do not use the stale handoff to start Increment 10 again.

### F-02 — The demo room is not an adapter over the headless engine
**Severity: P1 — integration gate before using the room for real gameplay.**

`dev/server/CampaignRoom.ts` directly mutates its own Colyseus `CampaignState` in `handleMove` and `confirmSpawn`. It does not submit commands to `packages/rules`, does not use the engine's tick/input-window scheduler, and broadcasts its own movement/spawn messages. The engine's authoritative rules, revision checks, journal and replay therefore do not govern this demo room.

The mismatch is also visible in the wire vocabulary: the canonical command schema uses `up/down/left/right`, while the room scaffold uses `north/south/east/west`.

**Recommendation:** do not incrementally graft all game rules into `CampaignRoom`. Define a thin server adapter that validates/authenticates external envelopes, maps them to internal engine commands, advances the authoritative engine, and emits role-filtered projections/events. Keep the current room explicitly labelled as a prototype until it is replaced or adapted.

### F-03 — Room role assignment trusts client join options
**Severity: P1 — security blocker before public deployment.**

The room takes `role` from join options and records it as the session role. The join check verifies that the role is one of `tv/gm/player`, but does not establish identity, GM ownership or campaign membership. The dev README already lists authentication/membership as missing, so this is a known scaffold limitation rather than a newly discovered production exploit.

**Recommendation:** role and campaign membership must be derived from a server-verified identity/session, not accepted as client claims. Add negative tests for role escalation and cross-campaign access before exposing the room beyond a trusted local demo.

### F-04 — Colyseus state replication is not field-level visibility filtering
**Severity: P1 — security blocker before hidden content is introduced.**

`EntityState` includes `visibility`, but the whole `entities` map is part of the shared room state. A visibility label on a replicated entity is not itself a filter. The current spawn confirmation hardcodes spawned entities to public; the dev README separately lists GM-only filtering as unfinished. If hidden entities or fields are added to this shared state, the metadata does not prevent clients from receiving them.

**Recommendation:** never put GM-only state in a room schema replicated to all roles. Keep authoritative/private state server-side and send separate allowlisted TV, player-subject and GM projections. Add negative tests that inspect actual serialized payloads, reconnect snapshots, errors and logs—not only projection helper outputs.

### F-05 — Spawn confirmation does not consume a server-stored proposal
**Severity: P1 for any real spawn workflow; prototype-only today.**

`prepareSpawn` returns a proposal to the GM but does not persist a validated proposal. `confirmSpawn` accepts a request ID and entity IDs from the client, then creates hard-coded demo entities at hard-coded positions; it does not verify that the confirmation matches the earlier proposal. The code comments explicitly identify this as demo behavior.

**Recommendation:** represent a proposal as server-owned state keyed by request ID, bind it to campaign/GM/session, validate its expiry and status, and atomically transition it from proposed to confirmed/rejected. Derive entities and positions only from the stored validated proposal and content catalog.

### F-06 — Persistence is not implemented by the presence of a database schema
**Severity: P2 — design before database integration.**

The repository has a Drizzle schema draft, but the current engine's checkpoints and journal are in-memory. The schema alone does not prove transactional coordination between a committed engine batch, durable event records, checkpoint state and command idempotency.

**Recommendation:** before implementing persistence, define the commit boundary: what must be stored atomically, how a crash between state and event writes is recovered, how rules/content versions are pinned, and how a retry is recognized after reconnect. Keep this as a design gate; do not add a database just to satisfy an abstract roadmap.

### F-07 — Existing idempotency is engine-local, not yet a durable transport guarantee
**Severity: P2 — network integration gate.**

The headless engine remembers request results in memory and recognizes duplicate request IDs during that engine instance. That is useful for simulation tests, but does not by itself define identity scope, retention, restart behavior or duplicate delivery across reconnects and durable transactions.

**Recommendation:** specify request identity scope (campaign/session/actor), retention and replay semantics before transport/persistence work. Test the same request before and after a tick, timeout, reconnect, rollback and process restart.

### F-08 — Rollback can discard queued commands without reconciling their request receipts
**Severity: P1 — decide policy before server integration.**

In `SimulationEngine.ts`, `rollback()` restores the checkpoint and replaces the current input window with an empty window. The `requestResults` map is neither restored nor reconciled, and `submit()` stores the initial `queued` receipt. Final accepted/rejected outcomes are returned separately from `advanceOneTick()`; they do not update that map. Therefore a command queued after a checkpoint can be discarded by rollback while its request ID still resolves to a duplicate of the old queued receipt. A caller cannot infer from that duplicate receipt whether the command remains scheduled or was discarded.

**Recommendation:** before production integration, either reject rollback while the input window has pending commands or explicitly mark discarded requests cancelled and make that terminal state queryable. Track request lifecycle separately from the initial submission receipt. F-10 below captures the independent case where retries remain stuck at the initial queued receipt even without rollback. Add tests for retry after accepted, rejected, pending, rollback, and reconnect. This is a concrete uncovered edge case from source inspection; it has not been runtime reproduced in this review.

### F-09 — Replay inputs are not fully version-pinned at the runtime snapshot boundary
**Severity: P2 — required before durable history or long-lived campaigns.**

The current engine has explicit constants for RNG and damage formula versions, and individual card templates carry a version. However, the inspected `RuntimeState`, `RuntimeSnapshot` and `SimulationEngineConfig` types do not carry a whole ruleset/content bundle identifier. Replay logic imports current implementation constants and reducers. This means the repository has some version markers, but the full set of rules/content dependencies needed to reproduce a historical run is not yet represented as one explicit runtime/journal contract.

**Recommendation:** before storing long-lived campaigns or promising historical replay, pin an immutable ruleset/content bundle ID in the run's initial metadata and snapshots/journal header; retain versions for RNG, damage formulas, event schemas and relevant templates. Replay must either load the matching versioned implementation/content or fail with a clear incompatibility result—never silently replay old history under changed current rules. This is a design gap, not proof that current golden replay is incorrect.

### F-10 — Request deduplication never advances from the queued receipt to a terminal result
**Severity: P1 — correctness blocker for retries and reconnect UX.**

This is distinct from rollback: even when no rollback occurs, `submit()` stores the initial queued receipt in `requestResults`. `advanceOneTick()` returns final accepted/rejected outcomes in `TickResult.commandResults`, but the inspected code does not replace the map entry with those outcomes. A later retry with the same request ID therefore returns a duplicate of the original queued receipt even if the original command has already been accepted or rejected. The duplicate response cannot answer the current lifecycle state.

**Recommendation:** retain a request lifecycle record that is updated when each command resolves, including terminal status, stable rejection code, event IDs and resulting revision where applicable. Add tests for retry after accepted/rejected outcomes, plus retry while queued and after rollback cancellation. This is confirmed by source inspection; runtime behavior was not executed in this review.

### F-11 — Runtime schema guard is bypassed by dereferencing the command before validation
**Severity: P2 — defensive API correctness; relevant if malformed runtime input can reach the engine.**

At the start of `submit(command)`, the implementation reads `command.requestId` before calling `isValidCommand(command)`. Although the TypeScript signature requires `InternalCommand`, the validator explicitly checks for a missing/non-object command. A runtime caller that supplies `null` or `undefined` will throw before receiving the expected `SCHEMA_INVALID` rejection.

**Recommendation:** perform a null/object guard before reading `requestId`; then validate request ID and command shape before deduplication. Keep external adapter validation as a separate boundary. Add a runtime-level test that malformed input fails closed without mutating state. This is source-level only and has not been runtime reproduced.

### F-12 — Target-selection policies do not choose the optimal candidate
**Severity: P1 — core enemy AI correctness.**

In `packages/rules/src/intents/targeting.ts`, eligible candidates are sorted by entity ID, then `selectIntentTarget()` uses the score of `candidates[0]` as `topScore`. The resulting tie set therefore contains candidates matching the first ID-sorted entity's score, not necessarily the best score. Non-tied cases can select the wrong target for `nearest_player`, `nearest_visible_player`, `highest_threat`, and `lowest_ally_hp_percentage`.

Existing inspected tests exercise `highest_threat` with tied threat values and `lowest_ally_hp_percentage` with one eligible ally, so they do not expose this defect. See [Combat Targeting Audit](./30-combat-targeting-audit.md).

**Recommendation:** calculate the optimal score across all candidates, then use seeded RNG only among candidates tied at that optimal score. Add non-tied ranking tests for every policy and preserve deterministic candidate ordering for replay. Source-inspection finding; tests/build/runtime probes were not run.

## 3. Architecture decisions to preserve

These are recommendations aligned with the existing confirmed rules, not new gameplay canon:

1. **Keep `packages/rules` headless and UI/database/AI independent.**
2. **Use one authoritative runtime state.** UI state, DB rows, event records and role-specific projections are separate models.
3. **Keep command-level atomicity inside an ordered batch.** Do not silently change it to all-or-nothing batch semantics.
4. **Treat accepted events as committed facts.** A rejected command must not leave gameplay mutations or domain events behind.
5. **Treat visibility as a serialization boundary.** Filter before data enters a client-visible message/schema.
6. **Version replay dependencies.** Deterministic replay needs the ruleset, content, RNG algorithm and relevant formula versions—not only a seed.
7. **Keep checkpoints and append-only audit history distinct.** Restoring gameplay state must not erase technical history or rewind monotonic identifiers.
8. **Keep test fixtures distinct from production content.** A green golden scenario proves a defined slice, not broad balance or production readiness.

## 4. Recommended target boundary

```text
Authenticated transport / room
  ├─ authenticate identity and campaign membership
  ├─ derive role and actor ownership server-side
  ├─ validate external schema + request limits
  ├─ deduplicate requestId at the chosen durability boundary
  └─ map external command -> internal command
                  |
                  v
        packages/rules (authoritative)
  ├─ deterministic tick/input-window scheduler
  ├─ command validation and ordered resolution
  ├─ runtime invariants
  ├─ domain events + journal/replay
  └─ snapshots/checkpoints
                  |
                  v
       commit / persistence boundary
  ├─ durable events and state/checkpoint
  ├─ rules/content version pinning
  └─ recovery and idempotency record
                  |
                  v
       role-specific projection layer
  ├─ TV public projection
  ├─ player projection for one subject
  └─ GM projection
```

The projection layer should be a pure, testable boundary with allowlisted DTOs. Do not replicate the complete engine state and attempt to hide fields in the client.

## 5. Priority order

### P0 — Correct the project map
- Update `fable-rpg/README.md` and `docs/17-development-log-and-handoff.md` to reflect the merged Increment 10 and current PR states.
- Preserve `fable-context/docs/26-current-state-and-architecture.md` as the compact routing page, then sync status rather than duplicating another source of truth.

### P1 — Specify the engine-to-server adapter
- Define external envelope validation, identity/role binding, actor ownership, revision handling and request ID mapping. See [Server Adapter Contract Proposal](./28-server-adapter-contract-proposal.md).
- Define rollback policy for pending requests and terminal request lifecycle before integrating transport retries.
- Decide where the authoritative engine instance lives per active scene/session.
- Define the mapping from engine events to client event/projection updates.
- Do not build new game mechanics into the demo room as a shortcut.

### P1 — Define visibility and authorization acceptance tests
- TV never receives GM-only or another player's private state.
- Player receives only the projection for their assigned hero.
- Client-supplied role/actor/campaign IDs cannot grant access.
- Reconnect snapshots and errors follow the same visibility policy.

### P2 — Specify durable command/event transaction semantics
- Define event + state/checkpoint + idempotency atomicity.
- Define crash recovery, retries and duplicate handling.
- Pin ruleset/content/RNG/formula versions needed for replay; current snapshot/config types do not yet carry a whole ruleset/content bundle ID.
- Choose a storage implementation only after those contracts are clear.

### P2 — Add operational limits
- Bound command payloads, queued commands, effect chains, journal growth and replay work.
- Add structured observability that excludes hidden information.
- Set numeric limits based on measurements and threat modeling, not guesses.

## 6. What not to do yet

- Do not rewrite the headless engine because the demo room is separate.
- Do not connect PostgreSQL before defining the durable commit/recovery contract.
- Do not add production UI, AI state-changing tools or network retries before identity, idempotency and visibility are defined.
- Do not infer broad production readiness from the Increment 10 golden scenario.
- Do not make new gameplay rules to solve infrastructure problems.
- Do not treat this initial review as a line-by-line audit or claim that tests were rerun. The follow-up adapter proposal is conceptual; it does not mean its contract is accepted or implemented.

## 7. Evidence and verification status

Repository facts were checked against the current `fable-rpg/main` tree and PR metadata on 2026-10-28. Relevant paths:
- `README.md`
- `docs/17-development-log-and-handoff.md`
- `packages/rules/src/engine/SimulationEngine.ts`
- `packages/rules/src/campaign/HeadlessCampaign.ts`
- `packages/contracts/command.schema.json`
- `packages/contracts/visibility.schema.json`
- `dev/server/CampaignRoom.ts`
- `dev/README.md`
- `dev/database/schema.ts`

No local source checkout was available through this review path, so no tests, build or runtime probes were executed. The findings above are based on inspected source and documentation; the production blockers are specifically about integrating the current scaffold safely, not a claim that the headless engine itself is broken.

### F-13 — World map, city interactions and NPC dialogue lack one transition contract
**Severity: P1 for the first complete player-facing loop; not a defect in the current headless engine.**

The current headless slice defines a campaign loop from city through route/node/scene/outcome back to a city checkpoint, but the reviewed context does not yet establish a complete normative interaction contract for world-map discovery and travel, city points of interest/services, dialogue sessions, or the legal transitions between them. Without that layer, separate screens can invent inconsistent state, NPC choices can apply effects twice, client UI can imply travel without server confirmation, and hidden route/dialogue facts can leak through shared projections.

**Recommendation:** define one explicit campaign activity state machine and a transition contract covering preconditions, role permissions, revision checks, idempotency, domain events, reconnect behavior, visibility, and checkpoint boundaries. Keep world map, location map, and tactical grid as distinct concepts. Treat NPC dialogue as a server-owned session with stable choice IDs and validated effects; keep AI output advisory and require GM approval for consequential improvised changes. Specify city recovery semantics instead of assuming that entering town heals or resets all resources/timers.

The proposal is documented in `docs/31-world-map-city-dialogue-transitions.md` in `fable-context`. It is deliberately marked PROPOSAL and does not amend confirmed gameplay rules. No implementation, tests, or build were performed for this design document.

### F-14 — Campaign-level interactions need their own revision and protocol domain
**Severity: P1 before map/dialogue integration; target-design gap, not a current scene-engine bug.**

The current command/event contracts and runtime revision model are oriented around active tactical scenes. The requested world map, route selection, shared dialogue, city rest, pending GM scene approval, and campaign-level checkpoint transitions do not fit safely as ordinary tactical scene commands. Reusing `sceneRevision` for city/dialogue actions would couple campaign changes to an active scene and create ambiguity about stale requests, replay, and which aggregate changed.

**Recommendation:** keep `SimulationEngine` responsible for tactical scene rules and introduce a campaign coordinator above it. Define a separate campaign revision and versioned campaign command/event/projection contracts before adding these features. Distinguish read-only map queries from state-changing map-mode transitions; treat route selection as client-local until confirmation; treat scene requests from dialogue as pending GM approval records, not scene creation. The detailed target is in `docs/33` and `docs/36`; no current schema or source implementation was changed by this review.

### F-15 — Battle-end cleanup boundary must cover all battle-scoped runtime
**Severity: P1 before campaign lifecycle integration; owner-selected target rule, not a verified implementation defect.**

The owner has specified that stamina, tactical deck state, and temporary statuses that are active only during battle reset immediately when a battle ends. This cleanup is distinct from city recovery. Persistent campaign statuses—especially the separate `тяжело ранен` debuff—must survive unless their own confirmed rule says otherwise.

The current Increment 10 context summary documents cleanup of barrier/defense layers at scene completion, but that fact alone does not prove that the whole invariant is implemented across stamina, deck containers/timers, and every status category. This review did not execute a source-level test or runtime probe for the broader rule, so it must not be reported as a confirmed code defect or as already implemented.

**Recommendation:** model status lifecycle scope explicitly (for example, `battle_only` vs `campaign_persistent`), reset combat stamina to the existing next-battle initialization rule (baseline 3), discard tactical hand/discard/rotation placement and rebuild from canonical persistent card sources at the next battle, and remove all explicitly battle-only statuses as part of the terminal scene transition. Apply cleanup exactly once for success, retreat, defeat and GM abort; preserve existing outcome/rollback semantics; make cleanup replayable and test it separately from city HP recovery. See `docs/32`–`docs/37`. The proposal does not change the current schemas or gameplay source.

