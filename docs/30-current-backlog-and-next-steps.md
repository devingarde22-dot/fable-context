# Current backlog and next steps

**Code baseline:** `fable-rpg/main` `7770d04`
**Planning status:** current routing after verification; this document does not approve new gameplay rules.

## Completed and no longer backlog

- Step C increments 1–10 are in `main`.
- PR #9–#13 follow-ups were integrated by PR #14.
- Player/GM vertical slice is in PR #15.
- Role-filtered event projection, global target-score ranking, and authoritative pause/restore/outcome lifecycle are in PR #16–#18.
- The post-PR #16 role-projection fan-out defect is addressed with focused regression coverage in the paired maintenance branch; review/merge that narrow fix before widening hidden/private transport data.

Do not reopen those tasks unless a current source/test demonstrates a regression.

## Current backlog

| ID | Priority | Work | Dependency / acceptance |
|---|---|---|---|
| DOC-01 | P0 | Merge the verified documentation synchronization and projection fan-out fix | `pnpm check`, `pnpm build`, diff/links review; Player never receives a GM projection or forbidden event fields. |
| RULE-01 | P1 | Card taxonomy and magic decision | Approved DR defines representation, modifier timing, versioning, and tests before production cards use magic/items/categories. |
| RULE-02 | P1 | Hit/miss/critical decision | Approved DR defines inputs, RNG/audit, event/replay semantics, calculation order, and fixed-seed tests. |
| RULE-03 | P1 | Damage float/version decision | Approved arithmetic contract and compatibility/migration approach; no silent `fable.damage.v1` rewrite. |
| ENG-01 | P1 before multi-scene campaigns | Campaign-global sequence allocator | Monotonic sequence across scene engines/restarts; transfer/checkpoint recovery test. |
| ENG-02 | P1 before durable rollback UX | Rollback confirmation and durable request receipts | Authorization/token policy, terminal status for discarded/pending requests, restart/retry tests. |
| NET-01 | P1 after DOC-01 and relevant RULE decisions | Narrow browser/adapter command expansion | Typed commands map to engine without duplicated rules; serialized projection/event negative tests pass. |
| DB-01 | P1 before private beta | Durable persistence/recovery | Transaction boundary for receipts, events, snapshots/checkpoints, rules/content versions, and crash/restart tests. |

## Explicitly out of scope for the immediate next PR

World map, city flow, NPC dialogue, CampaignCoordinator, production card content/balance, rewards/progression, generic UI, deployment, and full browser game work are not unlocked by documentation alone. The draft roadmap PR #5 contains proposals for those areas; they remain proposals until reviewed and explicitly scheduled.

## Recommended order

1. Review and merge the narrow documentation + projection-fan-out maintenance branch.
2. Decide RULE-01 through RULE-03 in separate small Decision Records; do not combine unrelated mechanics.
3. Define/implement the next typed adapter/UI command only after its gameplay rule is confirmed.
4. Design durable sequencing/rollback/request receipt semantics before multi-scene or persistence work.
5. Begin production content or campaign/world work only after the applicable correctness and compatibility gates are accepted.

Every implementation branch must name the relevant backlog ID, edit only the owning layer, add the matching regression level, and report commands that were actually run.
