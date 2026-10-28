# Fable — Development Context Pack

Этот репозиторий передаёт согласованный продуктовый контекст, нормативные правила, актуальный статус реализации и маршруты чтения для разных типов задач. Это не список задач, которые нужно повторно реализовать.

## Сначала: выбери маршрут чтения

Начинай с **[Project Reading Guide & Context Router](./00-reading-guide.md)** — он содержит правильную последовательность знакомства с продуктом, краткую карту источников и ссылки по типам задач.

Для обычного ознакомления с нормативным контекстом используй такой порядок:
1. [Current State & Architecture](./26-current-state-and-architecture.md) — что реализовано и где границы текущего среза.
2. [Product Constitution](./00-product-constitution.md) — зачем существует Fable и какие принципы нельзя случайно сломать.
3. [Glossary](./01-glossary.md) — единая терминология.
4. [Vertical Slice](./05-vertical-slice.md) — конкретный игровой путь.
5. [Confirmed Rules](./02-confirmed-rules.md), [Step B Baseline](./04-step-b-baseline.md), [System Contracts](./03-system-contracts.md) и [Visibility Matrix](./04-visibility-matrix.md) — нормативные игровые и протокольные правила.
6. [QA & Acceptance](./07-qa-and-acceptance.md) — проверяемое ожидаемое поведение.
7. [Step C — Core Engine](./14-step-c-core-engine.md) и только нужный mechanic Decision Record: [Intents](./15-step-c-intent-simulation.md), [Retreat](./16-step-c-retreat-resolution.md), [HP/Damage](./18-step-c-hp-damage-resolution.md), [Stamina](./19-step-c-stamina-regeneration.md), [Card Play](./20-step-c-card-play.md), [Deck Cycle](./21-step-c-deck-cycle.md), [Immobilized](./22-step-c-status-immobilized.md), [Ally Guard](./23-step-c-ally-guard.md), [Increment 10 / DR-C-010](./25-step-c-increment-10-full-headless-slice.md). Документ [24](./24-step-c-increment-10-proposal.md) — SUPERSEDED, не реализовывать.
8. [AI Developer Guide](./10-ai-developer-guide.md) и [AI Task Starter](./13-ai-task-starter.md) — способ ставить и выполнять отдельные технические задачи.

Первичный архитектурный аудит: [Conceptual Architecture Review](./27-conceptual-architecture-review.md) — подтверждённые расхождения и приоритетные интеграционные блокеры; это не замена проверке кода и тестов.

Предлагаемая граница сервера: [Server Adapter Contract Proposal](./28-server-adapter-contract-proposal.md) — роли, команды, идемпотентность, rollback, проекции и критерии интеграции; документ пока является proposal, не принятым контрактом.

Углублённые source-аудиты: [Simulation Lifecycle Audit](./29-simulation-lifecycle-audit.md) — request lifecycle, rollback и runtime validation; [Combat Targeting Audit](./30-combat-targeting-audit.md) — ошибка приоритизации целей AI. [World Map, City, NPC Dialogue & Transitions](./31-world-map-city-dialogue-transitions.md) — начальный концепт мирового цикла; [32–37](./32-owner-decisions-world-interaction-loop.md) — решения владельца, переходный контракт, модель контента, приёмка, протокол и defaults; [38](./38-hero-state-lifecycle-and-battle-boundary-proposal.md) — жизненный цикл состояния героя; [39](./39-campaign-transition-failure-and-recovery-proposal.md) — сбои и восстановление. Документы 31–39 остаются UNCONFIRMED proposals, не утверждёнными gameplay-контрактами. Проверки аудитов основаны на чтении исходников; тесты и сборка не запускались.

Остальные документы — Balance Sheet, API Specification, Database Schema, Programming Roadmap, Step A и Step B Reviews — используются по мере необходимости. Старые документы и proposal могут оставаться полезными как история, но их нельзя считать текущей задачей без проверки статуса.

## Source-of-truth rules

- Product/gameplay semantics: confirmed rules, approved Decision Records and the normative baseline.
- Wire/data shape: canonical JSON Schemas plus the relevant contract text.
- Current implementation status: current `fable-rpg/main`, merged PRs, source code and tests.
- This repository's status document summarizes implementation; it does not silently redefine gameplay rules.
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

## World interaction design — all unconfirmed proposals

- [World Map, City, NPC Dialogue & Activity Transitions](./31-world-map-city-dialogue-transitions.md) — initial conceptual overview.
- [Owner Decisions: World Interaction Loop](./32-owner-decisions-world-interaction-loop.md) — captures owner-provided constraints and recommended initial city interactions.
- [Campaign Lifecycle and Transition Contract](./33-campaign-lifecycle-transition-contract-proposal.md) — state machine, transition preconditions, revisions, city recovery, scene entry, reconnect and checkpoint semantics.
- [World Content and Dialogue Graph Model](./34-world-content-and-dialogue-graph-proposal.md) — nodes/routes/POIs/NPCs, stable dialogue IDs, pure conditions, allowlisted effects and content validation.
- [World Interaction Acceptance and Delivery Plan](./35-world-interaction-acceptance-and-delivery-plan.md) — end-to-end golden path, detailed acceptance matrix, test layers, phases and exit gates.
- [Campaign Command, Event and Projection Catalog](./36-campaign-command-event-catalog-proposal.md) — candidate campaign protocol operations, idempotency lifecycle, atomic commit boundaries, errors and role projections.
- [Default Policy Register for the First World Interaction Slice](./37-world-interaction-default-policy-register.md) — resolves low-level design alternatives with recommended defaults so an implementer does not have to guess.
- [Hero State Lifecycles and Battle Boundary](./38-hero-state-lifecycle-and-battle-boundary-proposal.md) — separates persistent hero sources from battle runtime and defines end-of-battle lifecycle invariants.
- [Campaign Transition Failure and Recovery Model](./39-campaign-transition-failure-and-recovery-proposal.md) — crash windows, pending approvals, rollback invalidation and recovery consistency.
- [Campaign Progress, Expedition Attempts and Checkpoint Semantics](./40-campaign-progression-and-checkpoint-semantics-proposal.md) — separates world discovery, route availability, node visits/attempts, rewards and checkpoint state.

These documents form a connected design packet and all remain UNCONFIRMED PROPOSAL. The default policy register supersedes exploratory alternatives in earlier proposal documents only where it explicitly states a choice; it never overrides existing confirmed rules or current source behavior. The packet does not change confirmed rules or current schemas. Promote the selected rules into an ADR/Rule IDs and versioned contracts before implementing gameplay code.
