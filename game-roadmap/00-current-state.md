# 00 — Текущее состояние проекта

**Дата анализа:** 2026-10-28.  
**Кодовая база:** fable-rpg/main после интеграции PR #14 и PR #15.  
**Последний подтверждённый feature merge:** [PR #15](https://github.com/devingarde22-dot/fable-rpg/pull/15), merge commit 37154a830eab311d8ddf815f13b38bf745522be4.

## 1. Что уже реализовано

### A. Headless core engine

В packages/rules находятся серверно-авторитетные правила симуляции: grid/movement, tick clock и input windows, упорядоченная обработка команд, enemy intents, HP/damage, stamina, deck lifecycle, status effects, Ally Guard, journal/replay/state hash и in-memory checkpoint/rollback. HeadlessCampaign даёт узкий in-memory flow для города, маршрута/узла, сцены, исхода и city checkpoint.

Главная сильная сторона — ядро не зависит от UI или сетевого транспорта и имеет детерминированные тесты. Его следует сохранить как единственное место, где меняется authoritative gameplay state.

### B. Player/GM server vertical slice

[Пакет @fable/vertical-slice](https://github.com/devingarde22-dot/fable-rpg/tree/main/packages/vertical-slice) связывает transport и rules engine. В нём есть:

- WebSocket endpoint /ws и health endpoint /health;
- handshake с token, campaignId, role и actor membership;
- player и GM sessions, с проверкой роли и одного GM;
- player projection, ограниченный собственным hero и enemy entities;
- GM projection с entities и active intents;
- player.move через engine input window;
- gm.pause и gm.end_expedition;
- AJV-проверка входных transport messages, token-bucket rate limit на соединение;
- resume token и injectable persistence interface для session/snapshot; reference implementation хранит всё в памяти;
- создание engine из snapshot при наличии конфигурации неизменяемого content catalog.

Подробности: [README vertical slice](https://github.com/devingarde22-dot/fable-rpg/blob/main/packages/vertical-slice/README.md), [transport](https://github.com/devingarde22-dot/fable-rpg/blob/main/packages/vertical-slice/src/websocket.ts), [security/persistence interfaces](https://github.com/devingarde22-dot/fable-rpg/blob/main/packages/vertical-slice/src/security.ts).

### C. Зафиксированный статус проверки

Описание PR #15 сообщает: pnpm check PASS; 39 rules test files / 172 tests; 2 vertical-slice test files / 6 tests; typecheck, lint и build PASS. Это reported check из PR, не независимый запуск команд при создании этого контекста.

[PR #14](https://github.com/devingarde22-dot/fable-rpg/pull/14) объединил корректировки из PR #9–#13. В частности, туда вошли request idempotency hardening, semantics clientRevision внутри input window и изменение eligibility для Extinguisher bind. Не надо планировать их как будто они всё ещё ждут merge; проверять нужно текущее поведение и тесты.

## 2. Чего пока нет в готовом виде

| Область | Текущее состояние | Что нужно, чтобы считать готовым |
|---|---|---|
| Подключение | Есть код WebSocket-сервера и auth/membership interfaces | Повторяемый запуск, конфигурация окружения, настоящий identity provider, клиентские экраны и опубликованный endpoint |
| Player UI | Есть projection и transport contract | Экран героя, действия/карты, цели, ресурсы, состояния, результаты команд и reconnect UX |
| GM UI | Есть GM role/projection и команды pause/outcome | Экран контроля сцены, spawn/encounter flow, видимость скрытой информации, подтверждения и журнал |
| TV/public display | В актуальном vertical slice выделены Player и GM projections | Отдельная TV projection и экран с публичной информацией |
| Сетевые игровые действия | Внешний slice сейчас поддерживает move, pause и expedition outcome | Полный разрешённый набор режимов, карт, целей и боевых действий через typed commands |
| Авторизация | Есть абстракция AuthProvider; example provider хранит токены в памяти | Внешняя верификация identity, credential lifecycle, TLS и secrets handling |
| Persistence | Есть интерфейс и in-memory session/snapshot store | DB-backed implementation, миграции, атомарная запись event/result/snapshot/checkpoint и восстановление после перезапуска процесса |
| Campaign/world | Headless-обвязка покрывает узкий тестовый цикл | CampaignCoordinator, world map, полноценный city mode, POI, NPC dialogue, routes, scene approval и campaign state |
| Production content | Есть content catalog и тестовые игровые fixtures | Утверждённый production roster, карты, враги, числа баланса, сцены, награды и версии контента |
| Релиз | Локальные/CI проверки ядра и интеграционного пакета | Deployment, backup/restore, мониторинг, smoke tests, support/runbook и закрытый playtest |

### Важно про «могут ли игроки зайти»

**На уровне протокола:** да, клиент может подключиться к запущенному WebSocket server, если сервер запущен и ему настроены валидные auth/membership providers. Нужен клиент, умеющий говорить с /ws; в проекте это не равно готовой браузерной игре.

**На уровне продукта:** нет, пока нельзя считать, что обычные игроки могут зайти на готовый сайт, создать/открыть кампанию и пройти игру. Не подтверждено наличие опубликованного production endpoint; UI и production identity/persistence отсутствуют.

## 3. Существенные риски, которые надо проверить

1. **Raw events vs role projections.** В [adapter source](https://github.com/devingarde22-dot/fable-rpg/blob/main/packages/vertical-slice/src/index.ts) broadcastEvents отправляет срез engine journal всем подключённым sessions, тогда как projections фильтруются по роли. Это source-level security concern: до появления скрытых/частных event payloads нужно провести allowlist/role-filtered event stream и проверить фактические WebSocket payloads. Нельзя по одному этому коду утверждать, что существующие types events уже раскрывают секретный контент; это обязательный gate до расширения.
2. **Один поток авторитетного состояния.** Старый dev/server/CampaignRoom.ts — отдельный scaffold с параллельной логикой; не использовать его как второй production rules engine. Новый путь — packages/vertical-slice поверх packages/rules.
3. **Pause/recovery consistency.** Проверить, что pause state является частью одного authoritative lifecycle и корректно восстанавливается из snapshot; не должно быть отдельного adapter flag, который рассинхронизируется с engine при рестарте.
4. **Target selection.** Аудит [combat targeting](../docs/30-combat-targeting-audit.md) зафиксировал вероятный score-selection defect в packages/rules/src/intents/targeting.ts. Это source finding из чтения кода; нужно перенести в регрессионный тест на текущем main и воспроизвести до/во время исправления.
5. **Старый аудит не равен текущему статусу.** [PR #13 audit report](https://github.com/devingarde22-dot/fable-rpg/blob/main/docs/28-step-c-read-only-audit-2026-10-28.md) — снимок b619c77, до PR #14/#15. Его выводы про pause, idempotency, revision semantics и restore нужно перепроверить по текущему main, а не автоматически переносить.
6. **Незакрытые игровые определения.** Повторно сверить ranged-mode availability, card magic classification, hit/critical/miss, точность damage rounding, campaign-global event sequence и battle-end cleanup с утверждёнными rules/DR и текущей реализацией.

## 4. Как читать таблицы roadmap

Roadmap разделяет:
- **решённые технические интеграционные задачи** — уже есть в текущем main;
- **обнаруженные риски** — требуют актуального воспроизведения и отдельного теста;
- **игровые вопросы** — требуют Decision Record/подтверждения, а не самостоятельного выбора разработчика;
- **предлагаемые будущие функции** — ещё не являются частью подтверждённой игры.

Не называть UI, online multiplayer production, persistence или world-map loop «сделанными» только потому, что есть схема, интерфейс, README или тестовый adapter.