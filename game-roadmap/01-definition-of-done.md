# 01 — Что значит «готовая игра»

Нужно не смешивать первый играбельный результат, закрытую beta и релиз. Каждый уровень полезен, но только последний означает готовый продукт для обычных игроков.

## Уровень A — Первый playable online slice

Один воспроизводимый сценарий, в который могут играть 2–4 игрока и GM через реальные клиенты:

- игрок и GM могут подключиться к одному campaign/session через сервер, не подделывая роль в сообщении;
- у каждого игрока стабильная привязка actor → hero; второй игрок не управляет чужим героем;
- Player UI показывает собственные характеристики/ресурсы/действия; GM UI показывает сцену и разрешённые GM сведения;
- public/TV экран показывает только публичное состояние;
- команды идут через server-authoritative engine; UI не меняет HP, позицию, карты, intents или outcome локально как истину;
- сервер подтверждает конечный результат команды и обновляет экран участникам;
- есть хотя бы один полный бой с началом, ходами врага, разрешёнными действиями игрока и валидным outcome;
- есть победа и retreat/defeat пути, а не только hardcoded demo end;
- reconnect не дублирует действие и восстанавливает корректное состояние;
- automated E2E проверяет один сценарий как минимум с двумя игроками и GM.

Этот уровень не означает, что закончены город, диалоги, прогрессия, кампания или production deployment.

## Уровень B — MVP campaign / closed beta

Помимо playable slice:

- полноценный начальный маршрут: city → world map/route → location/POI → GM-approved encounter → battle → outcome → recovery/checkpoint → возможность продолжить кампанию;
- хотя бы один завершённый сценарий с реальным production content, а не только TEST_ONLY fixtures;
- подтверждённые правила deck/card/action loop, цели/дальности/LoS, ресурсы, statuses, enemy intents, end-of-battle cleanup, injuries, rewards;
- общий party NPC dialogue session: игроки видят один server-owned state; выборы, доступы, flags и переход в сцену проверяются на сервере и требуют GM approval там, где это записано в принятых правилах;
- durable campaign/hero/progression state после рестарта сервера; event history и snapshots соответствуют одному commit boundary;
- роли Player, GM и TV дают раздельные безопасные projections и events;
- onboarding, приглашение/доступ в кампанию, понятные ошибки подключения, loading/reconnect states;
- закрытый playtest на разных браузерах/устройствах; issue list, приоритеты и подтверждённые исправления.

## Уровень C — Release candidate / готовность к выпуску

- Нет известных неустранённых P0/P1 security/data-loss/gameplay correctness дефектов в релизном scope; риски задокументированы и явно приняты.
- Релизная конфигурация внешнего identity provider, TLS/HTTPS/WSS, secrets handling, production database, миграции, backup/restore и мониторинг.
- Нагрузочные и сетевые испытания для согласованного числа одновременных кампаний/игроков. Численные SLO определить до performance testing.
- Контроль replay/version compatibility: каждой сохранённой кампании известны совместимые rules/content versions или есть явный путь миграции.
- Восстановление после отключения игрока, отключения GM, рестарта процесса и частичной ошибки транзакции проверено тестами/runbook.
- Нет критичных ошибок visibility leakage в projections, event stream, reconnect payloads, logs или error messages.
- CI проходит typecheck, lint, tests, build и schema validation. Smoke test выполняется на собранном кандидате в staging.
- Есть инструкции запуска, миграции, отката релиза, восстановления backup, обзора логов и обработки инцидента.
- Контент, права использования art/audio/font, локализация, accessibility и поддерживаемые браузеры проверены до релиза.

## Общий Definition of Done для каждого PR

1. Задача связана с backlog ID и имеет тестируемые acceptance criteria.
2. Изменения принадлежат правильному слою: rules, adapter, campaign coordinator, persistence, UI или content; дублирования gameplay-логики нет.
3. Для поведения есть тест нужного уровня.
4. Команды, события и schema versioning изменены намеренно, без неявного расширения закрытого union.
5. При изменении детерминированных правил проверены fixed seed, replay/state hash и отсутствие зависимости от wall clock/нестабильного порядка.
6. Для private data тестируется сериализованный transport payload, а не только projection helper.
7. В ответе по PR честно указаны точные команды и результат. Не писать PASS, если команда не выполнялась.
8. Неутверждённые предложения из docs 31–42 не становятся каноном без Decision Record.

## Открытые product decisions

- точное определение ranged-mode capability и согласование canEnterRangedMode с текстом Vertical Slice;
- модель card categories и определение magic;
- hit chance / critical / miss formulas, RNG stream и порядок их разрешения;
- утверждение damage rounding/mitigation policy с учётом replay/version compatibility;
- полный lifecycle battle-only resources/statuses и persistent injury;
- какие world-loop proposals становятся обязательными и какой объём стартовой кампании входит в MVP.

Если решение ещё не принято, блокируется соответствующая механика, а не весь проект.