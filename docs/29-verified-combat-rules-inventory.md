# Verified combat-rules inventory

**Code evidence:** `fable-rpg/main` at `7770d04` (2026-10-28)
**Role of this mirror:** a compact context route. The source, tests, schemas, and detailed handoff in `fable-rpg` remain authoritative.

## Verified current behavior

| Topic | Current executable rule | Evidence / coverage | Status |
|---|---|---|---|
| Ranged entry | `hero.canEnterRangedMode === true` is the authoritative Step C entry gate. `allowedModes` filtering/dealing is performed after combat mode entry and is not a second gate. | DR-C-003; `SimulationEngine.applyModeCommand`; hero-mode and deck lifecycle tests. | Confirmed for Step C. |
| Range and LoS | Current player cards and enemy intents use Chebyshev distance with inclusive template bounds; LoS is checked when the template requires it. `ranged_shot` is 2–7 with required LoS. | `playCard.ts`, `targeting.ts`, content templates, card/intent tests. | Implemented. |
| Cards | `CardTemplate` currently exposes allowed modes, cost, range, LoS and four effect kinds. The fixtures are `TEST_ONLY / NON_BALANCE`. | `engine/types.ts`, card/deck tests. | Implemented bounded subset. |
| Magic/categories | There is no category/magic/item/damage-type/skill field, so no melee magic modifier can run. | `CardTemplate`, `resolvePlayCard`. | Deferred; product decision needed. |
| Hit/miss/critical | Valid current attacks resolve deterministically. There is no hit/crit RNG, stat input, event, or replay rule. | Damage pipeline, RNG registry, unit/integration/replay tests. | Deferred; product decision needed. |
| Damage | `fable.damage.v1` uses mitigation, `ceil` after mitigation, then `ceil` after multiplier; HP is clamped and emitted as `hp.changed` v2 only when changed. Enemy, retreat, and direct-card damage share it. | DR-C-004 + DR-C-006, `damage.ts`, tests. | Confirmed. |

## Reconciliations made

- The old Vertical Slice deck-based wording for ranged entry is superseded for current Step C by the existing authoritative capability rule in DR-C-003.
- The product text for magic, hit, miss, and critical results is explicitly marked deferred rather than treated as hidden current behavior.
- The Balance Sheet now defers to the two-stage `fable.damage.v1` formula; it no longer presents a conflicting one-ceiling hit multiplier calculation.
- DR-C-004 now records the direct-damage-card source introduced by DR-C-006.
- The confirmed DR-C-010 retreat behavior is repeatable node/no reward, replacing stale “closed node” wording.

## Open decisions, not implementation instructions

1. **Card taxonomy/magic:** define an explicit production content discriminator, modifier timing, status-potency interaction, and versioning.
2. **Hit/miss/critical:** define inputs, probabilities, RNG/audit, calculation order, events, replay, and partial-miss semantics.
3. **Damage float/version policy:** current JavaScript-number `fable.damage.v1` produces the documented 259/3/+20% Ally Guard edge as 251; exact rational arithmetic would be 250. A versioned decision is required before changing code or freezing a new expected test value.

Do not implement any of those rules from this inventory. Use a dedicated Decision Record and fixed-seed/replay regression tests after the owner decision.

## Related current gates

- The active Player/GM adapter is `packages/vertical-slice`; historical `dev/server/CampaignRoom.ts` is not the runtime.
- PR #16–#18 are merged in the audited main. A post-PR #16 projection fan-out flaw is fixed and regression-tested in the paired maintenance branch; it must be included before treating role-projection transport as ready.
- Campaign-global event sequencing, rollback confirmation token, and durable request receipts remain separate integration/persistence design tasks.

For the detailed audited matrix, tests, and continuation instructions, read `fable-rpg/docs/30-verified-combat-rules-inventory.md` and `fable-rpg/docs/17-development-log-and-handoff.md`.
