# 03 — Backlog и acceptance criteria

Это ориентир для разбиения roadmap на небольшие PR. Статусы нужно менять после проверки актуального fable-rpg/main; наличие интерфейса/schema не означает, что функция завершена.

| ID | Приоритет | Задача | Зависимость | Acceptance criteria |
|---|---|---|---|---|
| BASE-01 | P0 | Синхронизировать статус main и handoff | Нет | README, handoff, context state и roadmap ссылаются на один snapshot; #14/#15 не описаны как open |
| ENG-01 | P1 | Повторно проверить target-selection finding | BASE-01 | Fixtures с разными scores; algorithm выбирает global optimum, RNG tie-break только среди равных лучших кандидатов; replay детерминирован |
| SEC-01 | P0 до hidden content | Фильтровать event stream по роли | BASE-01 | Player/GM/TV получают allowlisted events; тест проверяет сериализованные WS payloads, не только projection helper |
| ENG-02 | P1 | Проверить pause state и restore | BASE-01 | Pause/resume переживает snapshot/restart; engine и adapter не имеют расходящихся флагов; тесты подтверждают остановку нужных phases |
| RULE-01 | P1 | Утвердить ranged-mode capability | Product decision | DR согласует canEnterRangedMode с Vertical Slice; code/schema/tests следуют одному правилу |
| RULE-02 | P1 | Утвердить card category и magic semantics | Product decision | Модель карты явно задаёт категорию/тип; magic behavior и compatibility/versioning покрыты tests |
| RULE-03 | P1 | Утвердить hit/critical/miss rules | Product decision | Формулы, RNG purpose stream, порядок фаз и event semantics определены; fixed-seed tests покрывают границы |
| ENG-03 | P1 | Проверить damage rounding | Audit + DR | Exact edge fixtures и версия формулы определены; изменение не ломает historical replay silently |
| ENG-04 | P1 | Battle-end state cleanup | RULE/lifecycle decision | Terminal transition удаляет battle-only stamina/deck/temporary statuses, сохраняя persistent injury; next battle rebuilds from persistent sources |
| ENG-05 | P1 до multi-scene | Campaign-global event sequence | Campaign protocol design | Sequence monotonic across scenes/restarts; duplicate allocator impossible; recovery test covers transfer/checkpoint |
| NET-01 | P1 | Repeatable local server bootstrap | BASE-01 | One documented command starts package with safe dev fixture; healthcheck works; two browser sessions connect |
| NET-02 | P1 | Player/GM/TV browser shell | NET-01, SEC-01 | Three screens connect; each displays correct projection and command result; TV has no private data |
| NET-03 | P1 | Complete transport command set for combat MVP | ENG-01, RULE-01..03 | Typed/validated commands mapped to engine; no duplicated combat logic in adapter/UI; rejected commands do not mutate state |
| DB-01 | P1 до private beta | Durable persistence adapter | NET-01 | Migrations, transactional write model, DB-backed session/snapshot store and restart restore tests pass |
| DB-02 | P1 до private beta | Crash recovery and idempotency across restarts | DB-01 | Duplicate request on reconnect/restart returns terminal receipt; events/rewards applied at most once |
| CAMP-01 | P1 | Approve campaign state machine and protocol | Owner decisions | Campaign commands/events have versioned schemas, legal transitions and acceptance scenarios |
| CAMP-02 | P1 | CampaignCoordinator | CAMP-01, DB-01 | Owns location/activity/route/POI/dialogue/approval/checkpoint metadata; scene engine stays authoritative for combat |
| WORLD-01 | P1 для MVP | Map, route and city POIs | CAMP-02 | Access checks server-side; data-driven graph; events/revisions/projections covered by golden tests |
| WORLD-02 | P1 для MVP | Shared NPC dialogue and GM approval | CAMP-02 | One server-owned session, graph guards, allowlisted effects, duplicate choice handling and approved scene entry tested |
| CONTENT-01 | P1 для production slice | Production heroes/cards/enemies/encounters | RULE-01..03, NET-03 | No accidental TEST_ONLY content in release catalog; schema/content validation and balance approval exist |
| PROG-01 | P1 для campaign MVP | Persistent progression and rewards | DB-01, CAMP-02 | Rewards/progression mutate once, are versioned, survive restart and cannot be client supplied |
| UX-01 | P1 | Player/GM/TV usability pass | NET-02, CONTENT-01 | New tester joins and completes scenario with no raw protocol usage/developer help |
| OPS-01 | P1 до release | Staging, production deployment, observability | DB-01, NET-02 | TLS/WSS, secrets, health/readiness, logs/metrics, backups and recovery runbook validated |
| REL-01 | P1 до release | Release candidate gate | All prior P1s | CI, schema, E2E, migration, recovery, security and smoke suites pass; unresolved risks explicitly accepted |

## Рекомендуемый порядок первых задач

1. BASE-01: проверить актуальный main и синхронизировать статусы после PR #14/#15.
2. SEC-01: закрыть raw event broadcast risk до внесения hidden/private event content.
3. ENG-01 и ENG-02: раздельно проверить target scoring и authoritative pause/restore.
4. RULE-01..03 и ENG-03..04: короткие Decision Records и regression tests.
5. NET-01..03: browser playable slice.
6. DB-01..02: persistence/restart safety.
7. CAMP-01..02 → WORLD-01..02 → CONTENT-01/PROG-01 → UX-01 → OPS-01/REL-01.

P0 означает блокер безопасности данных или корректного статуса перед расширением. P1 — необходимая задача для выпуска целевого MVP, но может выполняться после закрытия зависимостей.