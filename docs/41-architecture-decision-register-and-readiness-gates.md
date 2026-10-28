# Fable — Architecture Decision Register and Readiness Gates

**Date:** 2026-10-28  
**Status:** UNCONFIRMED planning register. It routes existing findings and proposals; it is not a new gameplay rule or implementation approval.  
**Purpose:** provide one place to answer “what is the next safe step?”, while keeping verified facts, source-inspection findings, design gaps and unverified behavior distinct.

## 1. Current baseline

The current source-of-truth status document is [docs/26-current-state-and-architecture.md](./26-current-state-and-architecture.md). It records Increment 10 / DR-C-010 as merged to fable-rpg/main, with prior project checks reported as passed. This does not mean the full multiplayer product, the CampaignCoordinator, production UI, world map, shared dialogue, or durable campaign persistence is implemented.

The development context repository is not the live game repository. This branch changes context documentation only.

## 2. Evidence classes

Use these labels in implementation planning and review:

- **SOURCE FINDING** — a code path was inspected and a concrete behavior follows from the inspected logic. Unless reproduced, describe it as source-level evidence, not as a runtime reproduction.
- **DESIGN GAP** — current contracts do not yet define an end-to-end rule/contract.
- **UNVERIFIED REQUIREMENT** — desired behavior is now stated, but the full current implementation has not been checked against it.
- **COMPATIBILITY RISK** — current behavior may be correct today but cannot safely promise future replay/persistence without additional versioning.
- **HISTORICAL STATUS RISK** — old status prose may be stale; use current source, merged PR metadata and docs/26.

Do not turn all five classes into the same generic label “bug”. Each has a different resolution path.

## 3. Prioritized finding register

| ID | Class / priority | Finding or target requirement | Next safe action | Source |
|---|---|---|---|---|
| F-02 | Design/integration, P1 | Demo room and headless engine have separate mutation paths | Before external multiplayer, route gameplay commands through one authoritative engine instance; delete/disable parallel rule mutation only in a scoped implementation change | [27](./27-conceptual-architecture-review.md), [28](./28-server-adapter-contract-proposal.md) |
| F-03 | Security, P0 before untrusted users | Client-provided join role is not proof of identity/membership | Derive role, party membership and actor-to-hero binding from trusted server identity; test role escalation and cross-campaign access ([42](./42-party-membership-and-reconnect-proposal.md)) | [27](./27-conceptual-architecture-review.md) |
| F-04 | Security, P0 before hidden content | Shared replication is not field-level visibility filtering | Keep private data server-side and serialize explicit allowlisted TV/player/GM projections; inspect actual payloads and reconnect snapshots | [27](./27-conceptual-architecture-review.md), [04 visibility](./04-visibility-matrix.md) |
| F-05 | Correctness, P1 before spawn workflow | Demo spawn confirmation is not backed by a consumed server-owned proposal | Persist a validated proposal and atomically consume/resolve it; bind to GM/campaign/content/revision | [27](./27-conceptual-architecture-review.md), [28](./28-server-adapter-contract-proposal.md) |
| F-08 | Source finding, P1 | Rollback can discard queued commands without reconciling request receipts | Decide reject-rollback-while-pending versus explicit terminal cancellation; test stale receipt/retry semantics | [27](./27-conceptual-architecture-review.md), [29](./29-simulation-lifecycle-audit.md) |
| F-10 | Source finding, P1 | Request deduplication can keep returning the original queued receipt after the command resolves | Store and return an advancing request lifecycle with terminal status, rejection code, event IDs and revision | [27](./27-conceptual-architecture-review.md), [29](./29-simulation-lifecycle-audit.md) |
| F-11 | Defensive API correctness, P2 | Runtime null/undefined command may be dereferenced before schema validation | Add a guard at the external/runtime boundary and a malformed-input test | [27](./27-conceptual-architecture-review.md), [29](./29-simulation-lifecycle-audit.md) |
| F-12 | Source finding, P1 gameplay correctness | Target-selection policies may filter candidates using a score from the first ID-sorted candidate instead of the global optimum | Add non-tied target fixtures and deterministic tie tests; then fix the scoring selection in a separately scoped gameplay PR | [30](./30-combat-targeting-audit.md) |
| F-06/F-07 | Compatibility/integration, P1 before durable online sessions | Database schema and engine-local idempotency do not by themselves guarantee durable state/event/request atomicity | Define transaction/recovery boundary, identity scope, retention and restart behavior before choosing persistence implementation | [27](./27-conceptual-architecture-review.md), [28](./28-server-adapter-contract-proposal.md), [39](./39-campaign-transition-failure-and-recovery-proposal.md) |
| F-09 | Compatibility risk, P1 before long-lived replay promises | Whole rules/content bundle version is not pinned at the runtime snapshot boundary | Pin immutable rules/content bundle IDs and fail explicitly if historical versions are unavailable | [27](./27-conceptual-architecture-review.md), [33](./33-campaign-lifecycle-transition-contract-proposal.md) |
| F-13 | Design gap, P1 before full world loop | Map, location, city, dialogue and scene transitions lack one normative state machine | Define legal transitions, current activity, parent context, scene-entry approval and checkpoint boundaries | [31](./31-world-map-city-dialogue-transitions.md), [33](./33-campaign-lifecycle-transition-contract-proposal.md) |
| F-14 | Design gap, P1 before world/network integration | Campaign mutations need their own revision/protocol domain, separate from scene revision | Design explicit campaign command/event schemas and projection contracts; never silently expand current scene schema v1 | [33](./33-campaign-lifecycle-transition-contract-proposal.md), [36](./36-campaign-command-event-catalog-proposal.md) |
| F-15 | Unverified requirement, P1 before campaign integration | Owner requires immediate battle-end reset of combat-only stamina/deck/temporary status, but full source behavior was not verified | Compare the actual terminal outcome path/reducers/tests against the lifecycle contract; preserve persistent injury and existing outcome/rollback semantics | [38](./38-hero-state-lifecycle-and-battle-boundary-proposal.md), [35](./35-world-interaction-acceptance-and-delivery-plan.md) |
| F-01 | Historical status risk | Old milestone/handoff language has contradicted live merged status in the past | Use docs/26 and current GitHub PR/main metadata; avoid restarting completed increments | [26](./26-current-state-and-architecture.md) |

**Numbering note:** F-01–F-15 refer to the cumulative architecture review, not a priority sequence. The register groups by action and risk.

## 4. Readiness gates: safe implementation sequence

### Gate 0 — Choose which rules become normative

- Read docs 00–05 for product and confirmed behavior.
- Select which world-loop proposals are being promoted from docs 31–40.
- Write stable Rule IDs/Decision Records for selected rules.
- Resolve any conflict with confirmed rules explicitly.
- Keep unselected proposal rules non-normative.

**Exit:** the implementer knows exactly which behaviors are authorized and which are still deferred.

### Gate 1 — Close core correctness risks in a narrow gameplay change

Before relying on the engine for multiplayer retries/replay:
- advance request lifecycle records from queued to accepted/rejected;
- reconcile queued requests on rollback;
- fix target selection so score optimization precedes seeded tie-breaking;
- add the malformed runtime command guard where the public engine boundary needs it;
- verify the owner's battle-end cleanup requirement against existing code and add any missing behavior only after the source comparison.

**Exit:** tests cover retries after accepted/rejected/pending/rollback, non-tied target ranking, malformed inputs and each battle terminal outcome. This gate requires changes in fable-rpg and is not performed by this context-only PR.

### Gate 2 — Define and secure the adapter boundary

- Server-derived identity, membership, role and actor binding.
- One authoritative engine per live scene; no parallel room gameplay state.
- Request schema validation, size/rate limits and monotonic request lifecycle.
- Allowlisted projections and negative visibility tests.
- Explicit disconnect/reconnect and GM-disconnect policy ([42](./42-party-membership-and-reconnect-proposal.md)).
- No public transport exposure while client role claims or hidden-field replication are unresolved.

**Exit:** authenticated requests can only affect the authorized aggregate and no private data appears in actual serialized payloads.

### Gate 3 — Add campaign orchestration

- Implement one CampaignCoordinator above the scene engine.
- Keep campaignRevision separate from sceneRevision.
- Add one route, one city, one shared dialogue and one GM-approved scene proposal.
- Use strict versioned content and a bounded effect allowlist.
- Cover return, conditional recovery and post-recovery checkpoint.

**Exit:** the golden end-to-end path in docs 35 works with idempotent retries, reconnect and hidden-data tests.

### Gate 4 — Add durable persistence

Only after Gates 1–3 define the semantics:
- choose storage implementation;
- define state + event + idempotency + checkpoint commit boundaries;
- pin rules/content versions;
- define schema migrations and historical replay compatibility;
- implement restart recovery for every operation stage.

**Exit:** failure-injection tests prove the transition remains coherent across a process crash at each declared commit boundary.

### Gate 5 — Harden the playable product

- Player/TV/GM UX for pending, success, rejection and reconnect.
- Content authoring validation and safe GM override workflows.
- Operational limits, structured diagnostics and no hidden-state logging leaks.
- Full 2–4 player + GM + TV E2E golden path.
- Truthful release/readiness status.

**Exit:** the complete first playable loop works under normal and failure/reconnect conditions without altering the verified headless engine semantics unintentionally.

## 5. What not to do yet

- Do not start with database migrations before the consistency and idempotency contract is agreed.
- Do not expose the demo room to untrusted clients while its role/projection limitations remain.
- Do not add the world map/dialogue by mutating sceneRevision or smuggling new command variants into current schema v1.
- Do not let AI-generated prose directly apply consequences.
- Do not make city entry a second battle cleanup implementation.
- Do not clear every timed status indiscriminately; classify scope and honor explicit post-battle rules.
- Do not reinterpret success/retreat/defeat/gm_abort outcomes, retryability or reward eligibility in a campaign UI layer.
- Do not label source-inspection findings “runtime reproduced” without running a reproducing test.
- Do not treat these proposals as proof that the full feature exists.

## 6. How to use this register

For a new implementation, select a single gate and the smallest set of finding IDs it closes. Link those IDs in the task/PR body, name the exact source files and tests, and report any discrepancy between this context proposal and current source.

If implementation disproves a finding, update this register and the original audit with the evidence instead of leaving contradictory stale claims. If a proposal is accepted, move its selected requirements to a normative Decision Record/Rule IDs and mark the corresponding proposal section as superseded or promoted.
