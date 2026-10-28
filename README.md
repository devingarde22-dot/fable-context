# Fable — Development Context Repository

This repository is the synchronized context and planning pack for Fable. It does not replace the active code repository, [`devingarde22-dot/fable-rpg`](https://github.com/devingarde22-dot/fable-rpg), whose current `main`, schemas, source, tests, and merged history establish implementation truth.

## Current project state

The audited game-code baseline is `fable-rpg/main` commit [`7770d04`](https://github.com/devingarde22-dot/fable-rpg/commit/7770d04), the PR #18 merge on 2026-10-28. It includes:

- Step C increments 1–10 and the in-memory headless vertical slice;
- the PR #9–#13 follow-ups integrated by PR #14;
- the Player/GM WebSocket vertical slice from PR #15;
- role-filtered domain-event work (PR #16), corrected target ranking (PR #17), and authoritative pause/restore/outcome lifecycle work (PR #18).

A fresh verification in the paired `fable-rpg` worktree ran `pnpm check` successfully with 189 tests in 43 files, then `pnpm build` and `git diff --check`. The source-level projection fan-out defect found after PR #16 is fixed and regression-tested in the paired maintenance branch; it is not a reason to repeat already-correct target-selection or pause-state changes.

The only open PR in `fable-rpg` is legacy stacked PR #4; its head is already an ancestor of `main`. This repository's open draft PR #5 is a planning proposal, not a replacement for `main` or an approval to implement its world/UI proposals.

## How to use this context

1. Start with [Current State & Architecture](docs/26-current-state-and-architecture.md) and [Current Backlog & Next Steps](docs/30-current-backlog-and-next-steps.md).
2. Read [the verified combat-rules inventory](docs/29-verified-combat-rules-inventory.md) for the current state of ranged availability, cards/magic, hit/miss/critical, and damage.
3. Use the relevant Product Constitution, Confirmed Rule, system contract, Decision Record, schema, source, and test for the specific task.
4. Treat the draft `game-roadmap/` under PR #5 as non-normative planning material until it is reviewed and merged.

If confirmed normative sources conflict, change only the affected behavior through an explicit Decision Record. Do not silently choose a convenient implementation, invent balance values, or turn a proposal into product scope.

## Project invariants

- The server-side simulation is authoritative; clients and AI submit intentions/proposals, not outcomes.
- Only the engine applies gameplay mutations and emits authoritative domain events.
- Deterministic behavior cannot rely on wall-clock time, uncontrolled randomness, or unstable iteration.
- Visibility is filtered before serialization; projections and event streams follow role policy.
- Contracts remain explicit and closed where specified; schema/API changes must be deliberate.
- This repository carries context and planning; gameplay code belongs in `fable-rpg`.

## Repository layout

```text
docs/                  rules, decisions, implementation guidance, current status
packages/contracts/    mirrored JSON Schema contracts
dev/                   historical/supporting examples; not active runtime
reference/gdd-site/    visual overview only; not normative
```

Historical plans and old handoffs remain useful as history, not as instructions to restart completed milestones.
