# 04 — Архитектурные принципы и риски

## 1. Целевая схема

Player UI / GM UI / TV UI → WebSocket/HTTP → authentication + campaign membership → typed transport validation/idempotency/rate limits → campaign command dispatcher → CampaignCoordinator (campaign state, routes, dialogue, approvals) → authoritative HeadlessSimulationEngine (scene combat state) → durable events/receipts/snapshots/checkpoints → role-allowlisted projections and event streams.

Это целевая архитектура, а не утверждение, что каждый блок уже реализован. Сейчас packages/vertical-slice — минимальный adapter, а HeadlessCampaign — in-memory wrapper, не готовый CampaignCoordinator.

## 2. Не размывать ответственность слоёв

### Rules engine
- Единственный источник изменений authoritative scene/gameplay state.
- Определяет legal command, ordered resolution, timers, combat effects, outcomes and domain events.
- Остаётся headless; не зависит от React, WebSocket, Express, PostgreSQL или AI SDK.
- Детерминизм/replay — контракт, а не optional optimization.

### Transport adapter
- Подтверждает identity, campaign membership, role and actor-to-hero binding из trusted server state.
- Валидирует внешние JSON envelopes; назначает server-side session/request metadata.
- Маршрутизирует команды к engine/coordinator и выдаёт terminal command receipt.
- Не реализует повторно логику движения/урона/целей/карт.
- Ограничивает payload/частоту и формирует сообщения без утечки hidden state.

### CampaignCoordinator (будущий слой)
- Отвечает за активность кампании, карту/локацию/route, access flags, shared dialogue, GM approvals, recovery/checkpoints и progression.
- Не переписывает tactical simulation. Для сцены делегирует HeadlessSimulationEngine.
- Использует отдельные campaign command/event schemas и versioning; не превращает scene schema v1 в «всё обо всём».

### Persistence
- Сохраняет согласованные данные, а не копию правил.
- Определяет атомарную границу для request receipt, domain events, snapshot/checkpoint, outcome/reward and campaign transition.
- Фиксирует rules/content bundle versions для долгого replay.
- DB rows не являются runtime engine state.

### Projection/event policy
- Player projection — только собственный hero + информация, разрешённая для партии.
- GM projection — данные, разрешённые GM.
- TV projection — только публичная сцена/телеграфы/результаты.
- Event stream также нужно фильтровать по роли. Нельзя отправлять полный journal всем sessions и надеяться, что клиент сам скроет поля.
- То же правило применяется к reconnect snapshots, command errors, diagnostics and logs.

## 3. Что делать с текущим transport

packages/vertical-slice — предпочитаемая основа для первого playable slice, потому что он передаёт команды в rules engine и уже содержит WS/session/auth interfaces. Старый dev/server/CampaignRoom.ts остаётся отдельным демо-каркасом с собственной state mutation. Не расширять его параллельно — либо пометить historical/example, либо заменить отдельным согласованным PR после проверки ссылок.

Перед добавлением скрытых NPC, GM-only intents, secret dialogue flags или private reward state закрыть SEC-01: PlayerGmVerticalSlice.broadcastEvents() сейчас рассылает event slice всем sessions, хотя snapshots/projections строятся по role. Сначала определить допустимость каждого event type/payload по роли и реализовать allowlist/filter. Это source-level finding: он не доказывает существующую утечку для каждого текущего public event, но небезопасен как policy по умолчанию для расширения.

## 4. Критичные решения/риски

| Риск | Почему важен | Следующий шаг |
|---|---|---|
| Raw events broadcast to all | Может раскрыть hidden/private payload при добавлении нового event type | Event visibility contract + WS payload negative tests |
| Pause state split | Adapter flag может отличаться от engine/snapshot after restore | Audit pause state owner and restart semantics |
| Target policy scoring | Выбор кандидатов по ID order вместо global optimum может изменить бой | Non-tied fixtures, deterministic test, bounded fix |
| Damage float edge | ceil around float rounding способен дать +1 damage на exact boundary | Decision Record / exact arithmetic test / formula version |
| Unspecified magic/hit/crit/miss | Нельзя моделировать production card effects без классификации и формул | Approve card model and RNG/phase semantics |
| canEnterRangedMode inconsistency | Код/DR и wording Vertical Slice могут трактовать доступность по-разному | Решить normative source, обновить doc+test |
| Cross-scene sequence | Scene-local counters могут нарушить campaign-global sequence expectation | Campaign-level sequence allocator before multi-scene transfer |
| Durable writes | In-memory persistence теряется при process restart | Commit/recovery contract before DB coding |
| Content/replay compatibility | Rules/content update may alter old campaign replay | Pin immutable versions; explicit migrations/failure mode |
| Battle lifecycle | Temporary combat resources may leak to next battle или persistent injury may be lost | Lifecycle tests at terminal outcome/checkpoint boundary |

## 5. Что считать решённым, а что перепроверить

- **В current main after PR #14:** request idempotency, sceneRevision/input-window semantics and Extinguisher bind eligibility have merged implementation/tests. Не добавлять их в backlog как новые задачи без обнаружения регрессии.
- **В current main after PR #15:** base WebSocket transport, token/membership handshake, Player/GM projections, pause/outcome commands, resume token and in-memory persistence interfaces exist.
- **Не доказано этим:** production database, external identity verification, TV projection/UI, browser frontend, full campaign world, all game commands, production content, public deployment.
- **Audit report PR #13:** анализировал b619c77; выводы про pause, rollback token, state sequencing и card semantics нужно перепроверить после #14/#15.
- **Combat targeting report:** independent source finding остаётся кандидатом на актуальную regression investigation, так как PR #14/#15 не заявляют исправление target selection; перед пометкой bug confirmed проверить текущий file/test.

## 6. Не выбирать технологии без необходимости

External identity vendor, конкретный database host, frontend framework, deploy host, metrics provider and asset pipeline не фиксируются молча. Нужен small technical decision только когда следующий этап требует его. Требование к результату важнее бренда: восстановление после process restart, безопасные projections, понятный вход в сессию и поддерживаемый выпуск.