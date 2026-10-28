# Fable — Default Policy Register for the First World Interaction Slice

**Date:** 2026-10-28  
**Status:** UNCONFIRMED PROPOSAL — recommended defaults selected by architecture to avoid leaving alternatives unresolved. These are not confirmed gameplay rules.  
**Purpose:** make the design packet implementable without asking the owner to choose between every low-level alternative.  
**Precedence within proposal documents:** this register resolves exploratory alternatives in docs 31–36 where it states a default. It never overrides existing CONFIRMED rules, schemas or current source behavior. Any conflict with confirmed material must be reported and resolved explicitly.

## 1. Activity model defaults

**Chosen default:** one campaign coordinator owns one authoritative blocking activity at a time:
- CITY
- WORLD_MAP
- LOCATION
- DIALOGUE
- SCENE
- OUTCOME

Dialogue stores its parent activity and returns to that parent when it completes. World map is a distinct activity, not a presentation overlay. Preparation and recovery are sub-states/transactions, not new top-level modes in the first slice.

No second blocking dialogue, travel commit, city service mutation or scene transition may run concurrently for the same campaign. Read-only views may remain open if their data is role-authorized, but they cannot change the activity. Commands are serialized by the campaign coordinator; stale concurrent commands reject and refresh rather than silently rebase.

## 2. World-map and travel defaults

- The map can be opened from CITY and from a LOCATION that explicitly allows map access.
- Opening it commits WORLD_MAP mode and records a return context.
- Cancelling returns to the same context and location.
- The currently highlighted route is client-local UI state; it does not advance campaign revision. On reconnect, the map mode is restored but route highlight may reset.
- Only a confirmed route command changes location.
- Travel is instantaneous in the first slice; no time, cost, supplies, risk roll or random encounter.
- Route discovery is party-shared. Character-specific knowledge is deferred.
- Known, visible, available, traversable, visited and completed are separate conditions.
- Arrival enters a LOCATION activity. It does not automatically instantiate a scene. Scene creation uses a distinct server-approved transition.
- The destination graph comes from versioned content. UI coordinates and display labels never determine reachability.

## 3. Dialogue and NPC defaults

- One shared blocking dialogue session per party/campaign.
- The player who started the session is the default choice submitter. The GM may take over or close it. No vote or quorum logic in the first slice.
- All players receive the same public node/choice set; GM-only notes/branches are a separate projection.
- Each choice uses a stable choice ID and is valid only for the exact active session/node/revision.
- Dialogue choices can commit only allowlisted, content-declared effects. Text alone never mutates the campaign.
- Choice effects are validated as a complete unit and committed all-or-nothing.
- A dialogue session survives an ordinary player disconnect; reconnect restores the same session/node. Disconnect is not an implicit exit or choice.
- A new dialogue cannot start while one is active. Other players can observe/resume the shared public projection.
- Dialogue-triggered scene creation always requires explicit GM confirmation.
- For consistency and to prevent surprise encounters, the first slice should also use the GM approval gate for dynamic scene entry initiated from a location/route interaction. Existing pre-authored scene flow may only auto-enter if the approved scene contract explicitly permits it; the safe default is approval.
- Pending GM approval has no automatic expiry in the first slice. It persists until GM approves/rejects/cancels or campaign shutdown policy closes it. Reconnect must show it to the GM.

## 4. City and recovery defaults

### Battle-end cleanup (separate from city recovery)

Immediately after any terminal battle outcome is committed, run one deterministic cleanup transaction before city recovery or checkpoint work:
- discard the ended battle's stamina value and stamina-regeneration timer; the next battle initializes according to existing combat-start rules (baseline 3, max still derived from the applicable rules);
- discard battle-specific hand/draw/discard ordering, mode-excluded card placement, defense-slot state and card-rotation timer. On the next battle rebuild tactical deck state from canonical persistent sources (skills/equipment and other valid non-battle grants); no card is permanently lost merely because it was in the hand or discard at scene end;
- remove every status explicitly scoped as battle-only, regardless of remaining duration;
- preserve campaign-persistent status/consequences, especially the separate `тяжело ранен` debuff, unless its own confirmed rule explicitly says otherwise;
- stop all scene-local intents/timers. No battle-only tick continues after the scene ends.

This cleanup runs for success, retreat, defeat and GM abort, once only, as part of the terminal scene transition. It must be represented in the authoritative journal/replay path. Existing outcome eligibility and outcome-specific checkpoint/rollback behavior are unchanged. Do not classify a status as battle-only from duration alone; use an explicit lifecycle scope.

### HP
- On city arrival after an outcome/rollback has produced the authoritative city state, execute one city recovery pass.
- For each hero without the `тяжело ранен` debuff, set current HP to max HP.
- For a hero with the debuff, do not fully restore HP and do not clear the debuff automatically.
- An explicit inn/rest action invokes the same recovery function. It does not implement a second healing formula.
- Recovery is a single atomic domain operation; retries cannot duplicate its effects.
- If the hero's HP is unchanged, do not emit an HP mutation event.

### No hidden extra resets
City entry/rest does not restore stamina, refresh the deck, clear unrelated statuses, reset tactical clocks, alter inventory/equipment, resurrect an ineligible hero, or grant reward items unless a separate confirmed rule explicitly adds that effect. Battle-end cleanup above is a separate automatic transition and must not be reimplemented or delayed as a city service.

### Heavy injury
Keep the existing confirmed STATUS-003 behavior for the incapacitated/critically-injured state. Treat a persistent `тяжело ранен` debuff as distinct from the scene's zero-HP/alive-state mechanics unless the canonical model later defines them as the same field. City arrival cannot silently erase either. A future treatment/clearance mechanic needs its own rule and tests; it is deliberately not invented as a free city service in this first slice.

### Rest and checkpoints
- No passage of simulated time is attached to inn/rest in the first slice.
- Every city arrival follows the existing outcome/rollback policy, applies eligible HP recovery, then creates the new city checkpoint.
- A rest action that changes HP should create/advance the appropriate city checkpoint after the recovery commit; a no-op rest need not create a new checkpoint.
- Battle-end cleanup occurs before this city arrival sequence; an inn/rest action is not responsible for resetting the ended scene's stamina, deck or temporary statuses.
- If retreat/defeat/GM abort restores an earlier checkpoint under the existing engine's rules, recovery operates on the restored city state, not discarded expedition state.
- The campaign coordinator must not change the existing engine's outcome eligibility or reward-unlock policy.

## 5. First city scope defaults

The first city should expose exactly three functional points of interest:
1. **Story NPC:** one short authored branching dialogue, one repeat-visit behavior, one public rumor/fact.
2. **Inn/rest:** conditional HP recovery as specified above.
3. **Departure point:** opens the distinct world-map mode.

Use existing canonical city identity and existing scene fixtures where appropriate. Keep the NPC's exact name, backstory and prose in content; do not hardcode new lore facts into code. The first route leads to one destination location and then to an existing scene fixture only through a valid scene transition. Do not add currency, purchases, crafting, training, item rewards or a new battle template.

## 6. Scene and aftermath defaults

- The campaign coordinator does not replace SimulationEngine or replicate combat logic.
- Each active tactical scene has its own scene ID, scene revision, tick and journal.
- Campaign activity/location transitions use a separate campaign revision and campaign-level events.
- Scene entry has a pending/approved/rejected/cancelled lifecycle; a pending proposal is not a scene.
- Approval must revalidate GM authorization, proposal lifecycle, source activity, current revision, content version and scene-entry preconditions.
- Scene outcome still uses existing success/retreat/defeat/gm_abort semantics.
- Apply outcome/reward eligibility once, then city recovery if the outcome path returns to city, then checkpoint.
- No production reward inventory is introduced in this slice; existing reward eligibility/unlock remains exactly what the current engine supports.

## 7. Concurrency, idempotency and reconnect defaults

- One serialized command processor per campaign aggregate.
- Distinguish campaign revision from scene revision. Never increment scene revision for map/dialogue/city-only mutations.
- Idempotency key scope: campaign + server-authenticated actor/session scope + request ID, stored through reconnect and pending/terminal resolution. If a global actor identity is available, the durable scope should prefer that stable identity to transient session ID while retaining original session/actor audit metadata.
- Same request ID + same canonical payload returns current lifecycle/terminal result. Same request ID + different payload is a conflict.
- Pending and queued acknowledgements are not success. Accepted means state and its events/request result are committed.
- Reconnect queries authoritative projection and request lifecycle; it does not replay client-side pending animations as truth.
- Client clocks are not authoritative. No city/world-map timers are introduced in this scope.
- On malformed input, stale revision, authorization failure, missing content or unresolved transition, fail closed with no partial mutation.

## 8. Persistence and compatibility defaults

- Keep current in-memory implementation as-is for the current slice; do not claim durable saves.
- Before production persistence, define an atomicity/recovery boundary for campaign state, scene journal, checkpoint and request lifecycle.
- Pin content bundle and ruleset versions at campaign start; a replay must load the matching versions or fail clearly.
- Campaign command/event payloads get an explicit versioned schema family; do not silently expand scene-oriented schema v1.
- Event sequence and checkpoint sequence are monotonic. A rollback may restore gameplay state but does not erase audit history or reuse event/sequence IDs, per existing confirmed semantics.

## 9. First-slice Definition of Done

The slice is acceptable only when:
- city → shared NPC dialogue → rumor/fact → world map → route confirmation → destination → GM-approved scene → existing scene outcome → city recovery → checkpoint works end to end;
- opening/cancelling the map does not move the party;
- route selection is provisional until confirm;
- every scene request that needs approval waits for GM;
- shared dialogue has one authoritative current node;
- duplicate requests, approvals and outcomes cannot repeat effects;
- HP follows the heavy-injury rule and no other resource/status is changed implicitly;
- Player/TV projections do not contain hidden facts;
- reconnect restores the correct activity/session/pending operation;
- the existing headless engine and its golden replay behavior are unchanged;
- tests and commands are reported truthfully.

## 10. Defaults that deliberately remain unresolved

These are not reasons to block the first slice, but must remain explicit rather than guessed:
- exact treatment/clearing policy and duration for persistent `тяжело ранен`;
- whether city rest ever restores stamina or clears other statuses in a later version;
- whether any future route has time/cost/risk mechanics;
- any later dialogue voting model;
- long-term campaign/world time and NPC schedules;
- durable storage implementation and migration details.

Until separately decided, use the defaults above and do not add the deferred behavior.
