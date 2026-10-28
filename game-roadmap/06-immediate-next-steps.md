# 06 — Ближайшие действия после текущего main

Цель следующего цикла — не начать сразу строить весь мир. Нужно превратить прототипный серверный срез в безопасный и воспроизводимый first playable, устранить рискованные несоответствия и сохранить уже реализованные функции.

## PR A — актуальный source audit и синхронизация handoff

**Репозиторий:** fable-rpg.  
**Scope:** docs/tests inspection; gameplay code менять только если finding подтверждён.

- Снять актуальный baseline после PR #15.
- Проверить findings из [PR #13 audit report](https://github.com/devingarde22-dot/fable-rpg/blob/main/docs/28-step-c-read-only-audit-2026-10-28.md) против текущего source. Отчёт готовился по b619c77, до #14/#15.
- Синхронизировать root README, development handoff, package readmes и current status; не объявлять closed PR open.
- Определить, какие findings закрыты PR #14/#15, какие остаются current, какие требуют product decision.
- Результат: короткая таблица finding → current file/test → status → next action.

**Acceptance:** каждая следующая задача связана с проверенным current source/contract/test; старый audit report не используется как список «всё ещё сломано».

## PR B — role-filtered event stream

**Почему рано:** PlayerGmVerticalSlice фильтрует projections, но event broadcast path рассылает event slice всем sessions. Даже если текущие events публичны, эту policy нельзя переносить на hidden intents, dialogue flags и private campaign events.

- Добавить role visibility metadata/policy for event types/payloads.
- Формировать отдельные allowlisted event batches per role; не отправлять сырые journal records всем.
- Проверить actual JSON frames для player и GM, позже — для TV.
- Добавить negative test на private/GM-only test event.
- Убедиться, что reconnect/redelivery не обходит filter.

**Acceptance:** запрещённое поле/event отсутствует в serialized message unauthorized role независимо от содержимого engine journal.

## PR C — combat target scoring regression

- Добавить target fixtures, где entity ID order не совпадает с nearest/highest-threat/lowest-HP score.
- Сначала тестом подтвердить, какая policy выбирает неправильно на current main.
- Исправить выбор набора лучших score candidates; deterministic tie-break делать только среди best-score ties.
- Проверить replay/state hash and existing intent priority tests.

**Acceptance:** оптимальный candidate выбирается по policy score; tie-break deterministic; поведение вне target policy не меняется.

## PR D — короткие gameplay Decision Records

Не сливать несвязанные правила в один большой gameplay PR. Утвердить по одному DR для:
- ranged-mode capability vs deck-based wording;
- card category/magic semantics;
- hit/critical/miss formulas, RNG stream and event order;
- damage rounding/version semantics;
- battle end: очистка battle-only state и сохранение persistent injuries.

Для каждого DR: вопрос → варианты → рекомендация → impact on replay/schema/content → acceptance cases. Пока решения нет, implementer не выбирает сам.

## PR E — repeatable browser bootstrapping

- Добавить documented local start path for WebSocket server + browser clients.
- Использовать development-only seed identities/membership; никаких production tokens/secrets в репозитории.
- Сделать минимальные Player и GM screens; добавить TV projection/screen до private campaign content.
- Support command result, projection updates, connection errors and reconnect.
- Начать с move/GM pause/outcome, затем добавить подтверждённые mode/card commands and complete battle scenario.

**Acceptance:** два player browser sessions плюс GM могут подключиться к одной test campaign и завершить сценарий через UI; serialized payload checks проходят.

## После этого

1. DB persistence/restart recovery с transaction contract.
2. World-loop proposals 31–42 перевести в утверждённые Decision Records.
3. Реализовать CampaignCoordinator, campaign schemas, city/map/dialogue/GM approval/checkpoint.
4. Добавить production content, rewards/progression, polish, staging/operations.
5. Выпускать closed beta только при прохождении [Definition of Done](./01-definition-of-done.md) и [release gate](./05-quality-and-release.md).

## Как делегировать каждую реализацию

Каждая задача AI-разработчику должна содержать:
- конкретный backlog ID и только связанные источники контекста;
- expected behavior и чёткий out of scope;
- acceptance tests and Definition of Done;
- требование сообщить changed files, выполненные команды и фактические результаты;
- указание менять код в fable-rpg, а не в fable-context.

Roadmap не разрешает реализацию неутверждённых игровых правил.