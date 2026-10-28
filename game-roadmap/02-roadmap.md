# 02 — Пошаговая дорожная карта

Очередность выбрана по зависимостям: сначала надёжность engine и transport boundary, затем браузерный playable slice, далее persistence и campaign loop, затем production content/polish и release. Календарные сроки не указаны: пока неизвестны доступная команда, дизайн UI и объём контента, сроки создавали бы ложную точность.

## Этап 0 — Синхронизация реального состояния

**Цель:** единственный согласованный ответ на вопрос «что уже есть в main?».

Работы:
- зафиксировать актуальный fable-rpg/main после PR #14 и #15;
- перечитать PR #15 source/tests; повторно проверить более ранние audit findings на текущем коде;
- обновить handoff/README и context status, чтобы open/merged PR не были перепутаны;
- разделить старый dev/server/CampaignRoom.ts scaffold и используемый теперь packages/vertical-slice;
- зафиксировать воспроизводимый способ запуска local WebSocket slice, конфигурацию окружения и test credentials без публикации секретов.

**Gate 0:** разработчик на новой машине устанавливает зависимости, выполняет quality gates и локально запускает сервер с известной тестовой конфигурацией; status docs ссылаются на актуальный snapshot.

## Этап 1 — Engine correctness и решение спорных правил

**Цель:** перед UI и реальными кампаниями гарантировать, что сервер выбирает правильные цели, применяет подтверждённые правила и корректно переживает retry.

Работы:
- повторно проверить и покрыть тестом target-selection finding из [аудита](../docs/30-combat-targeting-audit.md); проверить scoring policy на non-tied candidates, затем deterministic tie-break;
- проверить WebSocket events broadcast: события должны иметь role-appropriate disclosure contract, как и projections;
- проверить pause/resume и state restore на restart: pause не должен жить только в отдельном adapter flag;
- сверить battle-end cleanup с owner requirement и lifecycle proposal;
- сделать Decision Records для ranged availability, magic, hit/critical/miss, damage rounding;
- определить campaign-global sequencing и безопасный переход между разными scenes/engines;
- перепроверить end-outcome/rollback permissions и confirmationToken expectations в текущем engine/API.

**Порядок:** source audit → минимальные regression tests → решение, если требуется изменение game rule → отдельный узкий PR на исправление → повторный pnpm check/pnpm build.

**Gate 1:** нет известных непроверенных P1 defects в применяемом gameplay scope; спорные правила имеют DR; replay/state hash tests проходят; private data не попадает в чужой event stream.

## Этап 2 — Браузерный online playable slice

**Цель:** реальный человек может открыть сайт, войти как Player или GM и отыграть один полный бой. Начать с минимального интерфейса, не с полноценного визуального мира.

Работы:
- выбрать frontend approach (React/Vite или другая система — отдельное техническое решение, не предположение);
- сделать dev bootstrap/start script для packages/vertical-slice, health check, seeded test auth/membership и инструкцию для второго устройства;
- реализовать Player UI: состояние героя, допустимые действия, цель/направление, результат/ошибка команды, reconnect/loading;
- реализовать GM UI: scene state, pause/resume, подтверждение outcome и доступные encounter controls;
- добавить отдельную TV projection и public screen;
- расширить typed network commands после завершения engine decisions: mode selection, card play и действия first slice;
- обеспечить terminal command receipt; повтор одного request не должен повторно применять эффект;
- E2E: 2–4 player clients + GM + TV от подключения до результата сцены.

**Gate 2:** игру можно пройти в браузере с нескольких сессий; UI отображает серверную истину, все роли получают разрешённые данные, сценарий проходит без ручного изменения памяти сервера.

## Этап 3 — Durable persistence и восстановление

**Цель:** кампания не исчезает из-за process restart и команда не применяется дважды при retry/reconnect.

Работы:
- утвердить DB model и миграции для campaign, membership, hero persistent state, event journal, command receipts, snapshots/checkpoints, content/rules version references;
- реализовать SlicePersistence/session persistence на DB, не заменяя движок таблицами напрямую;
- задать transaction boundary: command terminal result, committed domain events, snapshot/checkpoint and reward mutation должны иметь coherent atomic/recovery semantics;
- обеспечить request idempotency при новом WebSocket session и process restart;
- хранить immutable rules/content bundle IDs для каждого snapshot/campaign;
- восстановить engine из snapshot plus pinned catalogs; явно обрабатывать отсутствие версии;
- испытать crash points до commit, после event write, после result write, при reconnect и rollback;
- определить retention/backup/restore runbook и campaign/scene ownership в многосерверном запуске.

**Gate 3:** тест перезапускает сервер после принятой команды; команда/награда не дублируется, финальный результат и state hash соответствуют events, игроки возвращаются в ту же кампанию.

## Этап 4 — CampaignCoordinator и полный world loop

**Цель:** соединить боевые сцены устойчивым campaign lifecycle.

Прежде кода:
- выбрать предложения из [docs 31–42](../docs/31-world-map-city-dialogue-transitions.md) для MVP и утвердить как Decision Records;
- утвердить campaign command/event/projection schemas отдельного versioned protocol; не расширять scene schema случайными полями;
- определить persistent campaign state и hero campaign state отдельно от battle runtime.

Затем:
- реализовать CampaignCoordinator поверх engine: legal transitions, active activity, current location, route/node access, GM approvals, campaign revisions;
- world map mode и route selection;
- city mode с POIs и услугами;
- shared NPC dialogue session с server-owned graph/state и allowlisted effects;
- GM-approved entry to encounter; один committed terminal outcome per scene;
- battle-end cleanup, persistent injuries, city recovery and checkpoint ordering;
- expedition attempt/retry/reward eligibility и переход назад к campaign;
- role-specific campaign projections/events and reconnect during dialogue/travel/GM approval.

**Gate 4:** golden campaign test проходит city → map/route → POI/dialogue → GM-approved scene → battle → outcome → recovery/checkpoint → next activity; при failure/restart состояние однозначно восстанавливается.

## Этап 5 — Production gameplay content и progression

**Цель:** заменить test-only fixtures на разработанное и балансируемое содержание.

Работы:
- определить доступных героев/роли и источники persistent stats, equipment, skills, cards;
- production card catalog с explicit category/type, allowedModes, effects, target/range/LoS/cost and approved balance values;
- production enemies, intents, encounter templates, environment/terrain and placement rules;
- end-to-end card/deck/mode commands and UI;
- rewards, inventory/progression and post-battle consequences through campaign service, not client payload;
- seed/version data catalogs, content validation and migration compatibility;
- golden encounters plus deterministic balance/simulation harness; отделить content/balance approval от code correctness.

**Gate 5:** MVP scenario and campaign use no accidental TEST_ONLY content; content versions are pinned and tested.

## Этап 6 — UX, authoring и narrative completion

**Цель:** сделать игру понятной игрокам и сократить ручную работу GM.

Работы:
- адаптивный mobile Player UI;
- GM operations: create/join campaign, choose scene/encounter, hidden info, spawn proposal/approval, outcome, history/checkpoint;
- TV/public screen с battlefield, telegraphs and state transitions;
- validated content workflow/editor for city/POI/dialogue/route;
- onboarding/tutorial/help, error states and reconnect UX;
- art/audio/animation/VFX, localization and accessibility; license inventory for shipped assets;
- playtests with players and GMs; фиксить по impact, не добавлять features хаотично.

**Gate 6:** новые testers могут войти в кампанию и понять следующий шаг без developer instructions; GM управляет сценой без редактирования файлов/raw protocol.

## Этап 7 — Private beta и production hardening

**Цель:** проверить весь vertical slice в условиях, близких к реальным.

Работы:
- external identity provider, secure session/token lifecycle, TLS/WSS, secret management, deployment config;
- DB-backed membership and persistence, migrations, backups, recovery drill;
- role filtering for snapshots, events, reconnect payloads, logs and errors;
- rate-limit strategy across process/instances, command size/time limits and abuse protection;
- structured logs, metrics, health/readiness, alerting and incident runbook;
- load/latency tests for agreed concurrency target; packet-loss/reconnect tests;
- closed beta with issue triage and rollback process.

**Gate 7:** release-critical tests pass in staging; backup restore and restart recovery demonstrated; no known P0/P1 issue unresolved without owner acceptance.

## Этап 8 — Release candidate и выпуск

- freeze release scope and pin rules/content versions;
- run full CI plus staging smoke and E2E;
- review schema migrations, backup retention and rollback plan;
- confirm deployment health, dashboards, alerts, agreed SLO values;
- verify onboarding, privacy, support path, licenses, accessibility and localization;
- ship a tagged release and maintain a patch process.

**Gate 8:** [Definition of Done](./01-definition-of-done.md) выполнен, release checklist approved, operational owner and recovery path known.

## Критическое правило порядка

Не начинать большой world UI или контент до закрытия correctness/security gates. Не добавлять production persistence без transaction/recovery contract. Не разрешать AI напрямую менять campaign state: только validated proposals, server approval and typed domain commands.