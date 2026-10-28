# Fable — Development Context Repository

This repository is the canonical context pack for the Fable game project. It describes confirmed product/game rules and gives AI developers the current, verified implementation status without duplicating the full codebase.

## Current project state

The headless engine and campaign slice (PR [#8](https://github.com/devingarde22-dot/fable-rpg/pull/8)) are the foundation. Later integration [PR #14](https://github.com/devingarde22-dot/fable-rpg/pull/14) merged engine-audit fixes, and [PR #15](https://github.com/devingarde22-dot/fable-rpg/pull/15) added the minimal Player/GM WebSocket vertical slice at merge commit `37154a830eab311d8ddf815f13b38bf745522be4`.

This is a server-side prototype slice, **not a finished browser game**: Player/GM/TV screens, external identity verification, durable database persistence, the full campaign/world/dialogue loop, production content and public deployment remain to be completed. See the [Game Roadmap](game-roadmap/README.md) for the current assessment, phased plan, readiness gates and prioritized backlog.

The older [Current State, Architecture & Next Steps](docs/26-current-state-and-architecture.md) page preserves architectural analysis from an earlier snapshot; use [Game Roadmap — current state](game-roadmap/00-current-state.md) for the post-PR-15 implementation inventory.

## How to use this context

Start with the [Project Reading Guide](docs/00-reading-guide.md) for the right order of reading, task-specific routing and the source-of-truth hierarchy. For implementation work, use the smallest relevant context packet rather than treating every document as a new implementation task:

1. [Game Roadmap](game-roadmap/README.md) — newest implementation snapshot after PR #15, path to playable MVP/release and backlog with acceptance criteria.
2. [Current state and architecture](docs/26-current-state-and-architecture.md) — architectural background and source precedence; it contains an earlier snapshot.
3. [Product Constitution](docs/00-product-constitution.md).
4. [Glossary](docs/01-glossary.md).
5. [Confirmed Rules](docs/02-confirmed-rules.md) and the relevant section of [System Contracts](docs/03-system-contracts.md).
6. [Step B Baseline](docs/04-step-b-baseline.md) and the relevant Decision Record.
7. [Step C Core Engine](docs/14-step-c-core-engine.md) for engine behavior.
8. Relevant JSON Schemas under `packages/contracts/` and the acceptance tests/specification for the task.
9. [AI Developer Guide](docs/10-ai-developer-guide.md) and [AI Task Starter](docs/13-ai-task-starter.md) for execution protocol.

Markdown rule documents and machine-readable schemas define intended behavior and data shape. The implementation, tests, Git history and PR status establish what is currently implemented and verified. If confirmed normative sources conflict, do not guess: report the exact conflict and propose a resolution.

## Project invariants

- The server-side simulation is authoritative; clients and AI submit intentions/proposals, not outcomes.
- Only the engine applies gameplay mutations and emits authoritative domain events.
- Deterministic behavior must not depend on wall-clock time, uncontrolled randomness or unstable collection iteration.
- Visibility is filtered before serialization.
- Contracts remain explicit and closed where specified; schema/API changes must be deliberate.
- Do not invent gameplay rules, balance values, production content or scope without an approved decision.
- Do not change the gameplay repository while working on this context pack unless explicitly asked.

## Repository layout

```text
docs/                  normative rules, decisions, implementation guidance and status
packages/contracts/    JSON Schema contracts
dev/                   supporting examples/prototypes; not automatically authoritative runtime
reference/gdd-site/    visual overview only; not a normative source
```

Use [docs/13-ai-task-starter.md](docs/13-ai-task-starter.md) to scope a concrete task. It is not permission to restart completed milestones.
