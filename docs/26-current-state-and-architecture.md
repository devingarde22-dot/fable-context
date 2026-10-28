# Fable — Current State, Architecture & Next Steps

**Status date:** 2026-10-28
**Audited code baseline:** `fable-rpg/main` `7770d04` (PR #18 merge)
**Scope of this document:** current routing summary. It does not override confirmed rules, Decision Records, schemas, or the code/tests that own executable behavior.

## 1. Current milestone

Step C increments 1–10 are merged. The active implementation now consists of:

- `packages/rules`: server-authoritative deterministic headless engine with grid, scheduler, input windows, intents, modes, damage, stamina, cards, statuses, outcomes, journal, snapshots, rollback, replay, and state hash;
- `packages/content`: immutable enemy and intent catalog;
- `packages/vertical-slice`: Player/GM adapter with in-memory/WebSocket transport, auth/membership interfaces, role projections, role-filtered event projection, pause/outcome commands, and snapshot restore;
- `packages/contracts`: canonical JSON Schemas.

`dev/server/CampaignRoom.ts` is an older standalone scaffold, not the active adapter over the rules engine. Do not add product behavior to it.

The verified baseline has all PR #9–#13 follow-ups integrated by PR #14, the Player/GM vertical slice from PR #15, and the PR #16–#18 fixes. A focused maintenance branch corrects a post-PR #16 projection fan-out defect so each connected session receives only its own role projection; its WebSocket and pause-path regressions pass.

## 2. Verification provenance

The paired `fable-rpg` checkout ran:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
git diff --check
```

The check completed successfully with **189 tests in 43 files**: 6 content, 175 rules, 8 vertical-slice. This is a locally rerun result, not a copied PR claim. The focused projection regression reported 8 passing vertical-slice tests after the maintenance fix. Re-run the full quality gate after merge-candidate changes.

## 3. Source-of-truth hierarchy

1. Current `fable-rpg/main`, merged Git history, source, tests, and actual command results.
2. Confirmed gameplay rules and approved Decision Records in `fable-rpg/docs`.
3. Canonical JSON Schemas and relevant contract tests.
4. Golden fixtures and acceptance tests for observable behavior.
5. This context pack, which is a readable synchronized mirror and planning aid.
6. Historical audits, proposal documents, visual GDD, and draft roadmap PRs.

If confirmed normative sources disagree, stop only the affected implementation and write/obtain the smallest explicit decision. Do not silently use a proposal or an older rule as a substitute for current code.

## 4. Implemented versus deferred

### Implemented and currently covered

- deterministic grid movement, collision, input windows, command ordering, idempotency in the live engine, intents, target selection, fallback, replay and state hash;
- hero modes, retreat, shared `fable.damage.v1`, stamina, deck rotation, minimal test-only card play, immobilized, Ally Guard, outcome cleanup and in-memory rollback;
- Player/GM connection/auth/membership interfaces, projections, role-filtered domain events, pause/restore and WebSocket integration.

### Explicitly deferred or not implied by the headless milestone

- production card catalog, balance, card taxonomy, magic, items, skills, hit/miss/critical mechanics, rewards and progression;
- TV client/projection, browser UI, production identity, deployment, and durable persistence;
- campaign-wide map/city/dialogue/POI systems and a full CampaignCoordinator;
- campaign-global event sequencing, durable request receipts, rollback confirmation-token policy, and long-lived content/ruleset version pinning.

## 5. Current rule and integration gates

1. **Combat decisions:** [verified combat-rules inventory](./29-verified-combat-rules-inventory.md) documents the current ranged gate, card/magic gap, hit/critical/miss gap, and damage float/version decision.
2. **Transport visibility:** merge the focused projection fan-out correction before exposing more private/GM-only data or adding Player/GM UI.
3. **Persistence:** before durable saves, define atomicity for terminal command receipts, journal events, snapshots/checkpoints, outcomes/rewards, crash recovery, and rules/content bundle selection.
4. **Multi-scene campaigns:** establish one monotonic campaign-level allocator before transferring among independent engines.

## 6. Recommended next sequence

1. Review and merge the maintenance branch for documentation synchronization and role-projection fan-out correction.
2. Approve small separate DRs for card taxonomy/magic, hit/miss/critical, and damage float/version policy.
3. Add only the tested, approved command subset to the browser-facing adapter/UI.
4. Design and test durable persistence/recovery and multi-scene sequencing before campaign/world expansion.

The detailed work ordering and acceptance criteria are in [Current Backlog & Next Steps](./30-current-backlog-and-next-steps.md). The open draft roadmap PR #5 may inform later planning but is not current executable scope.

## 7. Architectural boundaries to preserve

```text
authenticated transport / UI
  → typed validation, role/membership, rate limits, request lifecycle
  → authoritative packages/rules engine
  → durable transaction boundary (future)
  → role-allowlisted projections and events
```

- The adapter does not recreate gameplay rules.
- Runtime state, journal, persistence records, and role projections are different models.
- Commands are intentions; only the engine commits domain events.
- Gameplay time uses deterministic ticks, not wall clock.
- Replay needs explicit version compatibility; do not silently replay historical content under changed rules.
- Visibility policy covers projections, events, reconnect payloads, errors, diagnostics, and logs.
