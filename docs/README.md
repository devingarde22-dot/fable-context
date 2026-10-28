# Fable — Development Context Pack

Этот репозиторий передаёт AI-разработчику согласованный продуктовый контекст, нормативные правила и актуальный статус реализации. Это не список задач, которые нужно повторно реализовать.

**Аудированный code baseline:** `fable-rpg/main` `7770d04` (PR #18). Для current implementation status первичны `fable-rpg` source/tests/history; этот pack — синхронизированная навигация.

## Сначала: актуальное состояние

1. [Current State & Architecture](./26-current-state-and-architecture.md) — актуальный milestone, подтверждённые границы, source-of-truth, расхождения и открытые архитектурные вопросы.
2. [Verified Combat-Rules Inventory](./29-verified-combat-rules-inventory.md) — ranged availability, cards/magic, hit/miss/critical и damage: source/tests/open decisions.
3. [Current Backlog & Next Steps](./30-current-backlog-and-next-steps.md) — текущий приоритет и acceptance следующей работы.
4. [Product Constitution](./00-product-constitution.md), [Glossary](./01-glossary.md), [Confirmed Rules](./02-confirmed-rules.md), [Step B Baseline](./04-step-b-baseline.md) и [System Contracts](./03-system-contracts.md).
5. [Vertical Slice](./05-vertical-slice.md), [Visibility Matrix](./04-visibility-matrix.md) и [QA & Acceptance](./07-qa-and-acceptance.md).
6. [Step C — Core Engine](./14-step-c-core-engine.md) и синхронизированные Decision Records: [Intents](./15-step-c-intent-simulation.md), [Retreat](./16-step-c-retreat-resolution.md), [HP/Damage](./18-step-c-hp-damage-resolution.md), [Stamina](./19-step-c-stamina-regeneration.md), [Card Play](./20-step-c-card-play.md), [Deck Cycle](./21-step-c-deck-cycle.md), [Immobilized](./22-step-c-status-immobilized.md), [Ally Guard](./23-step-c-ally-guard.md), [Increment 10 / DR-C-010](./25-step-c-increment-10-full-headless-slice.md). Документ [24](./24-step-c-increment-10-proposal.md) — SUPERSEDED proposal.
7. [AI Developer Guide](./10-ai-developer-guide.md) и [AI Task Starter](./13-ai-task-starter.md) — протокол выполнения конкретной задачи.

[Conceptual Architecture Review](./27-conceptual-architecture-review.md) и [Server Adapter Contract Proposal](./28-server-adapter-contract-proposal.md) — историческая/предложенная архитектурная справка; они не заменяют current source review или утверждённый Decision Record.

Остальные документы — Balance Sheet, API Specification, Database Schema, Programming Roadmap, Step A и Step B Reviews — используются по мере необходимости. Старые документы и proposal могут оставаться полезными как история, но их нельзя считать текущей задачей без проверки статуса.

## Source-of-truth rules

- Product/gameplay semantics: confirmed rules, approved Decision Records and the normative baseline.
- Wire/data shape: canonical JSON Schemas plus the relevant contract text.
- Current implementation status: current `fable-rpg/main`, merged PRs, source code and tests.
- This repository's status document summarizes implementation; it does not silently redefine gameplay rules.
- Draft roadmap PR #5 и его `game-roadmap/` — PROPOSAL, не current source of truth.
- `reference/gdd-site/index.html` is a visual overview, not a normative contract.
- If two confirmed normative sources conflict, stop at the affected behavior, report both sources and the consequence, and propose a minimal explicit resolution. Do not silently pick the most convenient interpretation.

## Context packet

Give the implementer only the files relevant to the task: one goal, affected Rule IDs/Decision Records, allowed files, forbidden changes, acceptance criteria and verification commands. Do not ask the AI to reread the whole context by default; use the current-state document to route it to the minimum necessary source.

After implementation, require:
- changed files and a concise diff summary;
- Rule IDs / Decision Records affected;
- tests and exact commands run, with truthful results;
- assumptions and unresolved questions;
- replay/determinism/visibility/rollback review where relevant;
- confirmation that unrelated files and scopes were not changed.

## Status vocabulary

- `CONFIRMED` — normative decision approved; may be implemented within scope.
- `PROPOSAL` — candidate only; not canonical until approved.
- `SUPERSEDED` — retained for history; do not implement.
- `IMPLEMENTED` — present in the implementation; verify the target branch and tests before claiming merged/accepted.
- `VERIFIED` — the specified checks were run and passed; state exactly which checks.
- `OPEN_QUESTION` — missing or conflicting decision prevents safe, unambiguous implementation.
- `DEFERRED` — explicitly outside the current scope.

## Machine-readable contracts

- [Command Schema](../packages/contracts/command.schema.json)
- [Event Schema](../packages/contracts/event.schema.json)
- [Intent Schema](../packages/contracts/intent.schema.json)
- [Visibility Schema](../packages/contracts/visibility.schema.json)
