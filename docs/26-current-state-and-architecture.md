# Fable — Current State, Architecture & Next Steps

**Status date:** 2026-10-28  
**Status:** Increment 10 / DR-C-010 merged into `fable-rpg/main`.  
**Verified repository fact:** PR [#8](https://github.com/devingarde22-dot/fable-rpg/pull/8) is merged; merge commit: `b619c77c483c69b253430352c39edc5addb42f14`.  
**Verification provenance:** the merged PR description reports `pnpm check` PASS (159 tests: 5 content + 154 rules), `pnpm build` PASS, JSON Schema parsing, `git diff --check` and internal Markdown links PASS. These are recorded project results, not commands rerun by this context synchronization.

This document is the compact routing page for AI developers. It summarizes implementation status and architectural intent; it does not override confirmed rules, Decision Records, schemas or source code.

## 1. Current milestone

Step C — Core Engine & State Machine, Increments 1–10, is merged to `fable-rpg/main`.

Increment 10 completes the current headless vertical slice:
- campaign loop: `city → route → node → scene → outcome → city checkpoint`;
- Quarantine Gates fixture for 2–4 heroes;
- deterministic combat golden scenario and replay/state-hash parity;
- enemy intent priority chain;
- HP/damage, stamina, deck cycle, status layers and Ally Guard;
- test-only defense slot and block/barrier/status effects;
- outcome eligibility for success, retreat, defeat and GM abort;
- in-memory city checkpoint and rollback, with append-only journal and monotonic counters.

Do not restart Step A/B/C or reimplement Increment 10. Do not infer that the game is production-ready: this is a verified **headless** slice, not a shipped multiplayer game.

## 2. Source-of-truth hierarchy

Use the source that owns the question:

1. **Current implementation state:** `fable-rpg/main`, merged PRs, source and tests.
2. **Gameplay semantics:** confirmed rules and approved Decision Records in `fable-rpg/docs`, mirrored here.
3. **Wire/data shape:** canonical JSON Schemas and their contract tests.
4. **Acceptance:** golden fixtures and tests that specify observable behavior.
5. **This context repository:** readable synchronized copy and implementation guidance; it must not silently redefine the rules.
6. **Visual GDD HTML and old handoff notes:** explanatory/history only, never a higher authority than current code and approved decisions.

If two confirmed normative sources conflict and the choice changes behavior, stop only the affected work, name both sources, explain consequences and recommend a minimal resolution. Never silently choose whichever interpretation is easiest.

## 3. Architecture — responsibilities and boundaries

```text
External inputs (future transport / GM tools / AI proposals)
                    |
                    v
        validated intention / command
                    |
                    v
          SimulationEngine (server-authoritative)
          ├── deterministic tick + input-window scheduler
          ├── command validation and ordered resolution
          ├── collision / modes / combat / intents
          ├── HP / stamina / cards / statuses / outcomes
          ├── authoritative RuntimeState
          └── append-only Domain Event Journal
                    |
             replay / snapshots /
             checkpoints / rollback
                    |
        filtered read projections (future)
                    |
             Player / GM / TV clients
```

### Hard boundaries

- `packages/rules` owns the headless Core Engine per DR-C-001. Do not move it to `packages/simulation` just to make names look cleaner.
- Only the engine mutates authoritative runtime state. Commands express intentions; the server calculates outcomes and emits events.
- Runtime state, event journal, persistence rows and client projections are different models. Do not serialize internal state directly to clients or treat DB rows as the engine's runtime model.
- Time is represented in deterministic ticks (20 Hz; 50 ms per tick). Wall clock is not a gameplay timer.
- Randomness must use the named/versioned deterministic RNG contract and purpose-specific streams. No `Math.random()` or unordered iteration for authoritative outcomes.
- Events describe committed results; replay must reproduce supported state and hash. Rollback restores gameplay state but does not erase append-only history or rewind monotonic sequence/revision counters.
- Visibility is a backend projection concern: filter before serialization. Hidden data must not leak through errors, logs, event payloads or debug output.
- Content templates and production balance are separate from test-only fixtures. Never promote test fixtures to production content by implication.

## 4. Atomicity, revisions and event ordering

**Use C-003 from the synchronized [Step C Core Engine](./14-step-c-core-engine.md): command-level atomicity inside an ordered batch.**

A closed input window is a deterministic batch, ordered by players → enemies → environment. Each command is atomic: if rejected, its own gameplay mutation and domain events do not occur. A later rejection does not undo earlier accepted commands in the same batch. For example, competing moves to one cell have one deterministic accepted winner and rejected conflicts. If the batch contains at least one accepted gameplay mutation, the batch increments `sceneRevision` once and groups its committed events under the resulting revision. Rejected commands do not increment the revision themselves.

This deliberately is **not** all-or-nothing batch atomicity. The old context copy of C-003 said otherwise; it has been replaced with the current main-branch specification.

## 5. Implemented vs deferred

### Implemented in the current headless slice
- deterministic grid/movement and collision;
- tick clock, input windows, command validation and ordered batch resolution;
- enemy intents, modes, retreat resolution, HP/damage and enemy cleanup;
- stamina regeneration, mode-filtered deck dealing/rotation and minimal card play;
- `immobilized` and `ally_guard` status lifecycles;
- event journal, replay/state hash checks, in-memory checkpoint/rollback;
- campaign wrapper, test-only defense-card effects and scene outcomes.

### Explicitly deferred / not implied by the headless milestone
- production card catalog and balance work;
- item rewards and reward inventory;
- `reposition` intent (not active and not a fallback);
- runtime pause support (schemas alone do not mean the engine implements pause);
- real persistence, database migrations and crash recovery;
- network transport / WebSocket / Colyseus, authentication and deployment;
- Player/GM/TV UI and production read projections;
- AI Copilot integration and any state-changing AI proposal workflow.

Do not implement deferred items as “obvious next steps” without a scoped request and acceptance criteria.

## 6. Architectural risks to resolve before adding external layers

These are **integration gates**, not claims that the current headless implementation is broken:

1. **Persistence contract before DB work:** define the durable campaign snapshot, event storage, rules/content version pinning, migration policy, checkpoint-event transaction boundary, crash recovery and retry/idempotency behavior. The in-memory rollback is not durable persistence.
2. **Command idempotency before network retries:** define request identity scope and retention; test duplicate delivery across timeout/reconnect/rollback so costs, damage, card play and rewards cannot be applied twice.
3. **Visibility projections before clients:** create role/field-level projection functions and negative tests proving GM-only facts never reach Player/TV/AI payloads, errors or logs.
4. **Concurrency contract before transport:** specify how ownership, role, phase, stale revision, command ordering and conflicting destinations are validated at the server boundary.
5. **Compatibility policy before long-lived saves:** version events and snapshots; define which historical event versions can be replayed and when explicit migration is required.
6. **Operational limits before deployment:** define bounded journal/snapshot growth, scene lock/recovery behavior on invariant failure, and observability that does not disclose hidden campaign facts.

Do not build a generic distributed-systems framework now. Resolve each contract when its integration layer is actually scheduled.

## 7. Recommended next sequence

1. **Stabilization audit:** review merged source against the Increment 10 acceptance criteria; target rejected-command side effects, replay/rollback parity, monotonic counters, and outcome boundary cases. Report only reproducible issues.
2. **Close stale PR bookkeeping:** live GitHub state checked on 2026-10-28 shows PR #3 and PR #5 are closed as merged; PR #4 remains open although Increment 6 appears to be included in main through the merged ancestry of PR #6. The context repo must not mutate the code repo; if PR #4 is indeed redundant, close it there with an explanatory note after confirming its diff has no unique changes.
3. **Choose the next product layer explicitly:** persistence, transport/projections, or UI should be separate scoped milestones. Prefer the smallest end-to-end increment with acceptance tests, not simultaneous implementation of all layers.
4. **Add automated context consistency checks:** validate Markdown links and JSON Schema parsing; flag status text that says an already merged PR is pending. If canonical docs are intentionally copied between repos, compare hashes or generate the mirror from one source.
5. **Keep current-state and history separate:** update this file when the milestone changes; keep old increment logs as history rather than repeatedly rewriting them into current instructions.

## 8. Decision and change policy

- No gameplay rule, formula, balance value, production template or public contract changes without an explicit decision and tests.
- Prefer a minimal targeted change when it fixes a real issue. Do not refactor healthy code merely to make it look more abstract.
- Do not preserve a broken design just to minimize diff size; fix the actual contract violation and include regression coverage.
- Distinguish confirmed facts, reasoned conclusions and hypotheses in reviews.
- Do not claim tests passed unless they were actually run; report exact commands and outcomes.
- Context-only changes must not modify `fable-rpg`. Code changes belong in a feature branch of `fable-rpg`; context synchronization belongs in a branch of `fable-context`.

## 9. Canonical Step C decisions

- DR-C-001: engine stays in `packages/rules`.
- DR-C-002: enemy intent simulation, active roster, timer/target/fallback behavior and deterministic RNG are specified in [15-step-c-intent-simulation.md](./15-step-c-intent-simulation.md).
- DR-C-003: retreat damage/order/immunity are specified in [16-step-c-retreat-resolution.md](./16-step-c-retreat-resolution.md).
- DR-C-004: unified HP/damage pipeline and replay compatibility are specified in [18-step-c-hp-damage-resolution.md](./18-step-c-hp-damage-resolution.md).
- DR-C-005: stamina and resource regeneration are specified in [19-step-c-stamina-regeneration.md](./19-step-c-stamina-regeneration.md).
- DR-C-006: minimal card play is specified in [20-step-c-card-play.md](./20-step-c-card-play.md).
- DR-C-007: mode-filtered deck cycle and timed hand rotation are specified in [21-step-c-deck-cycle.md](./21-step-c-deck-cycle.md).
- DR-C-008: immobilized status lifecycle is specified in [22-step-c-status-immobilized.md](./22-step-c-status-immobilized.md).
- DR-C-009: Ally Guard runtime is specified in [23-step-c-ally-guard.md](./23-step-c-ally-guard.md).
- DR-C-010: full headless vertical slice is specified in [25-step-c-increment-10-full-headless-slice.md](./25-step-c-increment-10-full-headless-slice.md).
