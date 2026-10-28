# Fable — Hero State Lifecycles and Battle Boundary

**Date:** 2026-10-28  
**Status:** UNCONFIRMED PROPOSAL — target model for future implementation; does not amend confirmed rules or current source code.  
**Purpose:** prevent combat state, persistent character progression and post-battle consequences from being stored/reset as if they were the same thing.

## 1. Core recommendation

Model a hero as persistent campaign state plus a battle-scoped runtime. Do not treat the complete tactical runtime snapshot as the canonical character sheet, and do not recreate a hero from defaults after every battle.

A battle has an explicit lifetime. At the terminal battle transition, discard the battle-only resources, deck placement and temporary battle-scoped effects. Preserve permanent character sources and campaign consequences. Resolve special post-battle injury rules before throwing away the scene runtime.

This proposal complements the owner's battle-end cleanup rule recorded in docs 32–37. It does not prove that current code already implements the full behavior.

## 2. Three categories of hero data

### 2.1 Persistent campaign source state

This state belongs to the campaign/hero, not to one battle:
- stable hero ID, party membership and campaign association;
- base attributes, earned progression and learned skills;
- persistent equipment and other permanent card-granting sources;
- canonical set of cards supplied by permanent character sources, each with stable source identity;
- current HP and max-HP inputs/derivation, subject to the current confirmed resource rules;
- campaign-persistent conditions, including a persistent `тяжело ранен` debuff where present;
- story/quest facts and long-term character state, only when that feature is implemented.

Do not introduce unimplemented currency, crafting, inventory economy or progression mechanics solely to fill this model.

### 2.2 Battle-scoped runtime state

This state exists because one battle is active:
- battle stamina value and regeneration timer;
- tactical deck arrangement: hand, draw pile ordering, discard ordering, mode-excluded cards, defense-slot placement and card-rotation timer;
- active tactical mode and battle-local movement/contact state;
- active enemy intents, telegraphs, target choices and scene tick;
- temporary protections, barriers and other card effects whose scope is this battle;
- status layers whose explicit lifecycle scope is `battle_only`;
- battle-local event/replay identity and seed references.

It is invalid for the next battle to inherit this runtime merely because the same hero ID is reused. Battle-specific card instance IDs and status-layer IDs must also be scoped to their owning battle so old IDs cannot collide with a new battle.

### 2.3 Derived state

Compute rather than duplicate:
- max HP and other derived characteristics from their canonical source values and currently applicable persistent modifiers;
- available cards from permanent card sources plus the current battle's permitted rules;
- card availability by active mode, range, target eligibility and statuses;
- player-facing projections from canonical state and visibility rules.

If a derived value must be snapshotted for replay or compatibility, store its version/source reference and define validation. Avoid two independently mutable copies of the same logical value.

## 3. HP is persistent but injury resolution is rule-specific

HP damage acquired during a battle is a real campaign consequence unless an existing outcome/rollback rule explicitly restores an earlier checkpoint. Do not erase all HP loss merely because battle runtime is cleaned up.

At scene end:
1. commit the existing terminal outcome through the current outcome eligibility contract;
2. apply any already-confirmed post-battle HP/injury consequence, including the applicable `STATUS-003` rule that a critically injured hero returns to 1 HP after battle where that rule applies;
3. preserve a campaign-persistent `тяжело ранен` debuff and its own removal semantics;
4. then clear battle-only runtime and statuses;
5. when the campaign transition reaches the city, apply the separate conditional city HP recovery rule;
6. checkpoint only after the defined outcome/recovery sequence.

This order is a proposal for integration. The implementation must inspect the existing outcome and rollback semantics before choosing the exact event sequence; it must not create conflicting second versions of the injury rule.

**Important distinction:** the engine's `critically_injured` alive-state, HP reaching 0, and the named persistent `тяжело ранен` debuff must not be treated as interchangeable by string matching. Define explicit mappings and tests. A generic "clear every status on battle end" implementation could accidentally erase a persistent consequence or violate the existing 1-HP post-battle behavior.

## 4. Deck reset must not mean card deletion or card farming

Battle completion resets tactical card placement, not the permanent source of a card.

Recommended lifecycle:
- At battle entry, build the eligible tactical deck from the hero's canonical persistent sources and the scene's explicitly permitted temporary grants.
- While battle is active, hand/draw/discard/excluded/defense-slot movement is recorded as battle runtime.
- At terminal battle transition, destroy the battle's deck containers and combat-only grants.
- At the next battle, reconstruct the eligible deck from canonical sources and the current scene's valid grants, then apply the existing shuffle/draw/defense-slot rules.
- Never merge old discard back into permanent sources; never delete an owned card just because it was discarded or remained in hand when the scene ended.
- A battle-only temporary card grant must not become permanent merely because it was drawn or played.
- A persistent source removed through an authorized progression/equipment action must not be restored by copying a stale battle deck.

The first slice does not need mid-battle equipment editing. If later introduced, define which source version is pinned for the current battle and when changes become effective.

## 5. Status lifecycle contract

Status duration and status persistence are independent dimensions. A 15-second status is not automatically battle-only, and a persistent injury is not automatically cleared just because its visual effect uses a timer.

Every status definition should eventually specify:
- `lifecycleScope`: `battle_only` or `campaign_persistent` (further values only when a real feature requires them);
- duration/timing behavior, including whether its timer advances only during an active scene;
- stack/refresh rules;
- removal trigger(s);
- post-battle transformation, if any;
- public/GM visibility;
- whether a status affects derived stats or max HP.

Default policy:
- `battle_only` layers are removed immediately at the terminal scene boundary, regardless of remaining duration.
- `campaign_persistent` layers survive that boundary.
- Specific confirmed post-battle rules have precedence over the generic scope cleanup.
- No tactical status timer continues after its battle has ended.
- Do not infer lifecycle scope from the status key, icon, duration or current implementation shape; tag content/rules explicitly.

## 6. Stamina lifecycle

Stamina is a battle resource, not a city-rest resource in the first slice:
- battle entry uses the existing initial stamina rule (baseline 3; applicable max determined by existing sources);
- regeneration is server-tick based only during a valid active battle state;
- terminal battle transition removes the spent stamina runtime and its next-regeneration timestamp;
- next battle initializes a fresh stamina runtime under the existing battle-entry rules;
- city entry and inn/rest do not need to know how the old stamina value was spent and do not independently reset it.

An ending scene must not keep sending regeneration or timer events after the terminal result. If the engine supports a terminal tick, define the precise point within that tick at which no further stamina regeneration or deck rotation may occur.

## 7. Terminal transition algorithm (proposal)

Treat this as one authoritative, replayable terminal transition, not a set of cleanup side effects scattered across a city handler.

```text
Validate terminal outcome using existing rules
          |
          v
Commit outcome and determine outcome-specific rollback/return semantics
          |
          v
Resolve explicit post-battle consequences (including injury conversion rules)
          |
          v
Clear battle-only stamina + regeneration timer
Clear tactical deck containers + rotation state
Clear battle_only status layers
Stop scene-local intents/timers
          |
          v
Commit scene terminal state + cleanup events + terminal request result
          |
          v
Campaign aftermath / existing rollback behavior
          |
          v
If returning to city: conditional HP recovery
          |
          v
Create post-recovery city checkpoint
```

The diagram is a logical order. If current outcome/rollback mechanics require a different internal event ordering, preserve the same observable invariants and document the approved order in a Decision Record.

Cleanup must be idempotent. Reprocessing the same terminal transition cannot rebuild/deal a deck twice, clear a new battle's status, or append an unrelated duplicate cleanup group.

## 8. Event and replay requirements

- Cleanup is part of authoritative scene state transition and must be reconstructible from journal/events or a versioned snapshot plus deterministic reducer.
- Do not silently null out runtime fields after committing `campaign.outcome_confirmed` if replay would not produce the same state.
- If one cleanup event covers multiple removals, its payload must be sufficient to reproduce all removals deterministically; otherwise use a stable ordered event group.
- Stable ordering must not depend on Map/Set iteration or incidental object property order.
- Record the applicable rules/content version and event IDs as required by the versioning strategy.
- Rollback restores the target checkpoint's actual persistent/runtime state under existing semantics; it does not delete past audit history or reuse event sequences.
- A repeated result request returns the terminal result and does not re-run cleanup.

A future schema might need explicit lifecycle scope or a dedicated scene-end cleanup event, but no current canonical schema is changed by this proposal.

## 9. Acceptance cases

1. Finish a battle with 0 stamina and a pending regeneration timer; no old stamina/timer appears outside the ended battle.
2. Start the next battle; stamina initializes under the current battle-entry rule rather than from the prior battle's remainder.
3. Finish with cards in hand, draw pile, discard, excluded containers and defense slot; no permanent card is lost and no tactical order leaks into the next battle.
4. A temporary battle-only card grant disappears after battle; permanent card sources remain.
5. A battle-only status with time remaining is removed immediately.
6. A campaign-persistent status remains after scene end.
7. The `тяжело ранен` debuff is not cleared by generic cleanup or city arrival.
8. The confirmed critically-injured post-battle HP behavior still occurs where required.
9. Scene ticks, intent resolutions, stamina regeneration and card rotations stop after terminal battle transition.
10. Cleanup is applied once across success, retreat, defeat and GM abort without changing outcome eligibility.
11. Replaying the event journal reconstructs the same terminal hero state and state hash.
12. Duplicate outcome requests and reconnect do not reapply cleanup.
13. Current rollback/checkpoint behavior remains unchanged and no discarded future combat state leaks into the restored checkpoint.
14. Existing scene golden tests remain unchanged; new cleanup tests fail if any persistent card/source/condition is lost.

## 10. Scope boundary

This document is a design proposal. It does not assert that all these behaviors are currently implemented. Before code changes:
- compare current engine reducers, terminal outcome path and status/card cleanup with the invariants here;
- identify each difference as a verified bug, a missing feature or a proposed future behavior;
- add explicit lifecycle scopes and event/schema versions only through a reviewed contract change;
- retain the existing owner-defined outcome, rollback, injury and city HP behavior.
