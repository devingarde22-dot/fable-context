# Fable — Development Context Repository

This repository is the canonical context pack for the Fable game project. It describes confirmed product/game rules and gives AI developers the current, verified implementation status without duplicating the full codebase.

## Current project state

The current implementation status is maintained in [docs/15-current-state-and-architecture.md](docs/15-current-state-and-architecture.md). At the checked repository snapshot, **Increment 10 (DR-C-010) is merged into `fable-rpg/main`** by PR [#8](https://github.com/devingarde22-dot/fable-rpg/pull/8), merge commit `b619c77c483c69b253430352c39edc5addb42f14`.

Do not treat old handoff text, old open-PR notes, or the original Step C starter task as current status. Historical proposals and old milestones remain useful as history, not as instructions to redo completed work.

## How to use this context

For a new task, use the smallest relevant context packet rather than treating every document as a new implementation task:

1. [Current state and architecture](docs/15-current-state-and-architecture.md) — current milestone, boundaries, known gaps and source precedence.
2. [Product Constitution](docs/00-product-constitution.md).
3. [Glossary](docs/01-glossary.md).
4. [Confirmed Rules](docs/02-confirmed-rules.md) and the relevant section of [System Contracts](docs/03-system-contracts.md).
5. [Step B Baseline](docs/04-step-b-baseline.md) and the relevant Decision Record.
6. [Step C Core Engine](docs/14-step-c-core-engine.md) for engine behavior.
7. Relevant JSON Schemas under `packages/contracts/` and the acceptance tests/specification for the task.
8. [AI Developer Guide](docs/10-ai-developer-guide.md) and [AI Task Starter](docs/13-ai-task-starter.md) for execution protocol.

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
