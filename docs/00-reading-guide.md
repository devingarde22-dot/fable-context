# Fable — Project Reading Guide and Context Router

**Purpose:** the main entry point for understanding Fable in the right order, onboarding a new collaborator, or pointing a developer/AI to only the relevant part of the design.  
**Status:** navigational guide; it does not override product rules, source code, tests or approved Decision Records.  
**Last organized:** 2026-10-28.

## 1. Start here: what Fable is

Fable is a cooperative party RPG for 2–4 players and one Game Master (GM). Players share a campaign but do not all see the same information:
- **Player phone** — the player's hero, personal stats/resources, legal cards/actions, targets and private GM hints.
- **TV/public display** — the public battlefield/world, telegraphs, public results and authorized shared information.
- **GM device** — authoritative scene controls and, where authorized, hidden information, NPC content, consequences, logs and checkpoints.

The core design rule is that the server owns game truth. Players send intentions; the server validates and commits outcomes. AI may assist with proposals, text and review, but an AI suggestion is not a game event.

The current verified implementation is narrower than the full product idea: it includes a headless tactical simulation and a Quarantine Gates campaign slice, not a finished multiplayer world, production UI, or durable online campaign service. The fuller city/world-map/NPC loop is currently a connected set of proposals, not confirmed implementation.

## 2. The correct reading order

### Pass A — Understand the idea (about 10–20 minutes)

1. **This guide** — learn where each kind of information lives.
2. [Product Constitution](./00-product-constitution.md) — product fantasy, player roles, core experience and non-negotiable principles.
3. [Glossary](./01-glossary.md) — learn the project's words and distinctions.
4. [Vertical Slice: Quarantine Gates](./05-vertical-slice.md) — see the intended first playable journey in concrete terms.
5. [Current State, Architecture & Next Steps](./26-current-state-and-architecture.md) — understand what is actually implemented and what the next architectural gap is.

After this pass, a reader should be able to explain what Fable is, which device serves which purpose, why the server is authoritative, and why the existing headless engine is not the same thing as a complete shipped game.

### Pass B — Learn what is normative (about 30–60 minutes)

6. [Confirmed Rules](./02-confirmed-rules.md) — gameplay semantics that can be treated as normative.
7. [Step B Baseline](./04-step-b-baseline.md) — wire-contract decisions and protocol-level constraints.
8. [System Contracts](./03-system-contracts.md) — commands, events, state, revisions and server/client responsibilities. When it conflicts with Step B wire details, the baseline and canonical schemas take precedence as stated in that document.
9. [Visibility Matrix](./04-visibility-matrix.md) — who may receive which fields.
10. [QA & Acceptance](./07-qa-and-acceptance.md) — observable acceptance, replay and leakage expectations.
11. [Increment 10 / DR-C-010](./25-step-c-increment-10-full-headless-slice.md) — current headless vertical-slice scope, outcome rules and in-memory checkpoint/rollback behavior.

Do not read every combat Decision Record in order unless the task needs them. Read the relevant one for the mechanic being changed.

### Pass C — Understand the engine and implementation boundary

12. [Step C — Core Engine & State Machine](./14-step-c-core-engine.md) — deterministic tactical engine responsibilities and execution model.
13. Read the relevant mechanic record: [Intents](./15-step-c-intent-simulation.md), [Retreat](./16-step-c-retreat-resolution.md), [HP/Damage](./18-step-c-hp-damage-resolution.md), [Stamina](./19-step-c-stamina-regeneration.md), [Card Play](./20-step-c-card-play.md), [Deck Cycle](./21-step-c-deck-cycle.md), [Immobilized](./22-step-c-status-immobilized.md), [Ally Guard](./23-step-c-ally-guard.md).
14. Read the relevant live schemas under [packages/contracts](../packages/contracts/) and their contract tests in the gameplay repository.
15. [AI Developer Guide](./10-ai-developer-guide.md) and [AI Task Starter](./13-ai-task-starter.md) — how to scope and execute a concrete implementation task.

Historical or superseded material is not a queue of work. In particular, [Increment 10 proposal](./24-step-c-increment-10-proposal.md) is superseded and must not be implemented as if it were current.

### Pass D — Understand architecture risks and future world design

Read these in order when planning the next stage beyond the headless engine:

16. [Conceptual Architecture Review](./27-conceptual-architecture-review.md) — source-inspection findings, severity and integration risks. It does not claim runtime reproduction for every finding.
17. [Server Adapter Contract Proposal](./28-server-adapter-contract-proposal.md) — proposed security and dispatch boundary between transport and the rules engine; not yet an accepted ADR.
18. [Simulation Lifecycle Audit](./29-simulation-lifecycle-audit.md) — request lifecycle, duplicate receipts, rollback and runtime input validation findings.
19. [Combat Targeting Audit](./30-combat-targeting-audit.md) — target-ranking defect found in source inspection and the proposed regression cases.
20. [World Map, City, NPC Dialogue & Transitions](./31-world-map-city-dialogue-transitions.md) — the initial conceptual overview of the player-facing world loop.
21. [Owner Decisions: World Interaction Loop](./32-owner-decisions-world-interaction-loop.md) — owner-provided world interaction constraints, including distinct world-map mode, shared dialogue, city HP rule, GM approval and immediate battle-end reset.
22. [Campaign Lifecycle and Transition Contract](./33-campaign-lifecycle-transition-contract-proposal.md) — campaign state machine, legal transitions, revisions, recovery and checkpoint boundaries.
23. [World Content and Dialogue Graph Model](./34-world-content-and-dialogue-graph-proposal.md) — data-driven locations, routes, POIs, NPCs, dialogue nodes, stable IDs and allowlisted effects.
24. [World Interaction Acceptance and Delivery Plan](./35-world-interaction-acceptance-and-delivery-plan.md) — end-to-end golden path, proposed tests, delivery phases and exit gates.
25. [Campaign Command, Event and Projection Catalog](./36-campaign-command-event-catalog-proposal.md) — proposed campaign protocol, idempotency, event families, errors and atomic commit boundaries.
26. [Default Policy Register](./37-world-interaction-default-policy-register.md) — selected recommended defaults that resolve alternatives left open by earlier concepts.
27. [Hero State Lifecycles and Battle Boundary](./38-hero-state-lifecycle-and-battle-boundary-proposal.md) — what survives between battles, what is destroyed at battle end, deck reconstruction and status lifecycle scope.
28. [Campaign Transition Failure and Recovery](./39-campaign-transition-failure-and-recovery-proposal.md) — crash windows, rollback invalidation, pending approvals, checkpoint consistency and restart recovery.
29. [Campaign Progression, Expedition Attempts and Checkpoints](./40-campaign-progression-and-checkpoint-semantics-proposal.md) — separates discovery, route access, visits, attempts, node closure, reward eligibility and checkpoint state.

**Status warning:** documents 31–39 are UNCONFIRMED proposals/target contracts. They organize the intended next layer and may guide discussion/design, but do not silently override confirmed rules or prove that the feature exists in code. Before implementation, promote only the selected normative pieces into an ADR/Rule IDs and explicitly versioned contracts.

## 3. Route by the question being asked

| Need | Read this minimum packet |
|---|---|
| “Explain the whole idea of Fable” | 00 → 01 → 05 → 26; then 31–37 for the proposed world layer |
| “What is actually built today?” | 26 → 25 → relevant source/PR and tests in fable-rpg |
| “Change a gameplay rule” | 02 + the applicable approved Decision Record + relevant test/acceptance spec + current source |
| “Change cards/deck/stamina/statuses” | 02 → 14 → relevant documents 18–23 → 25 → 38 for battle-boundary implications |
| “Implement city/world map/routes” | 26 → 27 → 28 → 31 → 32 → 33 → 34 → 35 → 36 → 37 |
| “Implement NPC dialogue” | 32 → 33 → 34 → 35 → 36 → 37; also 00 for GM/AI authority |
| “Implement battle-end reset” | 02 (especially RESOURCE/STATUS rules) → 25 → 38 → 37 → 35 acceptance cases; inspect current terminal outcome path before changing source |
| “Fix replay, request IDs or rollback” | 03 → 04 → 26 → 27–29 → 36 → 39 |
| “Build multiplayer server/transport” | 26 → 27 → 28 → 03 → 04 → command/event/visibility schemas → 29 → 36 → 39 |
| “Handle hidden information / projections” | 00 → 02 visibility rules → 04 Visibility Matrix → 03/04 Baseline → schemas → 27/28/33/36 |
| “Define node completion, repeat visits, reward eligibility or checkpoint semantics” | 02 MAP/SAVE rules → 25 → 33 → 39 → 40; preserve existing outcome-specific retry and rollback rules |
| “Choose a database / implement durable saves” | 09 as existing schema context, not a binding selection → 26–28 → 33 → 36 → 39; do not start from tables alone |
| “Balance combat/content” | 00 → 02 → 05 → 06 Balance Sheet → relevant confirmed Decision Record; do not use proposals as balance authority |
| “Ask AI to implement a task” | 26 → exact rule/decision/schema/source/tests for that task → 10 → 13; specify allowed files and explicitly excluded scope |
| “Investigate a suspected bug” | relevant source/test first → relevant audit (27/29/30/38/39) → reproduce/test; keep a source finding distinct from a runtime-confirmed defect |

## 4. Source-of-truth hierarchy

Use the source that owns the question:

1. **Current implementation and verification:** active branch/source in `fable-rpg`, merged PRs, tests and reproducible results.
2. **Confirmed gameplay semantics:** CONFIRMED rules and approved Decision Records.
3. **Wire/data contract:** current canonical JSON Schemas and their contract tests, interpreted with the approved baseline.
4. **Acceptance:** tests, golden fixtures and acceptance specifications for observable behavior.
5. **This context pack:** synchronized guidance and routing; it does not silently rewrite confirmed rules.
6. **PROPOSAL documents:** architectural recommendations, not canonical gameplay behavior until explicitly promoted.
7. **Historical plans, old handoff notes, visual GDD/site:** background only; verify status before relying on them.

If two confirmed normative sources conflict and behavior would change, identify both sources, explain the impact and recommend the minimal explicit resolution. Do not silently pick one. If proposal docs disagree with confirmed rules, the confirmed rule wins until a decision changes it.

## 5. Status labels: what they mean

- **CONFIRMED / approved Decision Record** — normative decision; implement within scope.
- **BASELINE / IMPLEMENTATION-READY** — technical baseline for its defined scope; still follow the product/rule source it references.
- **PROPOSAL / UNCONFIRMED** — candidate only; not sufficient alone to change canonical behavior.
- **SUPERSEDED** — historical reference; do not implement.
- **IMPLEMENTED** — source change exists at a named branch/commit; does not automatically mean merged or correct.
- **VERIFIED** — only the exact checks listed were run and passed.
- **OPEN QUESTION** — unsafe to decide without a rule or explicit recommended default.
- **DEFERRED** — intentionally outside the current scope.

A document can be well designed and still be unconfirmed; an old status paragraph can be stale even when the underlying rules remain useful. Use the current-state document and live PR/source status to determine what is currently merged.

## 6. How to send only the necessary context

For a new task, give the implementer a compact packet rather than the entire repository. Copy a task brief like this and fill it in:

> **Goal:** one observable behavior or bug fix.  
> **Source of truth:** current source path and applicable confirmed Rule IDs / approved Decision Record.  
> **Context to read:** only the named sections/files required for this task.  
> **Allowed scope:** files/packages that may change.  
> **Forbidden scope:** unrelated rules, schemas, UI, database or content must not change.  
> **Proposal status:** identify any proposal sections that have explicitly been selected for implementation; otherwise treat them as non-normative.  
> **Acceptance:** exact positive, negative, retry/rollback/replay and visibility scenarios that must pass.  
> **Verification:** commands actually run and results; do not claim checks not run.  
> **Return report:** changed files, source-of-truth conflicts, assumptions, tests and unresolved risks.

The implementer should not be asked to “read everything” by default. Route them to this guide, current state, the minimum confirmed rules and the exact acceptance tests.

## 7. Project boundaries to keep in mind

- The **rules engine** owns tactical gameplay decisions. A transport room must not implement a second movement/damage/status engine.
- The **campaign coordinator** is a proposed layer for world activity, location, shared dialogue, GM approval, recovery and checkpoints; it must not duplicate tactical rules.
- **Content definitions** are not runtime state; runtime campaign facts are not UI state; projections are not authoritative aggregates.
- **World map**, **location map** and **tactical grid** are distinct concepts.
- A **terminal battle transition** resets battle-only stamina/deck/status runtime immediately. City HP recovery is a separate action; persistent status/injury remains according to its own rule.
- GM and AI suggestions cannot independently commit consequential state changes.
- Client display/navigation does not constitute a campaign transition.
- Durable campaign persistence is not established by the presence of a database schema file.
- Audit findings are evidence-scoped: source inspection is not equivalent to runtime reproduction; existing tests do not prove every untested edge case.

## 8. Recommended first full product loop

The proposal packet's first end-to-end target is:

```text
City
  → shared NPC dialogue / rumor
  → distinct world-map mode
  → confirmed legal route
  → destination location
  → GM-approved scene entry
  → existing headless battle
  → terminal outcome + battle-only cleanup
  → outcome-specific return/rollback
  → conditional city HP recovery
  → post-recovery checkpoint
  → role-filtered projections / reconnect
```

This is the design target, not a claim that all steps already exist in the current implementation. See docs 31–39 for the proposed details and acceptance conditions.

## 9. Quick links

- Product idea: [00 Product Constitution](./00-product-constitution.md)
- Vocabulary: [01 Glossary](./01-glossary.md)
- Canonical gameplay behavior: [02 Confirmed Rules](./02-confirmed-rules.md)
- Technical contract: [04 Step B Baseline](./04-step-b-baseline.md) and [03 System Contracts](./03-system-contracts.md)
- First playable scenario: [05 Vertical Slice](./05-vertical-slice.md)
- Current implementation: [26 Current State & Architecture](./26-current-state-and-architecture.md)
- Main architecture review: [27 Conceptual Architecture Review](./27-conceptual-architecture-review.md)
- World-loop entry point: [31 World Map, City, NPC Dialogue & Transitions](./31-world-map-city-dialogue-transitions.md)
- Recommended first-slice defaults: [37 Default Policy Register](./37-world-interaction-default-policy-register.md)
- Battle/persistent hero boundary: [38 Hero State Lifecycle](./38-hero-state-lifecycle-and-battle-boundary-proposal.md)
- Crash/restart handling: [39 Campaign Failure and Recovery](./39-campaign-transition-failure-and-recovery-proposal.md)
- Discovery / retries / rewards / checkpoints: [40 Campaign Progression and Checkpoint Semantics](./40-campaign-progression-and-checkpoint-semantics-proposal.md)
- AI implementation protocol: [10 AI Developer Guide](./10-ai-developer-guide.md) and [13 AI Task Starter](./13-ai-task-starter.md)
