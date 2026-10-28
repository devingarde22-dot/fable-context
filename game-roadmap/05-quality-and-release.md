# 05 — Качество, проверки и выпуск

## 1. Уровни проверки

| Уровень | Что проверяется | Пример |
|---|---|---|
| Unit rules | Чистые формулы и eligibility | scoring, mitigation, target tie-break |
| Engine integration | Полная command/tick/event цепочка | movement collision, card play, status expiry, outcome |
| Replay/determinism | Тот же seed/input даёт ту же историю и state hash | engine restore, repeated golden encounter |
| Contract/schema | JSON Schemas и closed unions соответствуют transport | malformed/unknown fields, version mismatch |
| Security/visibility | Serialized messages не раскрывают private data | player vs GM vs TV snapshots, event stream, error payloads |
| Persistence/failure | Crash/retry/reconnect не дублирует mutations | kill/restart after command receipt/event write/checkpoint |
| WebSocket integration | Handshake, membership, role checks, limits, reconnect | invalid token, cross-campaign, forged role, expired resume token |
| Browser E2E | Люди играют через реальные screens | 2–4 players + GM + TV от join до outcome |
| Staging smoke | Сборка, конфигурация и инфраструктура | migration → deploy → health/readiness → play one scenario |
| Release rehearsal | Rollback/backup/operations | restore backup, rollback release by runbook |

## 2. Минимальный CI gate для code PR

- pnpm typecheck
- pnpm lint
- pnpm test
- pnpm build
- schema compilation/validation and tests for every changed envelope/contract
- git diff --check
- deterministic replay/state-hash tests for altered rules/engine paths
- authorization and visibility tests if adapter/projection/event code changes.

pnpm check уже объединяет typecheck/lint/test по package scripts; build выполняется отдельно. Фактические команды должен запускать исполнитель и фиксировать результат. Roadmap не считает прошлые PR test reports новым запуском.

## 3. Обязательные negative cases

### Identity / membership
- empty/invalid/revoked token;
- player token attempts to join as GM;
- user not member of campaign;
- actorId does not belong to identity;
- user of one campaign connects to another;
- duplicate GM, duplicate session, invalid resume token.

### Visibility
- Player не получает чужой hero/private stats;
- TV не получает GM-only fields или hidden intents;
- raw events не обходят фильтр projection;
- reconnect snapshot and redelivery use same visibility policy;
- error/log не содержит private payload или raw credentials.

### Reliability
- duplicate requestId before/after resolution;
- reconnect with new transport session retries an already accepted command;
- disconnect during open input window;
- GM disconnect/reconnect and scene transition;
- process restart between mutation, event persistence, receipt and snapshot;
- DB timeout/transaction rollback;
- rules/content bundle version unavailable at restore;
- concurrent requests and serialized command ordering.

### Gameplay
- non-tied target policy candidates;
- collision/occupied cells and invalid modes;
- range/LoS/cost/target validation for every card effect;
- terminal outcome cannot commit twice;
- battle-only resources/statuses cleanup and persistent injury survive;
- checkpoint/reward/retry/retreat semantics match accepted DRs;
- full scenario replay equals state hash at checkpoints.

## 4. Нефункциональные требования до beta

Не придумывать числа заранее. До нагрузочного теста согласовать:
- maximum sessions per campaign and concurrent active campaigns;
- acceptable command round-trip latency and reconnect time;
- availability expectation/maintenance windows;
- retention and backup recovery-point/recovery-time targets;
- privacy/logging retention expectations;
- browser/device compatibility matrix.

Далее тесты сравниваются с этими целями, а не с неявным «вроде быстро».

## 5. Операционные артефакты до production

- environment variable reference with safe defaults and startup validation;
- deployment diagram, health vs readiness semantics and rollback plan;
- DB migration and backup/restore procedures;
- alerts for server crash, failed persistence, repeated auth failures and elevated command rejection;
- redaction policy for credentials and personal data;
- release notes and pinned rules/content versions;
- incident response/contact and a known way to disable a broken release safely.

## 6. Release gate

Не выпускать, пока:
1. все P0/P1 задачи в release scope закрыты или явно приняты владельцем;
2. нет неразрешённых data loss/duplicate reward/visibility leaks;
3. production auth, transport security and database persistence are enabled;
4. replay/version compatibility and backup restore demonstrated;
5. closed beta completed with critical issues addressed;
6. full CI + staging smoke + cross-client E2E passed;
7. runtime config, migration, rollback and operations docs reviewed.

После запуска продолжать собирать reports и метрики, но не делать breaking protocol/schema changes без versioning/compatibility plan.